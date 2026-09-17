import { abilityId as asAbilityId, type AnyCard } from "@mc/content";
import {
  DEFAULT_DEPS,
  type AbilityCost,
  type AbilityDefinition,
  type AbilityTriggerSpec,
  type CostModifierSpec,
  type EngineDeps,
  type ResourceGeneration,
} from "./abilities.js";
import type { ChoiceOption } from "./choices.js";
import type { Command, CostChoices, Payment } from "./commands.js";
import { emit, moveCard, updateInstance, updatePlayer, type Ctx } from "./ctx.js";
import {
  consumeCostReductions,
  costReductionFor,
  discardFromHand,
  discardFromPlay,
  discardRandomFromHand,
  exhaustCard,
  healDamage,
  removeCounters,
  setForm,
} from "./effects.js";
import { engineError, type EngineError, type EngineErrorCode } from "./errors.js";
import { finishTurn } from "./flow.js";
import { statBonus } from "./modifiers.js";
import { cannotChangeForm, cannotLeavePlay, cannotThwart } from "./rules.js";
import type { InPlayCostPick } from "./abilities.js";
import type { TriggerEvent } from "./trigger-events.js";
import { instanceId as asInstanceId, type InstanceId, type PlayerId } from "./ids.js";
import { hasKeyword, statusActive } from "./keywords.js";
import {
  cardOf,
  cardZoneCandidates,
  characterProfile,
  countSchemeIcons,
  getCard,
  getInstance,
  getPlayer,
  isMinion,
  locateCard,
  mustCardOf,
  mustInstance,
  mustPlayer,
  villainOf,
} from "./query.js";
import { attachmentHostCandidates, heard, pushActionAbility, pushEvent, pushPlayCardFrame, recordAbilityUse } from "./resolve/index.js";
import { moveCardsTo } from "./resolve/cards.js";
import {
  addPools,
  combineRequirements,
  countUsableAs,
  EMPTY_POOL,
  poolOf,
  poolTotal,
  printedResources,
  RESOURCE_TYPES,
  requirementTotal,
  satisfies,
  scalePool,
  TYPED_RESOURCES,
  type ResourcePool,
  type ResourceRequirement,
} from "./resources.js";
import {
  activeAbilityRefs,
  canAttack,
  cardsInPlay,
  categoriesOf,
  controllerOf,
  evaluate,
  matchesQuery,
  printedAbilityRefs,
  resolveRef,
  resolveValue,
  restrictedCardsOf,
  traitsOf,
  type EffectContext,
} from "./select.js";
import type { Bindings, Vars } from "./stack.js";
import type { GameState } from "./state.js";
import { entersPlayWhenPlayed, matchingCardInPlay, uniqueBlockedMessage } from "./unique.js";

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
  if (cannotChangeForm(ctx.state, ctx.deps, command.playerId)) {
    return engineError("no_valid_target", "you cannot change form", command);
  }
  if (player.identity.changedFormThisRound) {
    return engineError("already_changed_form", "form may only be changed once each round", command);
  }
  const to = player.identity.form === "hero" ? "alterEgo" : "hero";
  // RRG "Form, Change Form": damage, status cards, tokens, and ready/exhausted state all persist.
  setForm(ctx, command.playerId, to, true);
  pushEvent(ctx, { kind: "formChanged", playerId: command.playerId, to });
  return null;
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export { printedResources };

/**
 * The constant abilities printed on a card, read wherever the card is. Only for text that works out of play by its
 * own wording: a hand card's "Spend this card only in hero form", the card being paid for's "You can only spend
 * [physical] resources", a discard pile card's "You may play Lockjaw from your discard pile".
 */
function printedConstants(state: GameState, deps: EngineDeps, id: InstanceId): readonly Extract<AbilityTriggerSpec, { kind: "constant" }>[] {
  const card = cardOf(state, id);
  if (!card) return [];
  return printedAbilityRefs(card).flatMap((ref) => {
    const trigger = deps.abilities[ref.id]?.trigger;
    return trigger?.kind === "constant" ? [trigger] : [];
  });
}

/** A card in a player's discard pile that its own permission lets them play from there. */
export const playableFromDiscard = (state: GameState, deps: EngineDeps, playerId: PlayerId, id: InstanceId): boolean =>
  mustPlayer(state, playerId).discard.includes(id) && printedConstants(state, deps, id).some((trigger) => trigger.playableFrom?.includes("discard"));

/**
 * The printed play restrictions the engine enforces beyond form, control and per-player/per-host maximums
 * (docs/phase7-wave1.md §1.8, §3.10): "Max N per round", "Play only if your identity has the [trait] trait", "Play only if
 * you control a [trait] character". Traits count whether printed or gained (RRG 1.8 "Gains").
 */
export function playRestrictionFault(state: GameState, deps: EngineDeps, playerId: PlayerId, card: AnyCard): PriceFault | null {
  const restrictions = "playRestrictions" in card ? card.playRestrictions : undefined;
  if (!restrictions) return null;
  // RRG 1.8 "Max, Maximum" (p. 28): across all copies by title, for all players.
  if (restrictions.maxPerRound !== undefined && (state.playedThisRound[card.name] ?? 0) >= restrictions.maxPerRound) {
    return { code: "limit_reached", message: `max ${restrictions.maxPerRound} per round` };
  }
  const player = mustPlayer(state, playerId);
  const required = restrictions.requiresIdentityTrait;
  if (required && !traitsOf(state, player.identity.instanceId, deps).includes(required)) {
    return { code: "no_valid_target", message: `play only if your identity has the ${required} trait` };
  }
  const characterTrait = restrictions.requiresControlledCharacterTrait;
  if (characterTrait) {
    const characters = [
      player.identity.instanceId,
      ...player.playArea.filter((id) => controllerOf(state, id) === playerId && categoriesOf(state, id).includes("character")),
    ];
    if (!characters.some((id) => traitsOf(state, id, deps).includes(characterTrait))) {
      return { code: "no_valid_target", message: `play only if you control a ${characterTrait} character` };
    }
  }
  return null;
}

/**
 * One card's text changing what another card costs, kept separate from the total so a client can *name* the card
 * doing it. A price that silently differs from the one printed on the card is a price the player cannot check:
 * "Mockingbird costs 2" is only trustworthy next to "because Steve Rogers is out".
 */
export interface PlayCostContribution {
  /** The card whose text moves the price: an in-play source, or the priced card itself for a hand-active constant. */
  readonly sourceInstanceId: InstanceId;
  /** Signed, and never 0 — a modifier that works out to nothing is not a contribution. */
  readonly delta: number;
}

/** Every `CostModifierSpec` that applies to playing this card now, one entry per source (see `CostModifierSpec`). */
export function playCostContributions(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  cardInstanceId: InstanceId,
  attachTo: InstanceId | null,
): readonly PlayCostContribution[] {
  const contributions: PlayCostContribution[] = [];
  const apply = (modifier: CostModifierSpec, sourceInstanceId: InstanceId, context: EffectContext): void => {
    if (!matchesQuery(state, cardInstanceId, modifier.appliesTo, context)) return;
    if (modifier.host && !(attachTo !== null && matchesQuery(state, attachTo, modifier.host, context))) return;
    if (modifier.while && !evaluate(state, modifier.while, context)) return;
    const delta = typeof modifier.delta === "number" ? modifier.delta : resolveValue(state, modifier.delta, context, deps);
    if (delta !== 0) contributions.push({ sourceInstanceId, delta });
  };
  for (const sourceId of cardsInPlay(state)) {
    // A card nobody controls in a player's area (an obligation) speaks for that player.
    const controllerId = controllerOf(state, sourceId) ?? state.players.find((p) => p.playArea.includes(sourceId))?.playerId ?? null;
    for (const ref of activeAbilityRefs(state, sourceId)) {
      const trigger = deps.abilities[ref.id]?.trigger;
      if (trigger?.kind !== "constant") continue;
      for (const modifier of trigger.costModifiers ?? []) {
        if (modifier.activeIn !== "hand") apply(modifier, sourceId, { selfInstanceId: sourceId, controllerId, event: null, bindings: {}, deps });
      }
    }
  }
  for (const trigger of printedConstants(state, deps, cardInstanceId)) {
    for (const modifier of trigger.costModifiers ?? []) {
      if (modifier.activeIn === "hand") {
        apply(modifier, cardInstanceId, { selfInstanceId: cardInstanceId, controllerId: playerId, event: null, bindings: {}, deps });
      }
    }
  }
  return contributions;
}

/** The signed change to a card's cost from every `CostModifierSpec` that applies to playing it now (see there). */
export function playCostModifier(state: GameState, deps: EngineDeps, playerId: PlayerId, cardInstanceId: InstanceId, attachTo: InstanceId | null): number {
  return playCostContributions(state, deps, playerId, cardInstanceId, attachTo).reduce((total, entry) => total + entry.delta, 0);
}

/** The additional cost on this character's own basic power, if it has one (`basicPowerCosts`). */
export function basicPowerCost(state: GameState, deps: EngineDeps, characterId: InstanceId, power: "attack" | "thwart"): AbilityCost | undefined {
  for (const ref of activeAbilityRefs(state, characterId)) {
    const trigger = deps.abilities[ref.id]?.trigger;
    if (trigger?.kind !== "constant") continue;
    const found = trigger.basicPowerCosts?.find((entry) => entry.power === power);
    if (found) return found.cost;
  }
  return undefined;
}

/** A hand card's resources, including "double … while paying for an [aspect] card" (The Power of X). */
export function handCardResources(
  state: GameState,
  deps: EngineDeps,
  cardInstanceId: InstanceId,
  playerId: PlayerId,
  payingFor: InstanceId | null,
): ResourcePool {
  const card = cardOf(state, cardInstanceId);
  if (!card) return EMPTY_POOL;
  const pool = printedResources(card);
  if (!payingFor) return pool;
  const context: EffectContext = { selfInstanceId: cardInstanceId, controllerId: playerId, event: null, bindings: {}, deps };
  for (const ref of printedAbilityRefs(card)) {
    const definition = deps.abilities[ref.id];
    if (definition?.trigger.kind !== "constant" || !definition.trigger.resourceMultiplier) continue;
    const { factor, whilePayingFor } = definition.trigger.resourceMultiplier;
    if (matchesQuery(state, payingFor, whilePayingFor, context)) return scalePool(pool, factor);
  }
  return pool;
}

/**
 * What a resource ability generates. `topCardOfDiscard` depends on the discard
 * pile as it stands when the ability is paid, so earlier cards in the same
 * payment change it; callers asking before a payment is built (the payment
 * query) can only be told what the current top card is worth.
 */
export function generatedResources(state: GameState, generation: ResourceGeneration | undefined, discardTop: InstanceId | null): ResourcePool {
  if (generation === undefined) return poolOf({ wild: 1 });
  if (typeof generation === "number") return poolOf({ wild: generation });
  if ("kind" in generation) {
    // Pepper Potts: "equal in quantity and type to the resources on the top card of the discard pile" (FFG ruling).
    const top = discardTop ? cardOf(state, discardTop) : undefined;
    return top ? printedResources(top) : EMPTY_POOL;
  }
  return poolOf(generation);
}

interface PriceFault {
  readonly code: EngineErrorCode;
  readonly message: string;
}

const isFault = (value: object): value is PriceFault => "code" in value;

function resourceAbilityFault(
  state: GameState,
  deps: EngineDeps,
  instanceId: InstanceId,
  abilityId: string,
  playerId: PlayerId,
  payingFor: InstanceId | null,
): PriceFault | null {
  const definition = deps.abilities[abilityId];
  if (!definition || definition.trigger.kind !== "resource") {
    return { code: "no_valid_target", message: `${abilityId} is not a resource ability` };
  }
  if (!activeAbilityRefs(state, instanceId).some((ref) => ref.id === abilityId)) {
    return { code: "no_valid_target", message: `${abilityId} is not active on ${instanceId}` };
  }
  if (controllerOf(state, instanceId) !== playerId) {
    return { code: "no_valid_target", message: "resource abilities must be on cards you control" };
  }
  const form = definition.trigger.form;
  if (form && getPlayer(state, playerId)?.identity.form !== form) {
    return { code: "wrong_form", message: `${abilityId} requires ${form} form` };
  }
  if (definition.limit && (state.abilityUses[`${instanceId}:${abilityId}`] ?? 0) >= definition.limit.count) {
    return { code: "limit_reached", message: `${abilityId} has reached its limit` };
  }
  // "Generate a [wild] resource for an event": only while paying for a matching card.
  if (definition.generatesFor) {
    const context: EffectContext = { selfInstanceId: instanceId, controllerId: playerId, event: null, bindings: {}, deps };
    if (payingFor === null || !matchesQuery(state, payingFor, definition.generatesFor, context)) {
      return { code: "no_valid_target", message: `${abilityId} only generates resources for a certain kind of card` };
    }
  }
  const plan = planCost(state, deps, instanceId, playerId, definition.cost, {}, new Set());
  return isFault(plan) ? plan : null;
}

/**
 * RRG "Cost": resources come from cards discarded from hand and from "Resource"
 * abilities. Overpaying is legal; the excess is simply lost. Payments are
 * evaluated in order, so "the top card of your discard pile" sees any card
 * discarded earlier in the same payment.
 */
function priceOf(
  ctx: Ctx,
  playerId: PlayerId,
  payment: readonly Payment[],
  excludeInstanceId: InstanceId | null,
  payingFor: InstanceId | null,
): ResourcePool | PriceFault {
  const player = mustPlayer(ctx.state, playerId);
  const seen = new Set<string>();
  let discardTop: InstanceId | null = player.discard[0] ?? null;
  let pool = EMPTY_POOL;
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
      if (!cardOf(ctx.state, entry.fromHand)) return { code: "unknown_card", message: `no card data for ${entry.fromHand}` };
      // "Spend this card only in hero form."
      const spendableIn = printedConstants(ctx.state, ctx.deps, entry.fromHand).find((trigger) => trigger.spendableIn)?.spendableIn;
      if (spendableIn && player.identity.form !== spendableIn) {
        return { code: "wrong_form", message: `${mustCardOf(ctx.state, entry.fromHand).name} can only be spent in ${spendableIn} form` };
      }
      pool = addPools(pool, handCardResources(ctx.state, ctx.deps, entry.fromHand, playerId, payingFor));
      discardTop = entry.fromHand;
      continue;
    }
    const { instanceId, abilityId } = entry.ability;
    const key = `ability:${instanceId}:${abilityId}`;
    if (seen.has(key)) return { code: "insufficient_resources", message: "duplicate resource ability" };
    seen.add(key);
    const fault = resourceAbilityFault(ctx.state, ctx.deps, instanceId, abilityId, playerId, payingFor);
    if (fault) return fault;
    pool = addPools(pool, generatedResources(ctx.state, ctx.deps.abilities[abilityId]?.generates, discardTop));
  }
  // "You can only spend [physical] resources to pay for this card." A wild can be declared as that type; a cost of 0
  // needs no resources at all (FAQ "Crushing Blow (#2)", p. 60).
  const only = payingFor ? printedConstants(ctx.state, ctx.deps, payingFor).flatMap((trigger) => trigger.paymentOnly ?? []) : [];
  if (only.length > 0 && TYPED_RESOURCES.some((type) => !only.includes(type) && pool[type] > 0)) {
    return { code: "insufficient_resources", message: `only ${only.join(" / ")} resources can pay for this card` };
  }
  return pool;
}

/** The resource pool a payment is worth, or null if it is not a legal payment at all. */
export function priceOrNull(
  ctx: Ctx,
  playerId: PlayerId,
  payment: readonly Payment[],
  excludeInstanceId: InstanceId | null,
  payingFor: InstanceId | null = excludeInstanceId,
): ResourcePool | null {
  const priced = priceOf(ctx, playerId, payment, excludeInstanceId, payingFor);
  return isFault(priced) ? null : priced;
}

/** Every resource a player could spend right now, as fully described choice options. */
export function paymentOptions(
  ctx: Ctx,
  playerId: PlayerId,
  excludeInstanceId: InstanceId | null,
): readonly ChoiceOption[] {
  const options: ChoiceOption[] = [];
  const form = mustPlayer(ctx.state, playerId).identity.form;
  for (const id of mustPlayer(ctx.state, playerId).hand) {
    if (id === excludeInstanceId) continue;
    const spendableIn = printedConstants(ctx.state, ctx.deps, id).find((trigger) => trigger.spendableIn)?.spendableIn;
    if (spendableIn && spendableIn !== form) continue;
    options.push({
      optionId: `hand:${id}`,
      label: mustCardOf(ctx.state, id).name,
      ref: { kind: "card", instanceId: id },
    });
  }
  for (const id of cardsInPlay(ctx.state)) {
    if (controllerOf(ctx.state, id) !== playerId) continue;
    for (const ref of activeAbilityRefs(ctx.state, id)) {
      if (ctx.deps.abilities[ref.id]?.trigger.kind !== "resource") continue;
      if (resourceAbilityFault(ctx.state, ctx.deps, id, ref.id, playerId, excludeInstanceId)) continue;
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
    const generated = generatedResources(
      ctx.state,
      definition.generates,
      mustPlayer(ctx.state, playerId).discard[0] ?? null,
    );
    const plan = planCost(ctx.state, ctx.deps, instanceId, playerId, definition.cost, {}, new Set());
    if (!isFault(plan)) payCost(ctx, instanceId, playerId, definition.cost, plan);
    recordAbilityUse(ctx, instanceId, abilityId, definition);
    emit(ctx, {
      type: "resourcesGenerated",
      playerId,
      instanceId,
      abilityId,
      amount: poolTotal(generated),
      pool: generated,
    });
  }
}

/**
 * Cards a payment already uses: hand cards it discards and cards whose resource ability it uses. A hand card can't also
 * be picked for a "discard N cards" cost, and an in-play card can't also pay an `InPlayCostPick` (RRG 1.8 "Cost", p. 13).
 */
const handCardsIn = (payment: readonly Payment[]): ReadonlySet<InstanceId> =>
  new Set(payment.map((entry) => ("fromHand" in entry ? entry.fromHand : entry.ability.instanceId)));

// ---------------------------------------------------------------------------
// Non-resource costs
// ---------------------------------------------------------------------------

/** A cost, checked and resolved into what paying it will bind — nothing is paid yet. */
export interface CostPlan {
  /** Resources the payment must cover for this cost (card cost excluded). */
  readonly requirement: Required<ResourceRequirement>;
  readonly bindings: Bindings;
  readonly vars: Vars;
  /** The card resources are being spent on, for "while paying for an [aspect] card". */
  readonly payingFor: InstanceId | null;
}

const NO_REQUIREMENT: Required<ResourceRequirement> = { generic: 0, physical: 0, mental: 0, energy: 0 };

function zoneMatches(
  state: GameState,
  id: InstanceId,
  playerId: PlayerId,
  from: NonNullable<AbilityCost["payPrintedCostOf"]>["from"],
): boolean {
  const zone = locateCard(state, id);
  if (!zone || zone.kind !== from.zone) return false;
  if (from.player === "you" && "playerId" in zone && zone.playerId !== playerId) return false;
  if (zone.kind === "separateDeck" && zone.name !== from.separateDeck) return false;
  // "The top card of …": only the first `top` cards of that player's zone.
  if (from.top !== undefined && "playerId" in zone && !cardZoneCandidates(state, from, zone.playerId).includes(id)) return false;
  if (!from.query) return true;
  const context: EffectContext = { selfInstanceId: null, controllerId: playerId, event: null, bindings: {} };
  return matchesQuery(state, id, from.query, context);
}

/**
 * Checks every non-resource component of a cost and binds what it produces.
 * `reserved` holds hand cards already committed to the resource payment.
 */
export function planCost(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  cost: AbilityCost | undefined,
  choices: CostChoices,
  reserved: ReadonlySet<InstanceId>,
): CostPlan | PriceFault {
  if (!cost) return { requirement: NO_REQUIREMENT, bindings: {}, vars: {}, payingFor: null };
  const source = getInstance(state, sourceId);
  if (!source) return { code: "unknown_instance", message: `no instance ${sourceId}` };
  const player = mustPlayer(state, playerId);
  const identity = mustInstance(state, player.identity.instanceId);
  const bindings: Record<string, readonly InstanceId[]> = {};
  const vars: Record<string, number> = {};
  let requirement = combineRequirements(cost.resources, 0);
  let payingFor: InstanceId | null = null;

  if (cost.exhaustSelf && source.exhausted) return { code: "already_exhausted", message: "the card is already exhausted" };
  if (cost.spendCounters && (source.counters[cost.spendCounters.counterType] ?? 0) < cost.spendCounters.amount) {
    return { code: "insufficient_resources", message: `not enough ${cost.spendCounters.counterType} counters` };
  }
  if (cost.exhaustIdentity && identity.exhausted) {
    return { code: "already_exhausted", message: "your identity is already exhausted" };
  }
  // A heal cost can only be paid if there is that much damage to heal (RRG "Cost": costs are paid in full).
  if (cost.healIdentity !== undefined && identity.damage < cost.healIdentity) {
    return { code: "insufficient_resources", message: "not enough damage to heal as a cost" };
  }
  if ((cost.discardSelf || cost.damageThisCard !== undefined) && !cardsInPlay(state).includes(sourceId)) {
    return { code: "card_not_in_zone", message: "the card must be in play to pay this cost" };
  }
  if (cost.discardSelf) {
    for (const [counterType, amount] of Object.entries(source.counters)) vars[`self.counters.${counterType}`] = amount;
    // "For each threat here" after "discard Beat Cop →": leaving play clears threat and damage (`leavePlay`).
    vars["self.threat"] = source.threat;
    vars["self.damage"] = source.damage;
  }
  if (cost.discardFromHand) {
    const picks = choices.discard ?? [];
    const { min, max, bind } = cost.discardFromHand;
    if (picks.length < min || (max !== undefined && picks.length > max)) {
      return { code: "invalid_choice", message: `discard ${min}–${max ?? "any number of"} cards to pay this cost` };
    }
    for (const id of picks) {
      if (!player.hand.includes(id) || id === sourceId || reserved.has(id)) {
        return { code: "card_not_in_zone", message: `${id} cannot be discarded from hand for this cost` };
      }
    }
    if (new Set(picks).size !== picks.length) return { code: "invalid_choice", message: "duplicate discard choice" };
    bindings.discard = picks;
    if (bind) vars[bind] = picks.length;
  }
  if (cost.discardRandomFromHand !== undefined) {
    // Picked when paid (`payCost`); here only whether enough cards are left once the payment and chosen discards are out.
    const chosen = new Set(bindings.discard ?? []);
    const left = player.hand.filter((id) => id !== sourceId && !reserved.has(id) && !chosen.has(id)).length;
    if (left < cost.discardRandomFromHand) {
      return { code: "card_not_in_zone", message: `discard ${cost.discardRandomFromHand} card(s) at random from your hand to pay this cost` };
    }
  }
  if (cost.payPrintedCostOf) {
    const { slot, from, entersPlay } = cost.payPrintedCostOf;
    const [pick, ...extra] = choices[slot] ?? [];
    if (!pick || extra.length > 0) return { code: "invalid_choice", message: `choose exactly one card for ${slot}` };
    if (!zoneMatches(state, pick, playerId, from)) {
      return { code: "no_valid_target", message: `${pick} is not a legal choice for ${slot}` };
    }
    const card = cardOf(state, pick);
    /**
     * The ability will put this card into play, so a card that RRG "Unique Icon" forbids
     * from entering play is not a valid target and the ability cannot be initiated (RRG
     * "Target": an ability "can only be initiated if it has at least one valid target";
     * RRG "Choose (Game Element)": with no valid target "the ability cannot be initiated").
     *
     * UNCONFIRMED READING. The RRG settles the *resolution* — "any effect that attempts to
     * do so has no effect" — but not whether the attempt is legal to make in the first
     * place. Read literally, a player could pay Make the Call's cost and get nothing. This
     * engine refuses the pick instead, because that is what the targeting rules say and
     * because it lets `legalActions` grey the card rather than let a player burn resources.
     * No FFG ruling found either way as of 2026-09-12; see the report for the open question.
     */
    if (entersPlay && card) {
      const match = matchingCardInPlay(state, card, new Set([pick]));
      if (match) {
        return { code: "duplicate_unique_card", message: uniqueBlockedMessage(card, mustCardOf(state, match)) };
      }
    }
    const printed = card && "cost" in card ? card.cost : 0;
    requirement = combineRequirements(requirement, printed);
    bindings[slot] = [pick];
    payingFor = pick;
  }
  // Costs paid with cards in play: "exhaust Captain America's Shield →", "exhaust any number of allies you control →",
  // "return Captain America's Shield from play to your hand →" (`InPlayCostPick`).
  const exhausting = cost.exhaustCards ? planInPlayPick(state, deps, sourceId, playerId, "exhaust", cost.exhaustCards, choices) : [];
  if (isFault(exhausting)) return exhausting;
  const returning = cost.returnToHand ? planInPlayPick(state, deps, sourceId, playerId, "return", cost.returnToHand, choices) : [];
  if (isFault(returning)) return returning;
  // RRG 1.8 "Cost" (p. 13): a cost's components are paid simultaneously, so one card can't pay two of them. It can't
  // be exhausted twice, exhausted and also returned, or picked here and also exhausted for a resource in the payment.
  const spentInPlay = [...(cost.exhaustSelf ? [sourceId] : []), ...(cost.exhaustIdentity ? [identity.instanceId] : []), ...exhausting, ...returning];
  if (new Set(spentInPlay).size !== spentInPlay.length || [...exhausting, ...returning].some((id) => reserved.has(id))) {
    return { code: "invalid_choice", message: "one card cannot pay two parts of a cost" };
  }
  if (cost.exhaustCards) bindInPlayPick(cost.exhaustCards, exhausting, bindings, vars);
  if (cost.returnToHand) bindInPlayPick(cost.returnToHand, returning, bindings, vars);
  return { requirement, bindings, vars, payingFor };
}

function bindInPlayPick(pick: InPlayCostPick, picks: readonly InstanceId[], bindings: Record<string, readonly InstanceId[]>, vars: Record<string, number>): void {
  bindings[pick.slot] = picks;
  if (pick.bind) vars[pick.bind] = picks.length;
}

/**
 * The cards in play that could pay an `InPlayCostPick`, in play-area order: controlled by the paying player, matching
 * the query, and still able to pay (ready to exhaust, or able to leave play to return).
 */
export function inPlayCostCandidates(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  mode: "exhaust" | "return",
  pick: InPlayCostPick,
): readonly InstanceId[] {
  return eligibleForInPlayPick(state, deps, sourceId, playerId, pick).filter((id) => canPayInPlayPick(state, deps, id, mode));
}

function eligibleForInPlayPick(state: GameState, deps: EngineDeps, sourceId: InstanceId, playerId: PlayerId, pick: InPlayCostPick): readonly InstanceId[] {
  const context: EffectContext = { selfInstanceId: sourceId, controllerId: playerId, event: null, bindings: {}, deps };
  return cardsInPlay(state).filter((id) => controllerOf(state, id) === playerId && matchesQuery(state, id, pick.query, context));
}

function canPayInPlayPick(state: GameState, deps: EngineDeps, id: InstanceId, mode: "exhaust" | "return"): boolean {
  const instance = mustInstance(state, id);
  // Returning goes to the owner's hand (RRG 1.8 "Ownership and Control", p. 30); a card with no owning player can't go there.
  return mode === "exhaust" ? !instance.exhausted : instance.ownerId !== null && !cannotLeavePlay(state, deps, id);
}

/** Checks an `InPlayCostPick` against the command's picks (or the forced pick) without paying anything. */
function planInPlayPick(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  mode: "exhaust" | "return",
  pick: InPlayCostPick,
  choices: CostChoices,
): readonly InstanceId[] | PriceFault {
  const verb = mode === "exhaust" ? "exhaust" : "return to hand";
  const eligible = eligibleForInPlayPick(state, deps, sourceId, playerId, pick);
  const candidates = eligible.filter((id) => canPayInPlayPick(state, deps, id, mode));
  const whyNot = (id: InstanceId): PriceFault =>
    !eligible.includes(id)
      ? { code: "no_valid_target", message: `${id} is not a card in play you control that can pay ${pick.slot}` }
      : mode === "exhaust"
        ? { code: "already_exhausted", message: `${id} is already exhausted` }
        : { code: "no_valid_target", message: `${id} cannot leave play` };
  // RRG 1.8 "Initiating Abilities" (p. 24, steps 3 and 5): a cost that can't be paid in full can't be initiated.
  if (candidates.length < pick.min) {
    // Enough matching cards, but some are exhausted (or can't leave play): say that, rather than "no card".
    const blocked = eligible.find((id) => !candidates.includes(id));
    return blocked && eligible.length >= pick.min
      ? whyNot(blocked)
      : { code: "no_valid_target", message: `not enough cards you control to ${verb} for this cost` };
  }
  // No picks given: pay only a forced choice (exactly `min` candidates); otherwise the choice is the player's.
  const picks = choices[pick.slot] ?? (candidates.length === pick.min ? candidates : undefined);
  if (!picks) return { code: "invalid_choice", message: `choose which cards to ${verb} for ${pick.slot}` };
  if (picks.length < pick.min || (pick.max !== undefined && picks.length > pick.max)) {
    return { code: "invalid_choice", message: `${verb} ${pick.min}–${pick.max ?? "any number of"} cards to pay this cost` };
  }
  if (new Set(picks).size !== picks.length) return { code: "invalid_choice", message: `duplicate choice for ${pick.slot}` };
  const bad = picks.find((id) => !candidates.includes(id));
  return bad ? whyNot(bad) : picks;
}

/** "Spend X [type] resources": binds X from the pool beyond the cost's fixed requirement. */
function resourceVars(
  pool: ResourcePool,
  cost: AbilityCost | undefined,
  requirement: Required<ResourceRequirement>,
): Vars | PriceFault {
  const vars: Record<string, number> = {
    "paid.physical": pool.physical,
    "paid.mental": pool.mental,
    "paid.energy": pool.energy,
    "paid.wild": pool.wild,
    "paid.total": poolTotal(pool),
  };
  if (cost?.resourcesX) {
    const x = Math.max(0, countUsableAs(pool, cost.resourcesX.resource) - requirementTotal(requirement));
    if (x < (cost.resourcesX.min ?? 0)) return { code: "insufficient_resources", message: "X is too small" };
    vars[cost.resourcesX.bind] = x;
  }
  if (cost?.distinctResourceTypes !== undefined) {
    // Each typed resource present is one type; each wild can stand for a type not otherwise present.
    const typed = TYPED_RESOURCES.filter((type) => pool[type] > 0).length;
    const distinct = typed + Math.min(pool.wild, RESOURCE_TYPES.length - typed);
    if (distinct < cost.distinctResourceTypes) {
      return { code: "insufficient_resources", message: `spend ${cost.distinctResourceTypes} resources of different types` };
    }
  }
  return vars;
}

/**
 * Pays the non-resource components of a planned cost. Damage taken as a cost
 * is pushed as damage events, so callers push the ability's own frame first:
 * the cost damage then resolves before the ability's effects.
 */
export function payCost(
  ctx: Ctx,
  sourceId: InstanceId,
  playerId: PlayerId,
  cost: AbilityCost | undefined,
  plan: CostPlan,
): void {
  if (!cost) return;
  const identityId = mustPlayer(ctx.state, playerId).identity.instanceId;
  if (cost.exhaustSelf) exhaustCard(ctx, sourceId);
  if (cost.spendCounters) removeCounters(ctx, sourceId, cost.spendCounters.counterType, cost.spendCounters.amount);
  if (cost.exhaustIdentity) exhaustCard(ctx, identityId);
  if (cost.healIdentity) healDamage(ctx, identityId, cost.healIdentity);
  for (const id of plan.bindings.discard ?? []) discardFromHand(ctx, playerId, id);
  // After the payment and the chosen discards have left the hand, so the random pick is among what remains.
  if (cost.discardRandomFromHand) discardRandomFromHand(ctx, playerId, cost.discardRandomFromHand, [sourceId]);
  if (cost.damageSelf) {
    pushEvent(ctx, { kind: "dealDamage", targetInstanceId: identityId, amount: cost.damageSelf, sourceInstanceId: sourceId, fromAttack: false });
  }
  if (cost.damageThisCard) {
    pushEvent(ctx, { kind: "dealDamage", targetInstanceId: sourceId, amount: cost.damageThisCard, sourceInstanceId: sourceId, fromAttack: false });
  }
  if (cost.discardSelf && getInstance(ctx.state, sourceId)) discardFromPlay(ctx, sourceId);
  if (cost.exhaustCards) {
    for (const id of plan.bindings[cost.exhaustCards.slot] ?? []) exhaustCard(ctx, id);
  }
  if (cost.returnToHand) moveCardsTo(ctx, plan.bindings[cost.returnToHand.slot] ?? [], "hand");
}

// ---------------------------------------------------------------------------
// Playing cards and using abilities
// ---------------------------------------------------------------------------

/** The action ability an event resolves when played from hand, if it has one. */
export function eventActionAbility(ctx: Ctx, card: AnyCard): AbilityDefinition | undefined {
  if (card.type !== "event") return undefined;
  for (const ref of printedAbilityRefs(card)) {
    const definition = ctx.deps.abilities[ref.id];
    if (definition?.trigger.kind === "action") return definition;
  }
  return undefined;
}

/**
 * What playing a card demands: its printed cost less any "reduce the cost of
 * the next card" effect, plus its own ability's cost.
 */
export function playRequirement(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: InstanceId,
  abilityRequirement: Required<ResourceRequirement>,
  deps: EngineDeps = DEFAULT_DEPS,
  attachTo: InstanceId | null = null,
): Required<ResourceRequirement> {
  const card = mustCardOf(state, cardInstanceId);
  const printed = "cost" in card ? card.cost : 0;
  const modified = Math.max(0, printed + playCostModifier(state, deps, playerId, cardInstanceId, attachTo));
  return combineRequirements(Math.max(0, modified - costReductionFor(state, deps, playerId, cardInstanceId)), abilityRequirement);
}

/**
 * What a card in hand costs *right now*, beside what is printed on it, and which cards moved the price.
 *
 * `playRequirement` already computes this, but folds it into a `ResourceRequirement` alongside the card's own
 * ability cost ("Spend 1 [energy] →"), which is a different question from "does this card cost what it says".
 * A client showing a card face has to answer that second question on its own: the scan prints 3, the engine
 * charges 2, and nothing on the table explains the gap unless the price carries its reasons with it.
 *
 * Read-only. `contributions` lists constant `costModifier`s by source card; `reduction` is the "reduce the cost
 * of the next card you play" total waiting on this card (`costReductionFor`), which carries no source card of
 * its own. Both are already applied to `current`.
 */
export interface PlayCost {
  readonly printed: number;
  /** Never below 0, and floored the same way `playRequirement` floors it: after modifiers, then after reductions. */
  readonly current: number;
  readonly contributions: readonly PlayCostContribution[];
  /** The pending "next card" reduction this card consumes, as a positive number. */
  readonly reduction: number;
}

/** Prices playing `cardInstanceId` as it stands. Null for a card with no printed cost (a resource card). */
export function playCostOf(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: InstanceId,
  deps: EngineDeps = DEFAULT_DEPS,
  attachTo: InstanceId | null = null,
): PlayCost | null {
  const card = cardOf(state, cardInstanceId);
  if (!card || !("cost" in card) || typeof card.cost !== "number") return null;
  const contributions = playCostContributions(state, deps, playerId, cardInstanceId, attachTo);
  const modified = Math.max(0, card.cost + contributions.reduce((total, entry) => total + entry.delta, 0));
  const reduction = costReductionFor(state, deps, playerId, cardInstanceId);
  return { printed: card.cost, current: Math.max(0, modified - reduction), contributions, reduction };
}

export interface PricedPlay {
  readonly pool: ResourcePool;
  readonly plan: CostPlan;
  readonly vars: Vars;
}

/**
 * Prices playing a card: its printed cost (less any "reduce the cost of the
 * next card" effects) plus its ability's cost, paid from `payment`.
 */
export function pricePlay(
  ctx: Ctx,
  playerId: PlayerId,
  cardInstanceId: InstanceId,
  cost: AbilityCost | undefined,
  payment: readonly Payment[],
  choices: CostChoices,
  attachTo: InstanceId | null = null,
): PricedPlay | PriceFault {
  const plan = planCost(ctx.state, ctx.deps, cardInstanceId, playerId, cost, choices, handCardsIn(payment));
  if (isFault(plan)) return plan;
  const requirement = playRequirement(ctx.state, playerId, cardInstanceId, plan.requirement, ctx.deps, attachTo);
  const pool = priceOf(ctx, playerId, payment, cardInstanceId, plan.payingFor ?? cardInstanceId);
  if (isFault(pool)) return pool;
  if (!satisfies(pool, requirement)) {
    return { code: "insufficient_resources", message: `need ${requirementTotal(requirement)} (${JSON.stringify(requirement)}), paid ${poolTotal(pool)}` };
  }
  const vars = resourceVars(pool, cost, requirement);
  if (isFault(vars)) return vars;
  return { pool, plan, vars: { ...plan.vars, ...vars } };
}

/** Pays for a priced play and records it; the caller pushes the play frame. */
export function commitPlay(ctx: Ctx, playerId: PlayerId, cardInstanceId: InstanceId, payment: readonly Payment[], priced: PricedPlay): void {
  consumeCostReductions(ctx, ctx.deps, playerId, cardInstanceId);
  payPayment(ctx, playerId, payment);
  // Counted as played now, so a card cancelled later still counts toward "Max N per round" (RRG 1.8 "Max, Maximum").
  const played = mustCardOf(ctx.state, cardInstanceId);
  const byPlayer = `${playerId}:${played.type}`;
  ctx.state = {
    ...ctx.state,
    playedThisRound: { ...ctx.state.playedThisRound, [played.name]: (ctx.state.playedThisRound[played.name] ?? 0) + 1 },
    playedByPlayerThisRound: { ...ctx.state.playedByPlayerThisRound, [byPlayer]: (ctx.state.playedByPlayerThisRound[byPlayer] ?? 0) + 1 },
  };
  emit(ctx, {
    type: "cardPlayed",
    playerId,
    instanceId: cardInstanceId,
    cardId: mustInstance(ctx.state, cardInstanceId).cardId,
    resourcesPaid: poolTotal(priced.pool),
    paid: priced.pool,
  });
  // RRG "Event": a played event is out of play while it resolves, then it is discarded.
  if (cardOf(ctx.state, cardInstanceId)?.type === "event") moveCard(ctx, cardInstanceId, { kind: "resolving", playerId });
}

export function playCard(ctx: Ctx, command: Command & { type: "playCard" }): EngineError | null {
  const invalid = requireActivePlayer(ctx.state, command.playerId, command);
  if (invalid) return invalid;
  const player = mustPlayer(ctx.state, command.playerId);
  if (!player.hand.includes(command.cardInstanceId) && !playableFromDiscard(ctx.state, ctx.deps, command.playerId, command.cardInstanceId)) {
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
  const ability = eventActionAbility(ctx, card);
  // RRG "Event": an event's own ability says when it is played. An interrupt or
  // response event is played only from the window its trigger opens, never as an action.
  const windowOnly =
    card.type === "event" &&
    !ability &&
    printedAbilityRefs(card).some((ref) => {
      const kind = ctx.deps.abilities[ref.id]?.trigger.kind;
      return kind === "interrupt" || kind === "response";
    });
  if (windowOnly) {
    return engineError("card_type_not_playable", "this event can only be played when its interrupt or response triggers", command);
  }
  if (card.type === "event" && ability?.trigger.kind === "action" && ability.trigger.form && player.identity.form !== ability.trigger.form) {
    return engineError("wrong_form", `this event requires ${ability.trigger.form} form`, command);
  }

  // RRG "Restricted": a player cannot control more than two at a time, so playing
  // a third is not a legal action in the first place.
  if (hasKeyword(ctx.state, command.cardInstanceId, "restricted", ctx.deps) && restrictedCardsOf(ctx.state, command.playerId, ctx.deps).length >= 2) {
    return engineError("no_valid_target", "you already control two restricted cards", command);
  }

  // "Play under any player's control": the command may name another player as controller.
  const controllerId = command.controllerId ?? command.playerId;
  const controller = getPlayer(ctx.state, controllerId);
  if (!controller || controller.eliminated) return engineError("no_valid_target", "no such player to control the card", command);
  const restrictions = "playRestrictions" in card ? card.playRestrictions : undefined;
  if (controllerId !== command.playerId && !restrictions?.anyPlayerControl) {
    return engineError("no_valid_target", "this card can only be played under your own control", command);
  }
  // "Hero form only" / "Alter-Ego form only" (RRG "Form, Change Form").
  if (restrictions?.form && player.identity.form !== restrictions.form) {
    return engineError("wrong_form", `this card can only be played in ${restrictions.form} form`, command);
  }
  // "Max N per player": copies (same title) already in play under that player's control.
  if (restrictions?.maxPerPlayer !== undefined) {
    const held = cardsInPlay(ctx.state).filter(
      (id) => controllerOf(ctx.state, id) === controllerId && cardOf(ctx.state, id)?.name === card.name,
    ).length;
    if (held >= restrictions.maxPerPlayer) return engineError("no_valid_target", `max ${restrictions.maxPerPlayer} per player`, command);
  }
  const restricted = playRestrictionFault(ctx.state, ctx.deps, command.playerId, card);
  if (restricted) return engineError(restricted.code, restricted.message, command);

  /**
   * RRG 1.8 "Unique Icon" (pp. 45–46): "A non-villain card in an out-of-play state that
   * matches a card in play cannot enter play. If the out-of-play card is [...] a player
   * card, it cannot be played or put into play."
   *
   * Deliberately *not* `playRestrictions.maxPerPlayer` above: that is the printed "Max 1
   * per player" text, scoped to one controller. This is the group-wide unique rule, so it
   * scans every card in play regardless of who controls it. Checked before pricing so a
   * refused play costs nothing.
   */
  if (entersPlayWhenPlayed(card)) {
    const match = matchingCardInPlay(ctx.state, card);
    if (match) {
      return engineError("duplicate_unique_card", uniqueBlockedMessage(card, mustCardOf(ctx.state, match)), command);
    }
  }

  let attachTo: InstanceId | null = null;
  if (card.type === "upgrade") {
    const ownIdentity = controller.identity.instanceId;
    attachTo = command.attachToInstanceId ?? (card.attachesTo ? null : ownIdentity);
    if (!attachTo || !getInstance(ctx.state, attachTo)) {
      return engineError("no_valid_target", "upgrade has no valid host", command);
    }
    if (card.attachesTo) {
      const context: EffectContext = { selfInstanceId: command.cardInstanceId, controllerId, event: null, bindings: {}, deps: ctx.deps };
      if (!attachmentHostCandidates(ctx.state, card.attachesTo, context).includes(attachTo)) {
        return engineError("no_valid_target", `upgrade must attach to ${card.attachesTo.kind}`, command);
      }
    } else if (attachTo !== ownIdentity) {
      return engineError("no_valid_target", "this upgrade attaches to your identity", command);
    }
    // "Max N per enemy/ally": copies already attached to that host.
    if (restrictions?.maxPerHost !== undefined) {
      const onHost = mustInstance(ctx.state, attachTo).attachments.filter((id) => cardOf(ctx.state, id)?.name === card.name).length;
      if (onHost >= restrictions.maxPerHost) return engineError("no_valid_target", `max ${restrictions.maxPerHost} per host`, command);
    }
  }

  const priced = pricePlay(ctx, command.playerId, command.cardInstanceId, ability?.cost, command.payment, command.costChoices ?? {}, attachTo);
  if (isFault(priced)) return engineError(priced.code, priced.message, command);

  commitPlay(ctx, command.playerId, command.cardInstanceId, command.payment, priced);
  pushPlayCardFrame(
    ctx,
    command.cardInstanceId,
    command.playerId,
    attachTo,
    undefined,
    { bindings: priced.plan.bindings, vars: priced.vars },
    controllerId,
  );
  payCost(ctx, command.cardInstanceId, command.playerId, ability?.cost, priced.plan);
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
  const plan = planCost(
    ctx.state,
    ctx.deps,
    command.cardInstanceId,
    command.playerId,
    definition.cost,
    command.costChoices ?? {},
    handCardsIn(command.payment),
  );
  if (isFault(plan)) return engineError(plan.code, plan.message, command);
  const pool = priceOf(ctx, command.playerId, command.payment, null, plan.payingFor);
  if (isFault(pool)) return engineError(pool.code, pool.message, command);
  if (!satisfies(pool, plan.requirement)) {
    return engineError("insufficient_resources", `need ${requirementTotal(plan.requirement)}, paid ${poolTotal(pool)}`, command);
  }
  const vars = resourceVars(pool, definition.cost, plan.requirement);
  if (isFault(vars)) return engineError(vars.code, vars.message, command);

  payPayment(ctx, command.playerId, command.payment);
  pushActionAbility(ctx, command.cardInstanceId, command.abilityId, command.playerId, plan.bindings, {
    ...plan.vars,
    ...vars,
  });
  payCost(ctx, command.cardInstanceId, command.playerId, definition.cost, plan);
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

/** Plans, prices and pays a basic power's additional cost (`basicPowerCosts`); the error when it cannot be paid. */
function payBasicPowerCost(
  ctx: Ctx,
  command: Command & { type: "basicAttack" | "basicThwart" },
  characterId: InstanceId,
  power: "attack" | "thwart",
): EngineError | null {
  const cost = basicPowerCost(ctx.state, ctx.deps, characterId, power);
  if (!cost) return null;
  const payment = command.payment ?? [];
  const plan = planCost(ctx.state, ctx.deps, characterId, command.playerId, cost, command.costChoices ?? {}, handCardsIn(payment));
  if (isFault(plan)) return engineError(plan.code, plan.message, command);
  const pool = priceOf(ctx, command.playerId, payment, null, null);
  if (isFault(pool)) return engineError(pool.code, pool.message, command);
  if (!satisfies(pool, plan.requirement)) {
    return engineError("insufficient_resources", `need ${requirementTotal(plan.requirement)}, paid ${poolTotal(pool)}`, command);
  }
  payPayment(ctx, command.playerId, payment);
  payCost(ctx, characterId, command.playerId, cost, plan);
  return null;
}

/** RRG "Consequential Damage": tier 5 of the timing chart, after the attack fully resolves. */
function pushConsequentialDamage(ctx: Ctx, characterId: InstanceId, kind: "attack" | "thwart"): void {
  const card = cardOf(ctx.state, characterId);
  if (card?.type !== "ally") return;
  const printed = kind === "attack" ? card.consequentialDamage.attack : card.consequentialDamage.thwart;
  // "Takes +1 consequential damage after it attacks" (Enraged): a modifier on the printed value.
  const amount = Math.max(0, printed + statBonus(ctx.state, ctx.deps, characterId, kind === "attack" ? "consequentialAttack" : "consequentialThwart"));
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
    (targetCard?.type === "villain" && villainOf(ctx.state, command.targetInstanceId)?.defeated === false) ||
    isMinion(ctx.state, command.targetInstanceId);
  if (!targetIsEnemy) return engineError("no_valid_target", "basic attacks target enemies", command);
  if (!canAttack(ctx.state, command.attackerInstanceId, command.targetInstanceId, ctx.deps)) {
    return engineError("no_valid_target", "a guard minion blocks attacks against the villain", command);
  }

  if (characterProfile(ctx.state, command.attackerInstanceId, ctx.deps)?.missing.includes("atk")) {
    return engineError("no_valid_target", "a character with a printed '—' ATK cannot attack", command);
  }
  const unpaid = payBasicPowerCost(ctx, command, command.attackerInstanceId, "attack");
  if (unpaid) return unpaid;
  exhaustCard(ctx, command.attackerInstanceId);
  if (statusActive(ctx.state, command.attackerInstanceId, "stunned", ctx.deps)) {
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
  const attackerProfile = characterProfile(ctx.state, command.attackerInstanceId, ctx.deps);
  if (!attackerProfile) return engineError("unknown_instance", "attacker has no stats", command);
  if (attackerProfile.missing.includes("atk")) {
    return engineError("no_valid_target", "a character with a printed '—' ATK cannot attack", command);
  }
  pushConsequentialDamage(ctx, command.attackerInstanceId, "attack");
  pushEvent(ctx, {
    kind: "attack",
    attackerInstanceId: command.attackerInstanceId,
    targetInstanceId: command.targetInstanceId,
    playerId: command.playerId,
    basic: true,
  });
  return null;
}

export function basicThwart(ctx: Ctx, command: Command & { type: "basicThwart" }): EngineError | null {
  const invalid = requireActivePlayer(ctx.state, command.playerId, command);
  if (invalid) return invalid;
  const unusable = usableCharacter(ctx, command.playerId, command.thwarterInstanceId, command);
  if (unusable) return unusable;
  if (cannotThwart(ctx.state, ctx.deps, command.playerId)) {
    return engineError("no_valid_target", "you cannot thwart", command);
  }

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

  if (characterProfile(ctx.state, command.thwarterInstanceId, ctx.deps)?.missing.includes("thw")) {
    return engineError("no_valid_target", "a character with a printed '—' THW cannot thwart", command);
  }
  const confused = statusActive(ctx.state, command.thwarterInstanceId, "confused", ctx.deps);
  const scheme = mustInstance(ctx.state, command.schemeInstanceId);
  if (scheme.threat < 1 && !confused) {
    return engineError("no_valid_target", "scheme has no threat to remove", command);
  }
  const unpaid = payBasicPowerCost(ctx, command, command.thwarterInstanceId, "thwart");
  if (unpaid) return unpaid;

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
  const thwarterProfile = characterProfile(ctx.state, command.thwarterInstanceId, ctx.deps);
  if (!thwarterProfile) return engineError("unknown_instance", "thwarter has no stats", command);
  if (thwarterProfile.missing.includes("thw")) {
    return engineError("no_valid_target", "a character with a printed '—' THW cannot thwart", command);
  }
  pushConsequentialDamage(ctx, command.thwarterInstanceId, "thwart");
  pushEvent(ctx, {
    kind: "thwart",
    thwarterInstanceId: command.thwarterInstanceId,
    schemeInstanceId: command.schemeInstanceId,
    playerId: command.playerId,
    basic: true,
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
  // "When your turn ends" abilities get their windows; the turn ends when the event applies.
  const ending: TriggerEvent = { kind: "turnEnding", playerId: command.playerId };
  if (heard(ctx.state, ctx.deps, ending)) {
    pushEvent(ctx, ending);
    return null;
  }
  finishTurn(ctx, command.playerId);
  return null;
}

export { isFault as isPriceFault };
export type { PriceFault };
