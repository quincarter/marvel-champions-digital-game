import { abilityId as asAbilityId, type AnyCard, type ResourceIconCounts } from "@mc/content";
import type { AbilityDefinition } from "./abilities.js";
import type { ChoiceOption } from "./choices.js";
import type { Command, Payment } from "./commands.js";
import { emit, updateInstance, updatePlayer, type Ctx } from "./ctx.js";
import { discardFromHand, exhaustCard, healDamage, removeCounters } from "./effects.js";
import { engineError, type EngineError, type EngineErrorCode } from "./errors.js";
import { advanceAfterTurn } from "./flow.js";
import { instanceId as asInstanceId, type InstanceId, type PlayerId } from "./ids.js";
import { hasKeyword, statusActive } from "./keywords.js";
import {
  cardOf,
  characterProfile,
  countSchemeIcons,
  getCard,
  getInstance,
  mustCardOf,
  mustInstance,
  mustPlayer,
} from "./query.js";
import { pushActionAbility, pushEvent, pushPlayCardFrame } from "./resolve.js";
import { activeAbilityRefs, canAttack, cardsInPlay, controllerOf, restrictedCardsOf } from "./select.js";
import type { GameState } from "./state.js";

function requireActivePlayer(state: GameState, playerId: PlayerId, command: Command): EngineError | null {
  const step = state.step;
  if (step.phase !== "player" || step.kind !== "turn") {
    return engineError("wrong_phase", `cannot act during ${step.phase}/${step.kind}`, command);
  }
  if (step.activePlayerId !== playerId) {
    return engineError("not_active_player", `it is ${step.activePlayerId}'s turn`, command);
  }
  return null;
}

export function changeForm(ctx: Ctx, command: Command & { type: "changeForm" }): EngineError | null {
  const invalid = requireActivePlayer(ctx.state, command.playerId, command);
  if (invalid) return invalid;
  const player = mustPlayer(ctx.state, command.playerId);
  if (player.identity.changedFormThisRound) {
    return engineError("already_changed_form", "form may only be changed once each round", command);
  }
  const to = player.identity.form === "hero" ? "alterEgo" : "hero";
  // RRG "Form, Change Form": damage, status cards, tokens, and ready/exhausted state all persist.
  updatePlayer(ctx, command.playerId, (p) => ({
    ...p,
    identity: { ...p.identity, form: to, changedFormThisRound: true },
  }));
  emit(ctx, { type: "formChanged", playerId: command.playerId, to });
  return null;
}

function resourcesFrom(card: AnyCard): number {
  const icons: ResourceIconCounts =
    card.type === "resource"
      ? card.producesIcons
      : "resourceIcons" in card
        ? card.resourceIcons
        : {};
  // Wild icons count toward any generic cost; typed requirements are a slice-3 keyword.
  return Object.values(icons).reduce<number>((sum, n) => sum + (n ?? 0), 0);
}

interface PricedPayment {
  readonly resources: number;
}

interface PriceFault {
  readonly code: EngineErrorCode;
  readonly message: string;
}

/**
 * RRG "Cost": resources come from cards discarded from hand and from "Resource"
 * abilities. Overpaying is legal; the excess is simply lost.
 */
function priceOf(
  ctx: Ctx,
  playerId: PlayerId,
  payment: readonly Payment[],
  excludeInstanceId: InstanceId | null,
): PricedPayment | PriceFault {
  const player = mustPlayer(ctx.state, playerId);
  const seen = new Set<string>();
  let resources = 0;
  for (const entry of payment) {
    if ("fromHand" in entry) {
      const key = `hand:${entry.fromHand}`;
      if (seen.has(key)) return { code: "insufficient_resources", message: "duplicate payment card" };
      seen.add(key);
      if (entry.fromHand === excludeInstanceId) {
        return { code: "insufficient_resources", message: "a card cannot pay for itself" };
      }
      if (!player.hand.includes(entry.fromHand)) {
        return { code: "card_not_in_zone", message: `payment card ${entry.fromHand} is not in hand` };
      }
      const card = cardOf(ctx.state, entry.fromHand);
      if (!card) return { code: "unknown_card", message: `no card data for ${entry.fromHand}` };
      resources += resourcesFrom(card);
      continue;
    }
    const { instanceId, abilityId } = entry.ability;
    const key = `ability:${instanceId}:${abilityId}`;
    if (seen.has(key)) return { code: "insufficient_resources", message: "duplicate resource ability" };
    seen.add(key);
    const definition = ctx.deps.abilities[abilityId];
    if (!definition || definition.trigger.kind !== "resource") {
      return { code: "no_valid_target", message: `${abilityId} is not a resource ability` };
    }
    if (!activeAbilityRefs(ctx.state, instanceId).some((ref) => ref.id === abilityId)) {
      return { code: "no_valid_target", message: `${abilityId} is not active on ${instanceId}` };
    }
    if (controllerOf(ctx.state, instanceId) !== playerId) {
      return { code: "no_valid_target", message: "resource abilities must be on cards you control" };
    }
    const fault = abilityCostFault(ctx, instanceId, playerId, definition);
    if (fault) return fault;
    resources += definition.generates ?? 1;
  }
  return { resources };
}

function pricePayment(
  ctx: Ctx,
  playerId: PlayerId,
  payment: readonly Payment[],
  excludeInstanceId: InstanceId | null,
  command: Command,
): PricedPayment | EngineError {
  const priced = priceOf(ctx, playerId, payment, excludeInstanceId);
  if ("resources" in priced) return priced;
  return engineError(priced.code, priced.message, command);
}

/** Resources a payment is worth, or null if it is not a legal payment at all. */
export function priceOrNull(
  ctx: Ctx,
  playerId: PlayerId,
  payment: readonly Payment[],
  excludeInstanceId: InstanceId | null,
): number | null {
  const priced = priceOf(ctx, playerId, payment, excludeInstanceId);
  return "resources" in priced ? priced.resources : null;
}

/** Every resource a player could spend right now, as fully described choice options. */
export function paymentOptions(
  ctx: Ctx,
  playerId: PlayerId,
  excludeInstanceId: InstanceId | null,
): readonly ChoiceOption[] {
  const options: ChoiceOption[] = [];
  for (const id of mustPlayer(ctx.state, playerId).hand) {
    if (id === excludeInstanceId) continue;
    options.push({
      optionId: `hand:${id}`,
      label: mustCardOf(ctx.state, id).name,
      ref: { kind: "card", instanceId: id },
    });
  }
  for (const id of cardsInPlay(ctx.state)) {
    if (controllerOf(ctx.state, id) !== playerId) continue;
    for (const ref of activeAbilityRefs(ctx.state, id)) {
      const definition = ctx.deps.abilities[ref.id];
      if (!definition || definition.trigger.kind !== "resource") continue;
      if (abilityCostFault(ctx, id, playerId, definition)) continue;
      options.push({
        optionId: `ability:${id}:${ref.id}`,
        label: mustCardOf(ctx.state, id).name,
        ref: { kind: "ability", instanceId: id, abilityId: ref.id },
      });
    }
  }
  return options;
}

export function paymentsFromOptionIds(optionIds: readonly string[]): readonly Payment[] {
  const payments: Payment[] = [];
  for (const optionId of optionIds) {
    const [kind, first, second] = optionId.split(":");
    if (kind === "hand" && first) payments.push({ fromHand: asInstanceId(first) });
    if (kind === "ability" && first && second) {
      payments.push({ ability: { instanceId: asInstanceId(first), abilityId: asAbilityId(second) } });
    }
  }
  return payments;
}

export function payPayment(ctx: Ctx, playerId: PlayerId, payment: readonly Payment[]): void {
  for (const entry of payment) {
    if ("fromHand" in entry) {
      discardFromHand(ctx, playerId, entry.fromHand);
      continue;
    }
    const { instanceId, abilityId } = entry.ability;
    const definition = ctx.deps.abilities[abilityId];
    if (!definition) continue;
    payAbilityCost(ctx, instanceId, playerId, definition);
    emit(ctx, {
      type: "resourcesGenerated",
      playerId,
      instanceId,
      abilityId,
      amount: definition.generates ?? 1,
    });
  }
}

function abilityCostFault(
  ctx: Ctx,
  instanceId: InstanceId,
  playerId: PlayerId,
  definition: AbilityDefinition,
): PriceFault | null {
  const cost = definition.cost;
  if (!cost) return null;
  const instance = getInstance(ctx.state, instanceId);
  if (!instance) return { code: "unknown_instance", message: `no instance ${instanceId}` };
  if (cost.exhaustSelf && instance.exhausted) {
    return { code: "already_exhausted", message: "the card is already exhausted" };
  }
  if (cost.spendCounters) {
    const held = instance.counters[cost.spendCounters.counterType] ?? 0;
    if (held < cost.spendCounters.amount) {
      return {
        code: "insufficient_resources",
        message: `not enough ${cost.spendCounters.counterType} counters`,
      };
    }
  }
  if (cost.damageSelf !== undefined) {
    const identity = mustPlayer(ctx.state, playerId).identity.instanceId;
    if (!getInstance(ctx.state, identity)) {
      return { code: "no_valid_target", message: "no identity to take the damage" };
    }
  }
  return null;
}

function checkAbilityCost(
  ctx: Ctx,
  instanceId: InstanceId,
  playerId: PlayerId,
  definition: AbilityDefinition,
  command: Command,
): EngineError | null {
  const fault = abilityCostFault(ctx, instanceId, playerId, definition);
  return fault ? engineError(fault.code, fault.message, command) : null;
}

function payAbilityCost(
  ctx: Ctx,
  instanceId: InstanceId,
  playerId: PlayerId,
  definition: AbilityDefinition,
): void {
  const cost = definition.cost;
  if (!cost) return;
  if (cost.exhaustSelf) exhaustCard(ctx, instanceId);
  if (cost.spendCounters) {
    removeCounters(ctx, instanceId, cost.spendCounters.counterType, cost.spendCounters.amount);
  }
  if (cost.damageSelf) {
    pushEvent(ctx, {
      kind: "dealDamage",
      targetInstanceId: mustPlayer(ctx.state, playerId).identity.instanceId,
      amount: cost.damageSelf,
      sourceInstanceId: instanceId,
      fromAttack: false,
    });
  }
}

export function playCard(ctx: Ctx, command: Command & { type: "playCard" }): EngineError | null {
  const invalid = requireActivePlayer(ctx.state, command.playerId, command);
  if (invalid) return invalid;
  const player = mustPlayer(ctx.state, command.playerId);
  if (!player.hand.includes(command.cardInstanceId)) {
    return engineError("card_not_in_zone", "card is not in hand", command);
  }
  const instance = mustInstance(ctx.state, command.cardInstanceId);
  const card = getCard(ctx.state, instance.cardId);
  if (!card) return engineError("unknown_card", `no card data for ${instance.cardId}`, command);
  if (card.type === "resource") {
    return engineError("card_type_not_playable", "resource cards are discarded to pay costs, not played", command);
  }
  if (!("cost" in card)) {
    return engineError("card_type_not_playable", `${card.type} cannot be played from hand`, command);
  }

  const priced = pricePayment(ctx, command.playerId, command.payment, command.cardInstanceId, command);
  if ("code" in priced) return priced;
  if (priced.resources < card.cost) {
    return engineError("insufficient_resources", `need ${card.cost}, paid ${priced.resources}`, command);
  }

  // RRG "Restricted": a player cannot control more than two at a time, so playing
  // a third is not a legal action in the first place.
  if (hasKeyword(ctx.state, command.cardInstanceId, "restricted") && restrictedCardsOf(ctx.state, command.playerId).length >= 2) {
    return engineError("no_valid_target", "you already control two restricted cards", command);
  }

  let attachTo: InstanceId | null = null;
  if (card.type === "upgrade") {
    attachTo = command.attachToInstanceId ?? player.identity.instanceId;
    if (!getInstance(ctx.state, attachTo)) {
      return engineError("no_valid_target", "upgrade has no valid host", command);
    }
  }

  payPayment(ctx, command.playerId, command.payment);
  emit(ctx, {
    type: "cardPlayed",
    playerId: command.playerId,
    instanceId: command.cardInstanceId,
    cardId: card.id,
    resourcesPaid: priced.resources,
  });
  pushPlayCardFrame(ctx, command.cardInstanceId, command.playerId, attachTo);
  return null;
}

/** RRG "Action": triggered on a card you control, during your own turn. */
export function useAbility(ctx: Ctx, command: Command & { type: "useAbility" }): EngineError | null {
  const invalid = requireActivePlayer(ctx.state, command.playerId, command);
  if (invalid) return invalid;
  const instance = getInstance(ctx.state, command.cardInstanceId);
  if (!instance) return engineError("unknown_instance", `no instance ${command.cardInstanceId}`, command);
  const definition = ctx.deps.abilities[command.abilityId];
  if (!definition) return engineError("unknown_ability", `no ability ${command.abilityId}`, command);
  if (definition.trigger.kind !== "action") {
    return engineError("wrong_phase", `${command.abilityId} is not an action ability`, command);
  }
  if (!activeAbilityRefs(ctx.state, command.cardInstanceId).some((ref) => ref.id === command.abilityId)) {
    return engineError("no_valid_target", `${command.abilityId} is not active on that card`, command);
  }
  const controller = controllerOf(ctx.state, command.cardInstanceId);
  if (controller !== null && controller !== command.playerId) {
    return engineError("no_valid_target", "you do not control that card", command);
  }
  const player = mustPlayer(ctx.state, command.playerId);
  if (definition.trigger.form && player.identity.form !== definition.trigger.form) {
    return engineError("wrong_form", `${command.abilityId} requires ${definition.trigger.form} form`, command);
  }
  if (definition.limit) {
    const uses = ctx.state.abilityUses[`${command.cardInstanceId}:${command.abilityId}`] ?? 0;
    if (uses >= definition.limit.count) {
      return engineError("limit_reached", `limit ${definition.limit.count} per ${definition.limit.period}`, command);
    }
  }
  const unpayable = checkAbilityCost(ctx, command.cardInstanceId, command.playerId, definition, command);
  if (unpayable) return unpayable;

  const needed = definition.cost?.resources ?? 0;
  const priced = pricePayment(ctx, command.playerId, command.payment, null, command);
  if ("code" in priced) return priced;
  if (priced.resources < needed) {
    return engineError("insufficient_resources", `need ${needed}, paid ${priced.resources}`, command);
  }

  payPayment(ctx, command.playerId, command.payment);
  payAbilityCost(ctx, command.cardInstanceId, command.playerId, definition);
  pushActionAbility(ctx, command.cardInstanceId, command.abilityId, command.playerId);
  return null;
}

function usableCharacter(
  ctx: Ctx,
  playerId: PlayerId,
  characterId: InstanceId,
  command: Command,
): EngineError | null {
  const player = mustPlayer(ctx.state, playerId);
  const instance = getInstance(ctx.state, characterId);
  if (!instance) return engineError("unknown_instance", `no instance ${characterId}`, command);
  const isIdentity = player.identity.instanceId === characterId;
  const isOwnAlly = player.playArea.includes(characterId) && cardOf(ctx.state, characterId)?.type === "ally";
  if (!isIdentity && !isOwnAlly) {
    return engineError("no_valid_target", "character is not a hero or ally you control", command);
  }
  if (isIdentity && player.identity.form !== "hero") {
    return engineError("wrong_form", "alter-egos cannot attack or thwart", command);
  }
  if (instance.exhausted) return engineError("already_exhausted", "character is exhausted", command);
  return null;
}

/** RRG "Consequential Damage": tier 5 of the timing chart, after the attack fully resolves. */
function pushConsequentialDamage(ctx: Ctx, characterId: InstanceId, kind: "attack" | "thwart"): void {
  const card = cardOf(ctx.state, characterId);
  if (card?.type !== "ally") return;
  const amount = kind === "attack" ? card.consequentialDamage.attack : card.consequentialDamage.thwart;
  if (amount <= 0) return;
  pushEvent(ctx, {
    kind: "dealDamage",
    targetInstanceId: characterId,
    amount,
    sourceInstanceId: characterId,
    fromAttack: false,
  });
}

export function basicAttack(ctx: Ctx, command: Command & { type: "basicAttack" }): EngineError | null {
  const invalid = requireActivePlayer(ctx.state, command.playerId, command);
  if (invalid) return invalid;
  const unusable = usableCharacter(ctx, command.playerId, command.attackerInstanceId, command);
  if (unusable) return unusable;

  const targetCard = cardOf(ctx.state, command.targetInstanceId);
  const targetIsEnemy =
    (targetCard?.type === "villain" && command.targetInstanceId === ctx.state.villain.instanceId) ||
    targetCard?.type === "minion";
  if (!targetIsEnemy) return engineError("no_valid_target", "basic attacks target enemies", command);
  if (!canAttack(ctx.state, command.attackerInstanceId, command.targetInstanceId)) {
    return engineError("no_valid_target", "a guard minion blocks attacks against the villain", command);
  }

  exhaustCard(ctx, command.attackerInstanceId);
  if (statusActive(ctx.state, command.attackerInstanceId, "stunned")) {
    // RRG "Stun": the attack is cancelled but its costs (exhausting) are still paid.
    updateInstance(ctx, command.attackerInstanceId, (i) => ({
      ...i,
      statuses: { ...i.statuses, stunned: 0 },
    }));
    emit(ctx, {
      type: "statusRemoved",
      instanceId: command.attackerInstanceId,
      status: "stunned",
      reason: "cancelledAttack",
    });
    return null;
  }
  if (!characterProfile(ctx.state, command.attackerInstanceId, ctx.deps)) {
    return engineError("unknown_instance", "attacker has no stats", command);
  }
  pushConsequentialDamage(ctx, command.attackerInstanceId, "attack");
  pushEvent(ctx, {
    kind: "attack",
    attackerInstanceId: command.attackerInstanceId,
    targetInstanceId: command.targetInstanceId,
    playerId: command.playerId,
  });
  return null;
}

export function basicThwart(ctx: Ctx, command: Command & { type: "basicThwart" }): EngineError | null {
  const invalid = requireActivePlayer(ctx.state, command.playerId, command);
  if (invalid) return invalid;
  const unusable = usableCharacter(ctx, command.playerId, command.thwarterInstanceId, command);
  if (unusable) return unusable;

  const schemeCard = cardOf(ctx.state, command.schemeInstanceId);
  const isMainScheme = command.schemeInstanceId === ctx.state.mainScheme.instanceId;
  const isSideScheme =
    (schemeCard?.type === "side_scheme" || schemeCard?.type === "player_side_scheme") &&
    ctx.state.villainArea.includes(command.schemeInstanceId);
  if (!isMainScheme && !isSideScheme) {
    return engineError("no_valid_target", "target is not a scheme in play", command);
  }
  // RRG "Crisis Icon": while any crisis icon is in play, player cards cannot remove threat from the main scheme.
  if (isMainScheme && countSchemeIcons(ctx.state, "crisis") > 0) {
    return engineError("no_valid_target", "a crisis icon blocks thwarting the main scheme", command);
  }

  const confused = statusActive(ctx.state, command.thwarterInstanceId, "confused");
  const scheme = mustInstance(ctx.state, command.schemeInstanceId);
  if (scheme.threat < 1 && !confused) {
    return engineError("no_valid_target", "scheme has no threat to remove", command);
  }

  exhaustCard(ctx, command.thwarterInstanceId);
  if (confused) {
    // RRG "Confuse": the thwart is cancelled but its costs are still paid.
    updateInstance(ctx, command.thwarterInstanceId, (i) => ({
      ...i,
      statuses: { ...i.statuses, confused: 0 },
    }));
    emit(ctx, {
      type: "statusRemoved",
      instanceId: command.thwarterInstanceId,
      status: "confused",
      reason: "cancelledSchemeOrThwart",
    });
    return null;
  }
  if (!characterProfile(ctx.state, command.thwarterInstanceId, ctx.deps)) {
    return engineError("unknown_instance", "thwarter has no stats", command);
  }
  pushConsequentialDamage(ctx, command.thwarterInstanceId, "thwart");
  pushEvent(ctx, {
    kind: "thwart",
    thwarterInstanceId: command.thwarterInstanceId,
    schemeInstanceId: command.schemeInstanceId,
    playerId: command.playerId,
  });
  return null;
}

export function basicRecover(ctx: Ctx, command: Command & { type: "basicRecover" }): EngineError | null {
  const invalid = requireActivePlayer(ctx.state, command.playerId, command);
  if (invalid) return invalid;
  const player = mustPlayer(ctx.state, command.playerId);
  if (player.identity.form !== "alterEgo") {
    return engineError("wrong_form", "recovery is an alter-ego power", command);
  }
  const identity = mustInstance(ctx.state, player.identity.instanceId);
  if (identity.exhausted) return engineError("already_exhausted", "identity is exhausted", command);
  if (identity.damage === 0) {
    return engineError("no_valid_target", "an identity with no damage cannot recover", command);
  }
  const profile = characterProfile(ctx.state, player.identity.instanceId, ctx.deps);
  if (!profile) return engineError("unknown_instance", "identity has no stats", command);
  exhaustCard(ctx, player.identity.instanceId);
  healDamage(ctx, player.identity.instanceId, profile.rec);
  return null;
}

export function endTurn(ctx: Ctx, command: Command & { type: "endTurn" }): EngineError | null {
  const invalid = requireActivePlayer(ctx.state, command.playerId, command);
  if (invalid) return invalid;
  const step = ctx.state.step;
  if (step.phase !== "player" || step.kind !== "turn") {
    return engineError("wrong_phase", "not in a player turn", command);
  }
  emit(ctx, { type: "turnEnded", playerId: command.playerId });
  advanceAfterTurn(ctx, step.remainingPlayerIds);
  return null;
}
