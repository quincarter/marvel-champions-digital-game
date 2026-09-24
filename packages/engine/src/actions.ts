import { abilityId as asAbilityId, requirementResources, type AnyCard } from "@mc/content";
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
import type { BasicPowerShare, Command, CostChoices, CostSelection, Payment } from "./commands.js";
import { emit, moveCard, updateInstance, type Ctx } from "./ctx.js";
import {
  consumeCostReductions,
  costReductionFor,
  dealEncounterCardTo,
  discardFromDeckAsCost,
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
import {
  canDivideBasicPower,
  cannotChangeForm,
  cannotLeavePlay,
  cannotPlayCard,
  cannotThwart,
  cannotTriggerAction,
  mayThwartWithAtk,
  patrolledBy,
  restrictedLimitFor,
} from "./rules.js";
import { inPlayPicksOf, type InPlayCostPick } from "./abilities.js";
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
  areaOfCard,
  areaOfPlayer,
  heroFacesOf,
  mainSchemeStateOf,
  playerOrder,
  mustCardOf,
  sameGameArea,
  mustInstance,
  mustPlayer,
  turnInProgress,
  villainOf,
} from "./query.js";
import {
  attachmentHostCandidates,
  heard,
  pushActionAbility,
  pushEvent,
  pushEvents,
  pushPlayCardFrame,
  recordAbilityUse,
} from "./resolve/index.js";
import { limitReached } from "./resolve/ability.js";
import { moveCardsTo } from "./resolve/cards.js";
import {
  addPools,
  combineRequirements,
  countUsableAs,
  EMPTY_POOL,
  payableWithOneType,
  poolOf,
  poolTotal,
  printedResources,
  RESOURCE_TYPES,
  describeRequirement,
  requirementOf,
  requirementTotal,
  satisfies,
  scalePool,
  TYPED_RESOURCES,
  type ResolvedRequirement,
  type ResourcePool,
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
  resolveValue,
  restrictedCardsOf,
  traitsOf,
  type EffectContext,
} from "./select.js";
import type { Bindings, ReportTarget, Vars } from "./stack.js";
import type { GameState } from "./state.js";
import { characterTitledAs } from "./titles.js";
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
  const identityCard = mustCardOf(ctx.state, player.identity.instanceId);
  const faces = identityCard.type === "hero_identity" ? heroFacesOf(identityCard).length : 1;
  let to: "hero" | "alterEgo";
  let heroForm = 0;
  if (command.to === undefined) {
    // A three-sided identity has no single "other form" from alter-ego: "Scott Lang/Ant-Man can change from alter-ego
    // form to either hero form" (Ant-Man insert, "Rules Clarifications"), so the command must say which.
    if (player.identity.form === "alterEgo" && faces > 1)
      return engineError("no_valid_target", "choose which hero form to change to", command);
    to = player.identity.form === "hero" ? "alterEgo" : "hero";
  } else if (command.to === "alterEgo") {
    if (player.identity.form === "alterEgo")
      return engineError("no_valid_target", "you are already in alter-ego form", command);
    to = "alterEgo";
  } else {
    heroForm = command.to.heroForm;
    if (!Number.isInteger(heroForm) || heroForm < 0 || heroForm >= faces)
      return engineError("no_valid_target", `no hero form ${heroForm}`, command);
    if (player.identity.form === "hero" && player.identity.heroFormIndex === heroForm) {
      return engineError("no_valid_target", "you are already in that hero form", command);
    }
    to = "hero";
  }
  // RRG "Form, Change Form": damage, status cards, tokens, and ready/exhausted state all persist. A change from one hero
  // form to the other is a voluntary change of form too, so it uses the once-per-round change (the Ant-Man insert: "follows
  // the standard rules for changing form"; docs/phase7-wave2.md §4.6's proposed reading).
  const changed = setForm(ctx, command.playerId, to, true, heroForm);
  if (changed) pushEvent(ctx, changed);
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
function printedConstants(
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
): readonly Extract<AbilityTriggerSpec, { kind: "constant" }>[] {
  const card = cardOf(state, id);
  if (!card) return [];
  return printedAbilityRefs(card).flatMap((ref) => {
    const trigger = deps.abilities[ref.id]?.trigger;
    return trigger?.kind === "constant" ? [trigger] : [];
  });
}

/** A card in a player's discard pile that its own permission lets them play from there. */
export const playableFromDiscard = (state: GameState, deps: EngineDeps, playerId: PlayerId, id: InstanceId): boolean =>
  mustPlayer(state, playerId).discard.includes(id) &&
  printedConstants(state, deps, id).some((trigger) => trigger.playableFrom?.includes("discard"));

/**
 * A card attached to a card this player controls whose `playableAttachments` permits playing it "as if [it] were in your
 * hand" (Hawkeye's Quiver; docs/phase7-wave2.md §3.10).
 */
export function playableFromAttachment(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  id: InstanceId,
): boolean {
  const host = getInstance(state, id)?.attachedTo;
  if (!host || controllerOf(state, host) !== playerId) return false;
  const context: EffectContext = { selfInstanceId: host, controllerId: playerId, event: null, bindings: {}, deps };
  return activeAbilityRefs(state, host, deps).some((ref) => {
    const trigger = deps.abilities[ref.id]?.trigger;
    return (
      trigger?.kind === "constant" &&
      trigger.playableAttachments !== undefined &&
      matchesQuery(state, id, trigger.playableAttachments, context)
    );
  });
}

/** Where a card may be played from besides hand: its own discard permission, or an attachment permission on its host. */
export const playableOutsideHand = (state: GameState, deps: EngineDeps, playerId: PlayerId, id: InstanceId): boolean =>
  playableFromDiscard(state, deps, playerId, id) || playableFromAttachment(state, deps, playerId, id);

/**
 * The printed play restrictions the engine enforces beyond form, control and per-player/per-host maximums
 * (docs/phase7-wave1.md §1.8, §3.10): "Max N per round", "Play only if your identity has the [trait] trait", "Play only if
 * you control a [trait] character". Traits count whether printed or gained (RRG 1.8 "Gains"). Also the card's own
 * scripted `playOnlyIf` conditions (docs/phase7-wave3.md §3.42), read from `instanceId` wherever it is.
 */
export function playRestrictionFault(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  card: AnyCard,
  instanceId: InstanceId,
): PriceFault | null {
  const teamUp = teamUpFault(state, card);
  if (teamUp) return teamUp;
  // "Play only if you control an Element Gun": RRG 1.8 "Initiating Abilities" (p. 24) step 2, the card not in play.
  const context: EffectContext = {
    selfInstanceId: instanceId,
    controllerId: playerId,
    event: null,
    bindings: {},
    deps,
  };
  for (const trigger of printedConstants(state, deps, instanceId)) {
    if (trigger.playOnlyIf && !evaluate(state, trigger.playOnlyIf, context)) {
      return { code: "no_valid_target", message: "this card's play restriction is not met" };
    }
  }
  const restrictions = "playRestrictions" in card ? card.playRestrictions : undefined;
  if (!restrictions) return null;
  // RRG 1.8 "Max, Maximum" (p. 28): across all copies by title, for all players.
  if (restrictions.maxPerRound !== undefined && (state.playedThisRound[card.name] ?? 0) >= restrictions.maxPerRound) {
    return { code: "limit_reached", message: `max ${restrictions.maxPerRound} per round` };
  }
  // The same rule with the phase as the period: "Max 1 per phase." (docs/phase7-wave2.md §3.5).
  if (restrictions.maxPerPhase !== undefined && (state.playedThisPhase[card.name] ?? 0) >= restrictions.maxPerPhase) {
    return { code: "limit_reached", message: `max ${restrictions.maxPerPhase} per phase` };
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
      ...player.playArea.filter(
        (id) => controllerOf(state, id) === playerId && categoriesOf(state, id).includes("character"),
      ),
    ];
    if (!characters.some((id) => traitsOf(state, id, deps).includes(characterTrait))) {
      return { code: "no_valid_target", message: `play only if you control a ${characterTrait} character` };
    }
  }
  return null;
}

/**
 * Team-Up's play half, RRG 1.8 "Team-Up" (p. 43): "You cannot play this card unless there is a friendly character in
 * play whose title or subtitle matches name 1 and a friendly character in play whose title or subtitle matches name 2."
 * The Ant-Man insert says the same: "(hero or ally)". A friendly character is one any player controls (RRG 1.8
 * "Friendly", p. 21); an identity's title is the face that is up (docs/phase7-wave2.md §3.5). The deckbuilding half is
 * `validateDeck`'s.
 */
function teamUpFault(state: GameState, card: AnyCard): PriceFault | null {
  const keyword = "keywords" in card ? card.keywords.find((k) => k.name === "teamUp") : undefined;
  if (keyword?.name !== "teamUp") return null;
  if (!keyword.names)
    return { code: "no_valid_target", message: "this Team-Up card's names are missing from its card data" };
  // Friendly characters: every player's identity and the allies in play they control (`characterTitledAs` reads an
  // identity's faceup title, an ally's title or subtitle, and a "Hero/Alter-ego" name; docs/phase7-wave3.md §3.34).
  const friendly = playerOrder(state).flatMap((player) => [
    player.identity.instanceId,
    ...player.playArea.filter((id) => cardOf(state, id)?.type === "ally" && controllerOf(state, id) !== null),
  ]);
  const missing = keyword.names.filter((name) => !friendly.some((id) => characterTitledAs(state, id, name)));
  return missing.length === 0
    ? null
    : { code: "no_valid_target", message: `Team-Up needs ${missing.join(" and ")} in play` };
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
    const delta =
      typeof modifier.delta === "number" ? modifier.delta : resolveValue(state, modifier.delta, context, deps);
    if (delta !== 0) contributions.push({ sourceInstanceId, delta });
  };
  for (const sourceId of cardsInPlay(state)) {
    // A card nobody controls in a player's area (an obligation) speaks for that player.
    const controllerId =
      controllerOf(state, sourceId) ?? state.players.find((p) => p.playArea.includes(sourceId))?.playerId ?? null;
    for (const ref of activeAbilityRefs(state, sourceId, deps)) {
      const trigger = deps.abilities[ref.id]?.trigger;
      if (trigger?.kind !== "constant") continue;
      for (const modifier of trigger.costModifiers ?? []) {
        if (modifier.activeIn !== "hand")
          apply(modifier, sourceId, { selfInstanceId: sourceId, controllerId, event: null, bindings: {}, deps });
      }
    }
  }
  for (const trigger of printedConstants(state, deps, cardInstanceId)) {
    for (const modifier of trigger.costModifiers ?? []) {
      if (modifier.activeIn === "hand") {
        apply(modifier, cardInstanceId, {
          selfInstanceId: cardInstanceId,
          controllerId: playerId,
          event: null,
          bindings: {},
          deps,
        });
      }
    }
  }
  const discount = discountFor(state, deps, playerId, cardInstanceId);
  if (discount > 0) contributions.push({ sourceInstanceId: cardInstanceId, delta: -discount });
  return contributions;
}

/**
 * Discount X (trait), the Fear No Evil rulebook, "Featured Keywords" (p. 3): "When a player plays a card with discount X,
 * its resource cost is reduced by X if that player's identity has the specified trait. If more than one trait is
 * specified and the player's identity has at least one of the specified traits, the cost is reduced by X." Its FAQ
 * (p. 26): applied "only once if your identity has any number of matching traits". Printed or gained traits (RRG 1.8
 * "Gains"). The card's own printed keyword, so it is listed as the card's own contribution to its price.
 */
function discountFor(state: GameState, deps: EngineDeps, playerId: PlayerId, cardInstanceId: InstanceId): number {
  const card = cardOf(state, cardInstanceId);
  const player = getPlayer(state, playerId);
  if (!card || !player || !("keywords" in card)) return 0;
  const identityTraits = traitsOf(state, player.identity.instanceId, deps);
  let total = 0;
  for (const keyword of card.keywords) {
    if (keyword.name === "discount" && keyword.traits.some((t) => identityTraits.includes(t))) total += keyword.value;
  }
  return total;
}

/**
 * The typed resources a card's Requirement keyword makes part of its cost (RRG 1.8 "Requirement (Resources)", p. 37:
 * "When paying this card's resource cost, you must spend the following resources: [resources]"). A wild resource can be
 * spent as any of them (RRG 1.8 "Wild Resource", p. 48). Validation admits only physical, mental and energy.
 */
function requiredResources(card: AnyCard): ResolvedRequirement {
  const required = { generic: 0, physical: 0, mental: 0, energy: 0 };
  for (const keyword of "keywords" in card ? card.keywords : []) {
    const counts = requirementResources(keyword);
    for (const type of TYPED_RESOURCES) required[type] += counts[type] ?? 0;
  }
  return required;
}

/**
 * The part of a play's price that is the card's own resource cost: printed, then modified, then reduced, never below 0.
 * `playRequirement` adds the card ability's cost to it.
 */
function ownPlayCost(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: InstanceId,
  deps: EngineDeps,
  attachTo: InstanceId | null,
  x = 0,
  /** A reduction the *playing effect* carries rather than a lasting one: "reducing its resource cost by 1" (§9). */
  extraReduction = 0,
): number {
  const card = mustCardOf(state, cardInstanceId);
  // A cost printed "X" costs the X the player chose (docs/phase7-wave2.md §3.8), before modifiers.
  const printed = "specialCost" in card && card.specialCost === "X" ? Math.max(0, x) : "cost" in card ? card.cost : 0;
  const modified = Math.max(0, printed + playCostModifier(state, deps, playerId, cardInstanceId, attachTo));
  return Math.max(0, modified - costReductionFor(state, deps, playerId, cardInstanceId) - Math.max(0, extraReduction));
}

/**
 * A Requirement the card's current cost has no room for: its required resources outnumber what the card costs now, so
 * they cannot all be "spent while paying for that card's cost" (RRG 1.8 "Requirement (Resources)", p. 37). Resources
 * paid beyond a cost "were not paid for that cost" (RRG 1.8 "Cost", p. 13), so overpaying cannot meet it. Engine reading,
 * docs/phase7-wave2.md §4.12: the RRG settles only the extreme case ("cannot be played 'ignoring its resource cost'").
 */
export function requirementUnmeetable(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: InstanceId,
  deps: EngineDeps,
  attachTo: InstanceId | null,
  x = 0,
  extraReduction = 0,
): boolean {
  const required = requirementTotal(requiredResources(mustCardOf(state, cardInstanceId)));
  return required > 0 && required > ownPlayCost(state, playerId, cardInstanceId, deps, attachTo, x, extraReduction);
}

/** The signed change to a card's cost from every `CostModifierSpec` that applies to playing it now (see there). */
export function playCostModifier(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  cardInstanceId: InstanceId,
  attachTo: InstanceId | null,
): number {
  return playCostContributions(state, deps, playerId, cardInstanceId, attachTo).reduce(
    (total, entry) => total + entry.delta,
    0,
  );
}

/** The additional cost on this character's own basic power, if it has one (`basicPowerCosts`). */
export function basicPowerCost(
  state: GameState,
  deps: EngineDeps,
  characterId: InstanceId,
  power: "attack" | "thwart",
): AbilityCost | undefined {
  for (const ref of activeAbilityRefs(state, characterId, deps)) {
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
  const context: EffectContext = {
    selfInstanceId: cardInstanceId,
    controllerId: playerId,
    event: null,
    bindings: {},
    deps,
  };
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
export function generatedResources(
  state: GameState,
  generation: ResourceGeneration | undefined,
  discardTop: InstanceId | null,
): ResourcePool {
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

/**
 * RRG 1.8 "Alliance" (p. 6): "When a player declares their intention to play a card with the alliance keyword, any
 * player(s) may help pay the costs for that card", equivalent to "While paying costs for this card, any player may
 * contribute to paying those costs." Read from the card whose costs are being paid (docs/phase7-wave4.md §3.17), so a
 * gained alliance counts as a printed one. Only the paying player resolves the card; the contributors only pay.
 */
export function paidAsGroup(state: GameState, deps: EngineDeps, ...cards: readonly (InstanceId | null)[]): boolean {
  return cards.some(
    (id) => id !== null && getInstance(state, id) !== undefined && hasKeyword(state, id, "alliance", deps),
  );
}

/**
 * Who spends a resource ability used in a payment by `playerId`: the paying player for their own card and for a card
 * that generates "for any player" (the Milano), and otherwise the card's controller, contributing to an alliance cost.
 * That player's form, limit and discard pile are the ones the ability reads, and they pay its own cost.
 */
function resourceSpender(
  state: GameState,
  deps: EngineDeps,
  instanceId: InstanceId,
  abilityId: string,
  playerId: PlayerId,
) {
  const controller = controllerOf(state, instanceId);
  if (controller === null || controller === playerId) return playerId;
  return deps.abilities[abilityId]?.trigger.kind === "resource" && deps.abilities[abilityId]?.trigger.forAnyPlayer
    ? playerId
    : controller;
}

function resourceAbilityFault(
  state: GameState,
  deps: EngineDeps,
  instanceId: InstanceId,
  abilityId: string,
  playerId: PlayerId,
  payingFor: InstanceId | null,
  group = false,
): PriceFault | null {
  const definition = deps.abilities[abilityId];
  if (!definition || definition.trigger.kind !== "resource") {
    return { code: "no_valid_target", message: `${abilityId} is not a resource ability` };
  }
  if (!activeAbilityRefs(state, instanceId, deps).some((ref) => ref.id === abilityId)) {
    return { code: "no_valid_target", message: `${abilityId} is not active on ${instanceId}` };
  }
  // "…generate a [wild] resource for any player" (the Milano; docs/phase7-wave3.md §3.13); any player's, for an
  // alliance card (§3.17).
  if (controllerOf(state, instanceId) !== playerId && definition.trigger.forAnyPlayer !== true && !group) {
    return { code: "no_valid_target", message: "resource abilities must be on cards you control" };
  }
  const spender = resourceSpender(state, deps, instanceId, abilityId, playerId);
  const form = definition.trigger.form;
  if (form && getPlayer(state, spender)?.identity.form !== form) {
    return { code: "wrong_form", message: `${abilityId} requires ${form} form` };
  }
  if (limitReached(state, instanceId, asAbilityId(abilityId), definition, null, spender)) {
    return { code: "limit_reached", message: `${abilityId} has reached its limit` };
  }
  // "Generate a [wild] resource for an event": only while paying for a matching card.
  if (definition.generatesFor) {
    const context: EffectContext = {
      selfInstanceId: instanceId,
      controllerId: spender,
      event: null,
      bindings: {},
      deps,
    };
    if (payingFor === null || !matchesQuery(state, payingFor, definition.generatesFor, context)) {
      return { code: "no_valid_target", message: `${abilityId} only generates resources for a certain kind of card` };
    }
  }
  const plan = planCost(state, deps, instanceId, spender, definition.cost, {}, new Set());
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
  // An alliance card (RRG 1.8 "Alliance", p. 6; docs/phase7-wave4.md §3.17): any player's hand cards and resource
  // abilities may pay. Each card is read from its own player's point of view (their form, their discard pile).
  const group = paidAsGroup(ctx.state, ctx.deps, excludeInstanceId, payingFor);
  const seen = new Set<string>();
  const discardTop = new Map<PlayerId, InstanceId | null>();
  const topOf = (id: PlayerId): InstanceId | null =>
    discardTop.has(id) ? (discardTop.get(id) ?? null) : (mustPlayer(ctx.state, id).discard[0] ?? null);
  let pool = EMPTY_POOL;
  for (const entry of payment) {
    if ("fromHand" in entry) {
      const key = `hand:${entry.fromHand}`;
      if (seen.has(key)) return { code: "insufficient_resources", message: "duplicate payment card" };
      seen.add(key);
      if (entry.fromHand === excludeInstanceId) {
        return { code: "insufficient_resources", message: "a card cannot pay for itself" };
      }
      const zone = locateCard(ctx.state, entry.fromHand);
      const ownerId = zone?.kind === "hand" ? zone.playerId : null;
      if (ownerId === null || (ownerId !== playerId && !group)) {
        return { code: "card_not_in_zone", message: `payment card ${entry.fromHand} is not in hand` };
      }
      const player = mustPlayer(ctx.state, ownerId);
      if (!cardOf(ctx.state, entry.fromHand))
        return { code: "unknown_card", message: `no card data for ${entry.fromHand}` };
      // "Spend this card only in hero form."
      const spendableIn = printedConstants(ctx.state, ctx.deps, entry.fromHand).find(
        (trigger) => trigger.spendableIn,
      )?.spendableIn;
      if (spendableIn && player.identity.form !== spendableIn) {
        return {
          code: "wrong_form",
          message: `${mustCardOf(ctx.state, entry.fromHand).name} can only be spent in ${spendableIn} form`,
        };
      }
      pool = addPools(pool, handCardResources(ctx.state, ctx.deps, entry.fromHand, ownerId, payingFor));
      discardTop.set(ownerId, entry.fromHand);
      continue;
    }
    const { instanceId, abilityId } = entry.ability;
    const key = `ability:${instanceId}:${abilityId}`;
    if (seen.has(key)) return { code: "insufficient_resources", message: "duplicate resource ability" };
    seen.add(key);
    const fault = resourceAbilityFault(ctx.state, ctx.deps, instanceId, abilityId, playerId, payingFor, group);
    if (fault) return fault;
    const spender = resourceSpender(ctx.state, ctx.deps, instanceId, abilityId, playerId);
    pool = addPools(pool, generatedResources(ctx.state, ctx.deps.abilities[abilityId]?.generates, topOf(spender)));
  }
  // "You can only spend [physical] resources to pay for this card." A wild can be declared as that type; a cost of 0
  // needs no resources at all (FAQ "Crushing Blow (#2)", p. 60).
  const only = payingFor
    ? printedConstants(ctx.state, ctx.deps, payingFor).flatMap((trigger) => trigger.paymentOnly ?? [])
    : [];
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
  /**
   * The card this payment is for, when that is not the excluded card — what a "generate a resource for an Arrow
   * event" ability (Expert Marksman, `generatesFor`) is checked against. Defaults to `excludeInstanceId`, which is
   * the same card whenever a card is being played; with neither, such an ability is left out, because a resource
   * that only pays for one kind of card pays for nothing in particular.
   */
  payingFor: InstanceId | null = excludeInstanceId,
): readonly ChoiceOption[] {
  const options: ChoiceOption[] = [];
  // An alliance card: every player's hand, the paying player's first (docs/phase7-wave4.md §3.17).
  const group = paidAsGroup(ctx.state, ctx.deps, excludeInstanceId, payingFor);
  const payers = group
    ? [playerId, ...playerOrder(ctx.state).flatMap((p) => (p.playerId === playerId ? [] : [p.playerId]))]
    : [playerId];
  for (const payerId of payers) {
    const payer = mustPlayer(ctx.state, payerId);
    for (const id of payer.hand) {
      if (id === excludeInstanceId) continue;
      const spendableIn = printedConstants(ctx.state, ctx.deps, id).find((trigger) => trigger.spendableIn)?.spendableIn;
      if (spendableIn && spendableIn !== payer.identity.form) continue;
      options.push({
        optionId: `hand:${id}`,
        label: mustCardOf(ctx.state, id).name,
        ref: { kind: "card", instanceId: id },
      });
    }
  }
  for (const id of cardsInPlay(ctx.state)) {
    const controlled = controllerOf(ctx.state, id) === playerId;
    for (const ref of activeAbilityRefs(ctx.state, id, ctx.deps)) {
      const trigger = ctx.deps.abilities[ref.id]?.trigger;
      if (trigger?.kind !== "resource") continue;
      if (!controlled && trigger.forAnyPlayer !== true && !group) continue;
      if (resourceAbilityFault(ctx.state, ctx.deps, id, ref.id, playerId, payingFor, group)) continue;
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

/**
 * Spends a priced payment. Returns the cards it discarded from hand, in payment order — the cards that were *spent*,
 * which the caller announces with `announceResourcesSpent` once the thing being paid for is on the stack.
 */
export function payPayment(ctx: Ctx, playerId: PlayerId, payment: readonly Payment[]): readonly InstanceId[] {
  const spent: InstanceId[] = [];
  for (const entry of payment) {
    if ("fromHand" in entry) {
      // From the hand it is in: another player's, when they help pay for an alliance card (§3.17).
      const zone = locateCard(ctx.state, entry.fromHand);
      discardFromHand(ctx, zone?.kind === "hand" ? zone.playerId : playerId, entry.fromHand);
      spent.push(entry.fromHand);
      continue;
    }
    const { instanceId, abilityId } = entry.ability;
    const definition = ctx.deps.abilities[abilityId];
    if (!definition) continue;
    const spender = resourceSpender(ctx.state, ctx.deps, instanceId, abilityId, playerId);
    const generated = generatedResources(
      ctx.state,
      definition.generates,
      mustPlayer(ctx.state, spender).discard[0] ?? null,
    );
    const plan = planCost(ctx.state, ctx.deps, instanceId, spender, definition.cost, {}, new Set());
    if (!isFault(plan)) payCost(ctx, instanceId, spender, definition.cost, plan);
    recordAbilityUse(ctx, instanceId, abilityId, definition, null, spender);
    emit(ctx, {
      type: "resourcesGenerated",
      playerId: spender,
      instanceId,
      abilityId,
      amount: poolTotal(generated),
      pool: generated,
    });
  }
  return spent;
}

/**
 * "After you spend this card" / "When you spend this card" (docs/phase7-wave2.md §12): announces the cards one payment
 * spent (`resourcesSpent`). Call it **after** pushing the card or ability the payment was for, so the event sits above
 * it on the stack and its windows resolve first — between paying the costs and the card commencing being played (RRG
 * 1.8 "Initiating Abilities", p. 24, steps 5–6; "Cost Arrow Icon", p. 14; ruling, Feb 28, 2026 (1)).
 *
 * Pushed only when an ability could react, so a payment nothing cares about leaves the stack and the log as they were.
 */
export function announceResourcesSpent(
  ctx: Ctx,
  playerId: PlayerId,
  spent: readonly InstanceId[],
  payingForInstanceId: InstanceId | null,
  purpose: "playCard" | "ability" | "effect",
): void {
  if (spent.length === 0) return;
  // One event per player who spent cards: an alliance payment (§3.17) spans players, and "After you spend this card
  // for a player" (Everyday Hero) names both the spender and the player paid for. Pushed in reverse player order from
  // the paying player, so the paying player's own event resolves first. Spenders are the cards' owners (a hand card
  // is in its owner's hand).
  const spenders = [playerId, ...ctx.state.players.flatMap((p) => (p.playerId === playerId ? [] : [p.playerId]))];
  for (const spender of [...spenders].reverse()) {
    const theirs = spent.filter((id) => (getInstance(ctx.state, id)?.ownerId ?? playerId) === spender);
    if (theirs.length === 0) continue;
    const event: TriggerEvent = {
      kind: "resourcesSpent",
      cardInstanceIds: theirs,
      playerId: spender,
      forPlayerId: playerId,
      payingForInstanceId,
      purpose,
    };
    if (heard(ctx.state, ctx.deps, event)) pushEvent(ctx, event);
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
  readonly requirement: ResolvedRequirement;
  readonly bindings: Bindings;
  readonly vars: Vars;
  /** The card resources are being spent on, for "while paying for an [aspect] card". */
  readonly payingFor: InstanceId | null;
  /**
   * The cost actually being paid, once the player's decisions are applied (`selectCost`): an either/or cost reduced to
   * its chosen branch, an "up to N" counter cost to its chosen count. `payCost` and the resource vars read this, so a
   * plan is paid exactly as it was checked. Absent: the cost as written.
   */
  readonly cost?: AbilityCost;
}

/**
 * A `conditional` cost component (docs/phase7-wave3.md §3.49) replaced by the branch the board picks: `then` while its
 * condition holds, `else` otherwise, merged with the rest of the cost. RRG 1.8 "Initiating Abilities" (p. 24), step 3:
 * the cost is determined before it is paid, so the condition is read now, with the paying player as `you` and the
 * ability's card as `self`. Only the picked branch is ever checked: "instead" replaces the printed cost (RRG 1.8
 * "Replacement Effect", p. 37), so an unpayable picked branch makes the ability unusable even if the other is payable.
 * `vars["cost.condition"]` records the pick (1 = `then`). A cost with no `conditional` comes back unchanged.
 */
function determineConditionalCost(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  cost: AbilityCost,
): { readonly cost: AbilityCost; readonly vars: Record<string, number> } {
  if (!cost.conditional) return { cost, vars: {} };
  const { conditional, ...common } = cost;
  const context: EffectContext = { selfInstanceId: sourceId, controllerId: playerId, event: null, bindings: {}, deps };
  const holds = evaluate(state, conditional.condition, context);
  return {
    cost: { ...common, ...(holds ? conditional.then : conditional.else) },
    vars: { "cost.condition": holds ? 1 : 0 },
  };
}

/**
 * The cost `playerId` would pay for `sourceId`'s ability right now, once the board has picked any `conditional`
 * branch (§3.49). What `legalActions` and a client read to know which picks the cost asks for ("choose and discard 1
 * card from your hand" or not). Player decisions (`either`, "up to N") are left as written.
 */
export function costAsDetermined(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  cost: AbilityCost | undefined,
): AbilityCost | undefined {
  return cost && determineConditionalCost(state, deps, sourceId, playerId, cost).cost;
}

/**
 * Applies the decisions a cost leaves to the player (docs/phase7-wave3.md §3.32, §3.36), giving the concrete cost to
 * check and pay:
 *
 * - `either`: exactly one branch is paid, with the rest of the cost. `selection.branch` names it; with none, the first
 *   branch whose non-resource components can be paid now is taken (the only choice a timing window can make, since
 *   it asks nothing). A branch index out of range is refused. RRG 1.8 "Choose (Option)" (p. 12): a player "cannot
 *   choose an option that cannot be at least partially resolved", including one with "a cost the player cannot pay".
 * - `spendCounters.upTo`: `selection.counters` counters, from 1 (RRG 1.8 "Cost", p. 14: "up to" some number "requires
 *   a minimum of one") to the printed maximum and what the card holds; with none, as many as it can.
 *
 * Before either of those, a `conditional` component becomes the branch the board picks (`costAsDetermined`, §3.49).
 *
 * `vars` records the decisions for the log and the effects: `cost.condition`, `cost.branch`, and the counter cost's
 * own `bind`.
 */
export function selectCost(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  written: AbilityCost,
  selection: CostSelection,
  choices: CostChoices = {},
  reserved: ReadonlySet<InstanceId> = new Set(),
): { readonly cost: AbilityCost; readonly vars: Record<string, number> } | PriceFault {
  const determined = determineConditionalCost(state, deps, sourceId, playerId, written);
  const cost = determined.cost;
  const vars: Record<string, number> = { ...determined.vars };
  let chosen: AbilityCost = cost;
  if (cost.either) {
    const { either, ...common } = cost;
    if (either.length === 0) return { code: "invalid_choice", message: "an either/or cost has no branches" };
    const branchCost = (index: number): AbilityCost => ({ ...common, ...either[index] });
    let index = selection.branch;
    if (index !== undefined && (!Number.isInteger(index) || index < 0 || index >= either.length)) {
      return { code: "invalid_choice", message: `choose a cost branch from 0 to ${either.length - 1}` };
    }
    if (index === undefined) {
      const payable = either.findIndex((_, i) => {
        const concrete = selectCost(state, deps, sourceId, playerId, branchCost(i), selection, choices, reserved);
        return (
          !isFault(concrete) && !isFault(planCost(state, deps, sourceId, playerId, concrete.cost, choices, reserved))
        );
      });
      index = payable < 0 ? 0 : payable;
    }
    chosen = branchCost(index);
    if (chosen.either) return { code: "invalid_choice", message: "an either/or cost cannot nest another" };
    vars["cost.branch"] = index;
  }
  const counters = chosen.spendCounters;
  if (counters?.upTo) {
    const holderId =
      counters.target === "identity" ? mustPlayer(state, playerId).identity.instanceId : (sourceId as InstanceId);
    const held = getInstance(state, holderId)?.counters[counters.counterType] ?? 0;
    const most = Math.min(counters.amount, held);
    const count = selection.counters ?? most;
    if (!Number.isInteger(count) || count < 1 || count > counters.amount) {
      return { code: "invalid_choice", message: `remove 1 to ${counters.amount} ${counters.counterType} counters` };
    }
    if (count > held) {
      return { code: "insufficient_resources", message: `not enough ${counters.counterType} counters` };
    }
    const { upTo: _upTo, ...fixed } = counters;
    chosen = { ...chosen, spendCounters: { ...fixed, amount: count } };
  }
  return { cost: chosen, vars };
}

const NO_REQUIREMENT: ResolvedRequirement = { generic: 0, physical: 0, mental: 0, energy: 0 };

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
  if (from.top !== undefined && "playerId" in zone && !cardZoneCandidates(state, from, zone.playerId).includes(id))
    return false;
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
  selection: CostSelection = {},
): CostPlan | PriceFault {
  if (!cost) return { requirement: NO_REQUIREMENT, bindings: {}, vars: {}, payingFor: null };
  const source = getInstance(state, sourceId);
  if (!source) return { code: "unknown_instance", message: `no instance ${sourceId}` };
  // Conditional, either/or and "up to N" costs become the cost actually paid (docs/phase7-wave3.md §3.32, §3.36, §3.49).
  const selected =
    cost.conditional || cost.either || cost.spendCounters?.upTo
      ? selectCost(state, deps, sourceId, playerId, cost, selection, choices, reserved)
      : null;
  if (selected && isFault(selected)) return selected;
  if (selected) cost = selected.cost;
  const player = mustPlayer(state, playerId);
  const identity = mustInstance(state, player.identity.instanceId);
  const bindings: Record<string, readonly InstanceId[]> = {};
  const vars: Record<string, number> = { ...selected?.vars };
  let requirement = combineRequirements(cost.resources, 0);
  let payingFor: InstanceId | null = null;

  if (cost.exhaustSelf && source.exhausted)
    return { code: "already_exhausted", message: "the card is already exhausted" };
  if (cost.spendCounters) {
    const holder = cost.spendCounters.target === "identity" ? identity : source;
    if ((holder.counters[cost.spendCounters.counterType] ?? 0) < cost.spendCounters.amount) {
      return { code: "insufficient_resources", message: `not enough ${cost.spendCounters.counterType} counters` };
    }
    if (cost.spendCounters.bind) vars[cost.spendCounters.bind] = cost.spendCounters.amount;
  }
  // "Discard the top card of your deck →" (docs/phase7-wave3.md §3.33): the deck, or the deck the rules would already
  // have reshuffled from the discard pile (an empty deck beside a discard pile is a state built before §4 Q15's
  // immediate reset), must hold them all.
  if (cost.discardFromDeck !== undefined) {
    const supply = player.deck.length > 0 ? player.deck.length : player.discard.length;
    if (supply < cost.discardFromDeck) {
      return { code: "card_not_in_zone", message: `discard the top ${cost.discardFromDeck} card(s) of your deck` };
    }
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
    const { min, max, bind, filter } = cost.discardFromHand;
    if (picks.length < min || (max !== undefined && picks.length > max)) {
      return { code: "invalid_choice", message: `discard ${min}–${max ?? "any number of"} cards to pay this cost` };
    }
    // "Discard a [physical] resource from your hand →" (docs/phase7-wave2.md §19): every pick must match, read
    // from the paying player's point of view, so `identitySetOf: you` means their own hero's set.
    const filterContext: EffectContext = {
      selfInstanceId: sourceId,
      controllerId: playerId,
      event: null,
      bindings: {},
      deps,
    };
    // An alliance card's discards may come from any player's hand (§3.17).
    const group = paidAsGroup(state, deps, sourceId);
    const inAHand = (id: InstanceId): boolean =>
      player.hand.includes(id) || (group && locateCard(state, id)?.kind === "hand");
    for (const id of picks) {
      if (!inAHand(id) || id === sourceId || reserved.has(id)) {
        return { code: "card_not_in_zone", message: `${id} cannot be discarded from hand for this cost` };
      }
      if (filter && !matchesQuery(state, id, filter, filterContext)) {
        return { code: "no_valid_target", message: `${id} does not match what this cost must be paid with` };
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
      return {
        code: "card_not_in_zone",
        message: `discard ${cost.discardRandomFromHand} card(s) at random from your hand to pay this cost`,
      };
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
      const match = matchingCardInPlay(state, card, new Set([pick]), playerId, deps);
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
  const picked: { readonly pick: InPlayCostPick; readonly ids: readonly InstanceId[] }[] = [];
  for (const { mode, pick } of inPlayPicksOf(cost)) {
    const ids = planInPlayPick(state, deps, sourceId, playerId, mode, pick, choices);
    if (isFault(ids)) return ids;
    picked.push({ pick, ids });
  }
  const inPlayIds = picked.flatMap((entry) => entry.ids);
  // RRG 1.8 "Cost" (p. 13): a cost's components are paid simultaneously, so one card can't pay two of them. It can't
  // be exhausted twice, exhausted and also returned, or picked here and also exhausted for a resource in the payment.
  const spentInPlay = [
    ...(cost.exhaustSelf ? [sourceId] : []),
    ...(cost.exhaustIdentity ? [identity.instanceId] : []),
    ...inPlayIds,
  ];
  if (new Set(spentInPlay).size !== spentInPlay.length || inPlayIds.some((id) => reserved.has(id))) {
    return { code: "invalid_choice", message: "one card cannot pay two parts of a cost" };
  }
  for (const { pick, ids } of picked) bindInPlayPick(pick, ids, bindings, vars);
  return { requirement, bindings, vars, payingFor, ...(selected ? { cost } : {}) };
}

function bindInPlayPick(
  pick: InPlayCostPick,
  picks: readonly InstanceId[],
  bindings: Record<string, readonly InstanceId[]>,
  vars: Record<string, number>,
): void {
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
  return eligibleForInPlayPick(state, deps, sourceId, playerId, pick).filter((id) =>
    canPayInPlayPick(state, deps, id, mode),
  );
}

/**
 * Default picks for costs paid with cards in play (`InPlayCostPick`), so an ability whose choice isn't forced can still
 * be judged payable: the first `min` candidates of each pick in play-area order, the smallest payment, with a card
 * taken by an earlier pick kept out of later ones ("an [Avenger] character and a [Guardian] character" needs two). A
 * pick with too few candidates is left out, so `planCost` reports why the cost can't be paid. The player's own picks
 * replace these (`legalActions`' example commands; a window's trigger candidates).
 */
export function defaultInPlayPicks(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  cost: AbilityCost | undefined,
): CostChoices {
  const picks: Record<string, readonly InstanceId[]> = {};
  const taken = new Set<InstanceId>();
  for (const { mode, pick } of inPlayPicksOf(cost)) {
    const candidates = inPlayCostCandidates(state, deps, sourceId, playerId, mode, pick).filter((id) => !taken.has(id));
    if (candidates.length < pick.min) continue;
    const chosen = candidates.slice(0, pick.min);
    picks[pick.slot] = chosen;
    for (const id of chosen) taken.add(id);
  }
  return picks;
}

function eligibleForInPlayPick(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  pick: InPlayCostPick,
): readonly InstanceId[] {
  const context: EffectContext = { selfInstanceId: sourceId, controllerId: playerId, event: null, bindings: {}, deps };
  // RRG 1.8 "Cost" (p. 14): costs are paid with cards the player controls, except for an alliance card, whose costs
  // any player may help pay (RRG 1.8 "Alliance", p. 6): "exhaust an [Avenger] character and a [Guardian] character"
  // may take another player's characters (docs/phase7-wave4.md §3.17).
  const group = paidAsGroup(state, deps, sourceId);
  return cardsInPlay(state).filter(
    (id) => (group || controllerOf(state, id) === playerId) && matchesQuery(state, id, pick.query, context),
  );
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
    return {
      code: "invalid_choice",
      message: `${verb} ${pick.min}–${pick.max ?? "any number of"} cards to pay this cost`,
    };
  }
  if (new Set(picks).size !== picks.length)
    return { code: "invalid_choice", message: `duplicate choice for ${pick.slot}` };
  const bad = picks.find((id) => !candidates.includes(id));
  return bad ? whyNot(bad) : picks;
}

/**
 * RRG 1.8 "Cost" (p. 13): "Resources generated beyond the specified cost are considered to have been overpaid for that
 * cost and were not paid for that cost." `overpaid.total` is everything beyond the requirement; `overpaid.<type>` is the
 * most of that type (a wild counting as any) that can be the overpaid part, which is how the player would assign it:
 * "for each resource you overpaid" (Ant-Man ally), "for each [energy] resource you overpaid" (Wasp ally).
 * docs/phase7-wave2.md §3.8.
 */
function overpaidVars(pool: ResourcePool, requirement: ResolvedRequirement): Record<string, number> {
  const over = Math.max(0, poolTotal(pool) - requirementTotal(requirement));
  const vars: Record<string, number> = { "overpaid.total": over };
  // A wild slot consumes wilds that can then be no other type, so they are out of every `overpaid.<type>` count.
  const freeWilds = Math.max(0, pool.wild - (requirement.wild ?? 0));
  for (const type of TYPED_RESOURCES)
    vars[`overpaid.${type}`] = Math.max(0, Math.min(over, pool[type] + freeWilds - requirement[type]));
  return vars;
}

/** "Spend X [type] resources": binds X from the pool beyond the cost's fixed requirement. */
export function resourceVars(
  pool: ResourcePool,
  cost: AbilityCost | undefined,
  requirement: ResolvedRequirement,
): Vars | PriceFault {
  const vars: Record<string, number> = {
    "paid.physical": pool.physical,
    "paid.mental": pool.mental,
    "paid.energy": pool.energy,
    "paid.wild": pool.wild,
    "paid.total": poolTotal(pool),
    ...overpaidVars(pool, requirement),
  };
  if (cost?.resourcesX) {
    const { resource, max } = cost.resourcesX;
    const usable = resource === "any" ? poolTotal(pool) : countUsableAs(pool, resource);
    const paid = Math.max(0, usable - requirementTotal(requirement));
    // "Up to N" caps X; overpaying stays legal (docs/phase7-wave3.md §3.25).
    const x = max === undefined ? paid : Math.min(paid, max);
    if (x < (cost.resourcesX.min ?? 0)) return { code: "insufficient_resources", message: "X is too small" };
    vars[cost.resourcesX.bind] = x;
  }
  if (cost?.sameResourceType) {
    // "Spend 3 resources of the same type" (docs/phase7-wave3.md §3.43).
    const count = requirementTotal(requirementOf(cost.resources));
    if (!payableWithOneType(pool, count, requirement)) {
      return { code: "insufficient_resources", message: `spend ${count} resources of the same type` };
    }
  }
  if (cost?.distinctResourceTypes !== undefined) {
    // Each typed resource present is one type; each wild can stand for a type not otherwise present.
    const typed = TYPED_RESOURCES.filter((type) => pool[type] > 0).length;
    const distinct = typed + Math.min(pool.wild, RESOURCE_TYPES.length - typed);
    if (distinct < cost.distinctResourceTypes) {
      return {
        code: "insufficient_resources",
        message: `spend ${cost.distinctResourceTypes} resources of different types`,
      };
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
  written: AbilityCost | undefined,
  plan: CostPlan,
): void {
  const cost = plan.cost ?? written;
  if (!cost) return;
  const identityId = mustPlayer(ctx.state, playerId).identity.instanceId;
  if (cost.exhaustSelf) exhaustCard(ctx, sourceId);
  if (cost.spendCounters) {
    const holderId = cost.spendCounters.target === "identity" ? identityId : sourceId;
    removeCounters(ctx, holderId, cost.spendCounters.counterType, cost.spendCounters.amount);
  }
  if (cost.exhaustIdentity) exhaustCard(ctx, identityId);
  if (cost.healIdentity) healDamage(ctx, identityId, cost.healIdentity);
  // "Deal yourself 1 facedown encounter card →" (docs/phase7-wave3.md §3.20).
  for (let i = 0; i < (cost.dealEncounterCards ?? 0); i++) dealEncounterCardTo(ctx, playerId);
  for (const id of plan.bindings.discard ?? []) {
    const zone = locateCard(ctx.state, id);
    discardFromHand(ctx, zone?.kind === "hand" ? zone.playerId : playerId, id);
  }
  if (cost.discardFromDeck) discardFromDeckAsCost(ctx, playerId, cost.discardFromDeck);
  // After the payment and the chosen discards have left the hand, so the random pick is among what remains.
  if (cost.discardRandomFromHand) discardRandomFromHand(ctx, playerId, cost.discardRandomFromHand, [sourceId]);
  if (cost.damageSelf) {
    pushEvent(ctx, {
      kind: "dealDamage",
      targetInstanceId: identityId,
      amount: cost.damageSelf,
      sourceInstanceId: sourceId,
      fromAttack: false,
    });
  }
  if (cost.damageThisCard) {
    pushEvent(ctx, {
      kind: "dealDamage",
      targetInstanceId: sourceId,
      amount: cost.damageThisCard,
      sourceInstanceId: sourceId,
      fromAttack: false,
    });
  }
  if (cost.discardSelf && getInstance(ctx.state, sourceId)) discardFromPlay(ctx, sourceId);
  for (const { mode, pick } of inPlayPicksOf(cost)) {
    if (mode === "exhaust") for (const id of plan.bindings[pick.slot] ?? []) exhaustCard(ctx, id);
    else moveCardsTo(ctx, plan.bindings[pick.slot] ?? [], "hand");
  }
}

// ---------------------------------------------------------------------------
// Playing cards and using abilities
// ---------------------------------------------------------------------------

/** The action ability an event resolves when played from hand, if it has one. */
/**
 * Whether an action's pre-cost condition is false right now, so the action cannot be initiated at all (docs/phase7-
 * wave2.md §16): "Hero Action: If you are in Tiny hero form, exhaust Army of Ants → …" (`trigger.while`).
 *
 * RRG 1.8 "Play Restrictions and Permissions" (p. 33): cards contain "specific conditions that must be true in order to
 * use them", and "In order to use an ability or play a card, all of its play restrictions must be observed". "Initiating
 * Abilities" (p. 24) checks them at step 2, before the cost is determined (step 3) or paid (step 5), so a false
 * condition refuses the action with nothing spent. One check for every way an action is initiated: `useAbility` on a
 * card in play, and every path that plays an event whose ability is the action (`playCard`, `playFromHand` paying or
 * ignoring the cost). "You" is the player initiating it; "this card" is the card the action is on (for an event, the
 * card in hand).
 */
export function actionConditionUnmet(
  state: GameState,
  deps: EngineDeps,
  definition: AbilityDefinition | undefined,
  sourceId: InstanceId,
  playerId: PlayerId,
): boolean {
  if (definition?.trigger.kind !== "action" || !definition.trigger.while) return false;
  const context: EffectContext = { selfInstanceId: sourceId, controllerId: playerId, event: null, bindings: {}, deps };
  return !evaluate(state, definition.trigger.while, context);
}

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
  abilityRequirement: ResolvedRequirement,
  deps: EngineDeps = DEFAULT_DEPS,
  attachTo: InstanceId | null = null,
  x = 0,
  /** "…, reducing its resource cost by 1" (Team-Building Exercise; docs/phase7-wave2.md §9). */
  extraReduction = 0,
): ResolvedRequirement {
  const own = ownPlayCost(state, playerId, cardInstanceId, deps, attachTo, x, extraReduction);
  // A Requirement keyword turns part of the card's own cost into typed slots (see `requiredResources`).
  const required = requiredResources(mustCardOf(state, cardInstanceId));
  const typed = requirementTotal(required);
  const cardCost = typed === 0 ? own : { ...required, generic: Math.max(0, own - typed) };
  return combineRequirements(cardCost, abilityRequirement);
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
  x?: number,
  /** "…, reducing its resource cost by 1" (docs/phase7-wave2.md §9): a reduction the playing effect carries. */
  extraReduction = 0,
  /** The event's action cost decisions (`CostSelection`; docs/phase7-wave3.md §3.32, §3.36). */
  selection: CostSelection = {},
): PricedPlay | PriceFault {
  const plan = planCost(ctx.state, ctx.deps, cardInstanceId, playerId, cost, choices, handCardsIn(payment), selection);
  if (isFault(plan)) return plan;
  const card = mustCardOf(ctx.state, cardInstanceId);
  const printedX = "specialCost" in card && card.specialCost === "X";
  if (x !== undefined && (!printedX || !Number.isInteger(x) || x < 0))
    return {
      code: "invalid_choice",
      message: "X is chosen only for a cost printed X, as a whole number of at least 0",
    };
  const xValue = printedX ? (x ?? 0) : 0;
  if (requirementUnmeetable(ctx.state, playerId, cardInstanceId, ctx.deps, attachTo, xValue, extraReduction)) {
    return {
      code: "insufficient_resources",
      message: "its Requirement resources cannot all be spent on a cost this low",
    };
  }
  const requirement = playRequirement(
    ctx.state,
    playerId,
    cardInstanceId,
    plan.requirement,
    ctx.deps,
    attachTo,
    xValue,
    extraReduction,
  );
  const pool = priceOf(ctx, playerId, payment, cardInstanceId, plan.payingFor ?? cardInstanceId);
  if (isFault(pool)) return pool;
  if (!satisfies(pool, requirement)) {
    return {
      code: "insufficient_resources",
      message: `Needs ${describeRequirement(requirement)}; the payment covers ${poolTotal(pool)}.`,
    };
  }
  const vars = resourceVars(pool, plan.cost ?? cost, requirement);
  if (isFault(vars)) return vars;
  return { pool, plan, vars: { ...plan.vars, ...vars, ...(printedX ? { x: xValue } : {}) } };
}

/**
 * Pays for a priced play and records it; the caller pushes the play frame, then passes the returned spent cards to
 * `announceResourcesSpent`.
 */
export function commitPlay(
  ctx: Ctx,
  playerId: PlayerId,
  cardInstanceId: InstanceId,
  payment: readonly Payment[],
  priced: PricedPlay,
): readonly InstanceId[] {
  consumeCostReductions(ctx, ctx.deps, playerId, cardInstanceId);
  const spent = payPayment(ctx, playerId, payment);
  // Counted as played now, so a card cancelled later still counts toward "Max N per round" (RRG 1.8 "Max, Maximum").
  const played = mustCardOf(ctx.state, cardInstanceId);
  const byPlayer = `${playerId}:${played.type}`;
  ctx.state = {
    ...ctx.state,
    playedThisRound: { ...ctx.state.playedThisRound, [played.name]: (ctx.state.playedThisRound[played.name] ?? 0) + 1 },
    playedThisPhase: { ...ctx.state.playedThisPhase, [played.name]: (ctx.state.playedThisPhase[played.name] ?? 0) + 1 },
    playedByPlayerThisRound: {
      ...ctx.state.playedByPlayerThisRound,
      [byPlayer]: (ctx.state.playedByPlayerThisRound[byPlayer] ?? 0) + 1,
    },
    // "…if you have played a [Thwart] event this turn" (docs/phase7-wave3.md §3.24); only during a player's turn.
    ...(turnInProgress(ctx.state)
      ? {
          playedThisTurn: {
            ...ctx.state.playedThisTurn,
            [playerId]: [...(ctx.state.playedThisTurn?.[playerId] ?? []), cardInstanceId],
          },
        }
      : {}),
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
  if (cardOf(ctx.state, cardInstanceId)?.type === "event")
    moveCard(ctx, cardInstanceId, { kind: "resolving", playerId });
  return spent;
}

/**
 * Why a `playCostReduction` ability cannot reduce this play, or null (docs/phase7-wave3.md §3.20): it must be an active
 * ability of that kind on a card the player controls, in the right form, under its limit, matching the card, and — with
 * `fromHand` — the card must be played from hand. Its own cost must be payable.
 */
export function playCostReductionFault(
  state: GameState,
  deps: EngineDeps,
  instanceId: InstanceId,
  abilityId: string,
  playerId: PlayerId,
  cardInstanceId: InstanceId,
): PriceFault | null {
  const definition = deps.abilities[abilityId];
  const trigger = definition?.trigger;
  const reduction = definition?.playCostReduction;
  if (!definition || !trigger || !reduction)
    return { code: "no_valid_target", message: `${abilityId} does not reduce the cost of playing a card` };
  if (!activeAbilityRefs(state, instanceId, deps).some((ref) => ref.id === abilityId))
    return { code: "no_valid_target", message: `${abilityId} is not active on ${instanceId}` };
  if (controllerOf(state, instanceId) !== playerId)
    return { code: "no_valid_target", message: "that ability is on a card you do not control" };
  const form = "form" in trigger ? trigger.form : undefined;
  if (form && getPlayer(state, playerId)?.identity.form !== form)
    return { code: "wrong_form", message: `${abilityId} requires ${form} form` };
  if (limitReached(state, instanceId, asAbilityId(abilityId), definition, null, playerId))
    return { code: "limit_reached", message: `${abilityId} has reached its limit` };
  if (reduction.fromHand === true && !mustPlayer(state, playerId).hand.includes(cardInstanceId))
    return { code: "no_valid_target", message: "that ability only reduces a card played from your hand" };
  if (reduction.cards) {
    const context: EffectContext = {
      selfInstanceId: instanceId,
      controllerId: playerId,
      event: null,
      bindings: {},
      deps,
    };
    if (!matchesQuery(state, cardInstanceId, reduction.cards, context))
      return { code: "no_valid_target", message: "that ability does not reduce the cost of this card" };
  }
  const plan = planCost(state, deps, instanceId, playerId, definition.cost, {}, new Set());
  return isFault(plan) ? plan : null;
}

export function playCard(ctx: Ctx, command: Command & { type: "playCard" }): EngineError | null {
  const invalid = requireActivePlayer(ctx.state, command.playerId, command);
  if (invalid) return invalid;
  const player = mustPlayer(ctx.state, command.playerId);
  if (
    !player.hand.includes(command.cardInstanceId) &&
    !playableOutsideHand(ctx.state, ctx.deps, command.playerId, command.cardInstanceId)
  ) {
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
  // RRG 1.8 "Dash (Value)" (p. 15): "If a card has a dash (–) as its cost value, that card cannot be played and can only
  // enter play through other means." (docs/phase7-wave2.md §3.8).
  if ("specialCost" in card && card.specialCost === "dash") {
    return engineError("card_type_not_playable", "a card with a printed '—' cost cannot be played", command);
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
    return engineError(
      "card_type_not_playable",
      "this event can only be played when its interrupt or response triggers",
      command,
    );
  }
  if (
    card.type === "event" &&
    ability?.trigger.kind === "action" &&
    ability.trigger.form &&
    player.identity.form !== ability.trigger.form
  ) {
    return engineError("wrong_form", `this event requires ${ability.trigger.form} form`, command);
  }
  if (
    card.type === "event" &&
    actionConditionUnmet(ctx.state, ctx.deps, ability, command.cardInstanceId, command.playerId)
  ) {
    return engineError("no_valid_target", "this event's condition is not met", command);
  }

  // RRG "Restricted": a player cannot control more than two at a time, so playing
  // a third is not a legal action in the first place.
  if (hasKeyword(ctx.state, command.cardInstanceId, "restricted", ctx.deps)) {
    // Two, or more with "you can control 1 additional … restricted" (`restrictedLimit`, docs/phase7-wave3.md §3.22).
    const held = [...restrictedCardsOf(ctx.state, command.playerId, ctx.deps), command.cardInstanceId];
    const limit = restrictedLimitFor(ctx.state, ctx.deps, command.playerId, held);
    if (held.length > limit) {
      return engineError("no_valid_target", `you already control ${limit} restricted cards`, command);
    }
  }

  // "Play under any player's control": the command may name another player as controller.
  const controllerId = command.controllerId ?? command.playerId;
  const controller = getPlayer(ctx.state, controllerId);
  if (!controller || controller.eliminated)
    return engineError("no_valid_target", "no such player to control the card", command);
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
    if (held >= restrictions.maxPerPlayer)
      return engineError("no_valid_target", `max ${restrictions.maxPerPlayer} per player`, command);
  }
  const restricted = playRestrictionFault(ctx.state, ctx.deps, command.playerId, card, command.cardInstanceId);
  if (restricted) return engineError(restricted.code, restricted.message, command);
  // "You cannot play hero-specific cards." (Depowered; `cannotPlay`, docs/phase7-wave2.md §3.11).
  if (cannotPlayCard(ctx.state, ctx.deps, command.playerId, command.cardInstanceId)) {
    return engineError("no_valid_target", "you cannot play that card right now", command);
  }

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
    const match = matchingCardInPlay(ctx.state, card, new Set(), controllerId, ctx.deps);
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
      const context: EffectContext = {
        selfInstanceId: command.cardInstanceId,
        controllerId,
        event: null,
        bindings: {},
        deps: ctx.deps,
      };
      if (!attachmentHostCandidates(ctx.state, card.attachesTo, context).includes(attachTo)) {
        return engineError("no_valid_target", `upgrade must attach to ${card.attachesTo.kind}`, command);
      }
    } else if (attachTo !== ownIdentity) {
      return engineError("no_valid_target", "this upgrade attaches to your identity", command);
    }
    // "Max N per enemy/ally": copies already attached to that host.
    if (restrictions?.maxPerHost !== undefined) {
      const onHost = mustInstance(ctx.state, attachTo).attachments.filter(
        (id) => cardOf(ctx.state, id)?.name === card.name,
      ).length;
      if (onHost >= restrictions.maxPerHost)
        return engineError("no_valid_target", `max ${restrictions.maxPerHost} per host`, command);
    }
  }

  // "Reduce the cost to play that card by 3" (Star-Lord; docs/phase7-wave3.md §3.20): each named ability is checked
  // before pricing, so a refused one costs nothing.
  const reductions = command.costReductionAbilities ?? [];
  let extraReduction = 0;
  for (const [index, { instanceId, abilityId }] of reductions.entries()) {
    if (reductions.findIndex((other) => other.instanceId === instanceId && other.abilityId === abilityId) !== index)
      return engineError("invalid_choice", "the same cost reduction is named twice", command);
    const fault = playCostReductionFault(
      ctx.state,
      ctx.deps,
      instanceId,
      abilityId,
      command.playerId,
      command.cardInstanceId,
    );
    if (fault) return engineError(fault.code, fault.message, command);
    extraReduction += ctx.deps.abilities[abilityId]?.playCostReduction?.amount ?? 0;
  }

  const priced = pricePlay(
    ctx,
    command.playerId,
    command.cardInstanceId,
    ability?.cost,
    command.payment,
    command.costChoices ?? {},
    attachTo,
    command.x,
    extraReduction,
    command.costSelection,
  );
  if (isFault(priced)) return engineError(priced.code, priced.message, command);

  const spent = commitPlay(ctx, command.playerId, command.cardInstanceId, command.payment, priced);
  for (const { instanceId, abilityId } of reductions) {
    const definition = ctx.deps.abilities[abilityId];
    if (!definition) continue;
    const plan = planCost(ctx.state, ctx.deps, instanceId, command.playerId, definition.cost, {}, new Set());
    if (!isFault(plan)) payCost(ctx, instanceId, command.playerId, definition.cost, plan);
    recordAbilityUse(ctx, instanceId, abilityId, definition, null, command.playerId);
    emit(ctx, {
      type: "playCostReduced",
      cardInstanceId: command.cardInstanceId,
      instanceId,
      abilityId,
      amount: definition.playCostReduction?.amount ?? 0,
    });
  }
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
  announceResourcesSpent(ctx, command.playerId, spent, command.cardInstanceId, "playCard");
  return null;
}

/** Where an effect plays a card from "as if it were in your hand" (`EffectSpec playFromHand.from`). */
export type PlayFromZone = "hand" | "setAside";

/**
 * The play restrictions every "play a card from your hand" effect checks, whatever it does about the cost. RRG 1.8
 * "Play, Put Into Play" (p. 32) and "Play Restrictions and Permissions" (p. 33): playing a card through an effect is
 * still *playing* it, so form, "max per", Restricted, the unique rule and `cannotPlay` all apply.
 */
function playFromEffectRestrictionFault(
  ctx: Ctx,
  playerId: PlayerId,
  id: InstanceId,
  from: PlayFromZone = "hand",
): string | null {
  const card = cardOf(ctx.state, id);
  const player = getPlayer(ctx.state, playerId);
  if (!card || !player || !player[from].includes(id)) return from === "hand" ? "not in hand" : "not set aside";
  if (!("cost" in card)) return "not a card that is played";
  if ("specialCost" in card && card.specialCost === "dash") return "a '—' cost cannot be played";
  const restrictions = "playRestrictions" in card ? card.playRestrictions : undefined;
  if (restrictions?.form && player.identity.form !== restrictions.form) return "wrong form";
  if (
    playRestrictionFault(ctx.state, ctx.deps, playerId, card, id) ||
    cannotPlayCard(ctx.state, ctx.deps, playerId, id)
  )
    return "a play restriction";
  if (hasKeyword(ctx.state, id, "restricted", ctx.deps)) {
    const held = [...restrictedCardsOf(ctx.state, playerId, ctx.deps), id];
    if (held.length > restrictedLimitFor(ctx.state, ctx.deps, playerId, held)) return "the restricted card limit";
  }
  if (entersPlayWhenPlayed(card) && matchingCardInPlay(ctx.state, card, new Set(), playerId, ctx.deps))
    return "a matching unique card is in play";
  return null;
}

/**
 * Why a card in hand cannot be played by an effect "ignoring its resource cost" (Chaos Magic: "Play a card from your hand,
 * ignoring its resource cost."; docs/phase7-wave2.md §3.8), or null. The play restrictions still apply; a Requirement
 * card cannot be (RRG 1.8 "Requirement (Resources)", p. 37: "cannot be played 'ignoring its resource cost' because the
 * required resources cannot be paid for it"), nor a dash cost (RRG 1.8 "Dash (Value)", p. 15). Kept conservative: an
 * event is playable only through an action ability with no cost of its own, and an upgrade only onto its own identity.
 */
export function playIgnoringCostFault(
  ctx: Ctx,
  playerId: PlayerId,
  id: InstanceId,
  from: PlayFromZone = "hand",
): string | null {
  const restriction = playFromEffectRestrictionFault(ctx, playerId, id, from);
  if (restriction) return restriction;
  const card = mustCardOf(ctx.state, id);
  const player = mustPlayer(ctx.state, playerId);
  if ("keywords" in card && card.keywords.some((keyword) => keyword.name === "requirement")) {
    return "a Requirement card cannot be played ignoring its cost";
  }
  if (card.type === "upgrade" && card.attachesTo) return "an upgrade with a host of its own";
  if (card.type === "event") {
    const ability = eventActionAbility(ctx, card);
    if (!ability || ability.cost) return "an event with no cost-free action";
    if (ability.trigger.kind === "action" && ability.trigger.form && player.identity.form !== ability.trigger.form)
      return "wrong form";
    if (actionConditionUnmet(ctx.state, ctx.deps, ability, id, playerId)) return "its condition is not met";
  }
  return null;
}

/**
 * Why a card in hand cannot be played by an effect that **pays** for it, at a reduced cost ("play a card from your hand
 * that shares a trait with your hero, reducing its resource cost by 1", Team-Building Exercise; docs/phase7-wave2.md
 * §9), or null.
 *
 * Unlike the ignore-cost path, a Requirement card **is** legal: its required resources are genuinely spent here.
 * Affordability is part of the check because RRG 1.8 "Initiating Abilities" (p. 24) step 3 makes "the player's ability
 * to pay" a condition of playing at all, and step 5 aborts a play whose costs cannot be paid — so a card the player
 * cannot pay for is not something this effect may choose. The test is whether the *largest* payment the player could
 * make covers the cost; a player who then selects less simply does not play the card.
 */
export function playWithPaymentFault(
  ctx: Ctx,
  playerId: PlayerId,
  id: InstanceId,
  extraReduction: number,
  from: PlayFromZone = "hand",
): string | null {
  const restriction = playFromEffectRestrictionFault(ctx, playerId, id, from);
  if (restriction) return restriction;
  const card = mustCardOf(ctx.state, id);
  const player = mustPlayer(ctx.state, playerId);
  const abilityCost = card.type === "event" ? eventActionAbility(ctx, card)?.cost : undefined;
  if (card.type === "event") {
    const ability = eventActionAbility(ctx, card);
    if (!ability) return "an event with no action ability";
    if (ability.trigger.kind === "action" && ability.trigger.form && player.identity.form !== ability.trigger.form)
      return "wrong form";
    if (actionConditionUnmet(ctx.state, ctx.deps, ability, id, playerId)) return "its condition is not met";
  }
  // The ability's own cost has to be settleable without asking: `planCost` fills in a pick with exactly one legal
  // candidate, and anything more ambiguous has nowhere to prompt from inside this effect (§9's capability note).
  const plan = planCost(ctx.state, ctx.deps, id, playerId, abilityCost, {}, new Set([id]));
  if (isFault(plan)) return "its own ability cost cannot be paid without a further choice";
  const attachTo = hostForEffectPlay(ctx, playerId, id);
  if (attachTo === undefined) return "no legal host";
  if (requirementUnmeetable(ctx.state, playerId, id, ctx.deps, attachTo, 0, extraReduction)) {
    return "its Requirement resources cannot all be spent on a cost this low";
  }
  const requirement = playRequirement(ctx.state, playerId, id, plan.requirement, ctx.deps, attachTo, 0, extraReduction);
  if (requirementTotal(requirement) === 0) return null;
  // Every option that is legal for *this* card on its own — which drops the ones a "you can only spend [physical]
  // resources to pay for this card" restriction forbids (FAQ "Crushing Blow (#2)", p. 60) — then all of them at once.
  // `satisfies` is monotone in what the pool holds, so if the largest legal payment falls short, no subset covers it.
  // It can still over-offer in one narrow case: two resource abilities whose own costs conflict with each other. That
  // direction is safe — the player simply cannot complete the payment and nothing is played.
  const usable = paymentOptions(ctx, playerId, id).filter(
    (option) => priceOrNull(ctx, playerId, paymentsFromOptionIds([option.optionId]), id) !== null,
  );
  const most = priceOrNull(ctx, playerId, paymentsFromOptionIds(usable.map((option) => option.optionId)), id);
  return most !== null && satisfies(most, requirement) ? null : "not enough resources to pay for it";
}

/**
 * Where an upgrade played by an effect attaches: its own identity when it names no host, else the single legal host.
 * `undefined` means there is none and the card cannot be played; `null` means "not an upgrade", i.e. no host needed.
 *
 * Several legal hosts is a player choice the effect asks for separately (`executePlayFromHand`); this is the
 * no-question-to-ask case, and the shape the caller uses once that choice is answered.
 */
export function hostForEffectPlay(ctx: Ctx, playerId: PlayerId, id: InstanceId): InstanceId | null | undefined {
  const card = mustCardOf(ctx.state, id);
  if (card.type !== "upgrade") return null;
  if (!card.attachesTo) return mustPlayer(ctx.state, playerId).identity.instanceId;
  const context: EffectContext = {
    selfInstanceId: id,
    controllerId: playerId,
    event: null,
    bindings: {},
    deps: ctx.deps,
  };
  const [first] = attachmentHostCandidates(ctx.state, card.attachesTo, context);
  return first ?? undefined;
}

/** Every legal host for an upgrade an effect is about to play; empty for a card that needs none. */
export function hostChoicesForEffectPlay(ctx: Ctx, playerId: PlayerId, id: InstanceId): readonly InstanceId[] {
  const card = mustCardOf(ctx.state, id);
  if (card.type !== "upgrade" || !card.attachesTo) return [];
  const context: EffectContext = {
    selfInstanceId: id,
    controllerId: playerId,
    event: null,
    bindings: {},
    deps: ctx.deps,
  };
  return attachmentHostCandidates(ctx.state, card.attachesTo, context);
}

/**
 * What an effect-played card demands right now, at the effect's reduced cost: its own cost plus its ability's, with
 * the reduction applied. Null when its ability cost cannot be settled without a further choice.
 */
export function playFromEffectRequirement(
  ctx: Ctx,
  playerId: PlayerId,
  id: InstanceId,
  attachTo: InstanceId | null,
  extraReduction: number,
): ResolvedRequirement | null {
  const card = mustCardOf(ctx.state, id);
  const abilityCost = card.type === "event" ? eventActionAbility(ctx, card)?.cost : undefined;
  const plan = planCost(ctx.state, ctx.deps, id, playerId, abilityCost, {}, new Set([id]));
  if (isFault(plan)) return null;
  return playRequirement(ctx.state, playerId, id, plan.requirement, ctx.deps, attachTo, 0, extraReduction);
}

/**
 * Plays a card from hand for a payment the effect's own reduction has already been applied to (Team-Building
 * Exercise). Returns false, having spent nothing, when the payment does not cover the reduced cost.
 */
export function playWithPayment(
  ctx: Ctx,
  playerId: PlayerId,
  id: InstanceId,
  payment: readonly Payment[],
  attachTo: InstanceId | null,
  extraReduction: number,
): boolean {
  const card = mustCardOf(ctx.state, id);
  const ability = card.type === "event" ? eventActionAbility(ctx, card) : undefined;
  const priced = pricePlay(ctx, playerId, id, ability?.cost, payment, {}, attachTo, undefined, extraReduction);
  if (isFault(priced)) return false;
  const spent = commitPlay(ctx, playerId, id, payment, priced);
  pushPlayCardFrame(ctx, id, playerId, attachTo, undefined, { bindings: priced.plan.bindings, vars: priced.vars });
  payCost(ctx, id, playerId, ability?.cost, priced.plan);
  announceResourcesSpent(ctx, playerId, spent, id, "playCard");
  return true;
}

/**
 * Plays a card from hand ignoring its resource cost. RRG 1.8 "Ignore" (p. 23): "no resources are paid for that card. For
 * the purpose of card effects, that card is considered to have been played with zero resources paid for its cost." So
 * `paid.*` are all 0. It counts as played (max per round/phase, "the first ally played each round").
 */
export function playIgnoringCost(ctx: Ctx, playerId: PlayerId, id: InstanceId, from: PlayFromZone = "hand"): void {
  if (playIgnoringCostFault(ctx, playerId, id, from)) return;
  const plan = planCost(ctx.state, ctx.deps, id, playerId, undefined, {}, new Set());
  if (isFault(plan)) return;
  const vars = {
    ...plan.vars,
    "paid.physical": 0,
    "paid.mental": 0,
    "paid.energy": 0,
    "paid.wild": 0,
    "paid.total": 0,
  };
  const priced: PricedPlay = { pool: EMPTY_POOL, plan, vars };
  commitPlay(ctx, playerId, id, [], priced);
  const card = mustCardOf(ctx.state, id);
  const attachTo = card.type === "upgrade" ? mustPlayer(ctx.state, playerId).identity.instanceId : null;
  pushPlayCardFrame(ctx, id, playerId, attachTo, undefined, { bindings: plan.bindings, vars });
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
  if (!activeAbilityRefs(ctx.state, command.cardInstanceId, ctx.deps).some((ref) => ref.id === command.abilityId)) {
    return engineError("no_valid_target", `${command.abilityId} is not active on that card`, command);
  }
  // "Players cannot trigger 'Alter-Ego Action' abilities on obligations." (`cannotTriggerActions`, §3.11).
  if (cannotTriggerAction(ctx.state, ctx.deps, command.cardInstanceId, definition.trigger.form)) {
    return engineError("no_valid_target", "that ability cannot be triggered right now", command);
  }
  if (actionConditionUnmet(ctx.state, ctx.deps, definition, command.cardInstanceId, command.playerId)) {
    return engineError("no_valid_target", "that ability cannot be triggered: its condition is not met", command);
  }
  const controller = controllerOf(ctx.state, command.cardInstanceId);
  if (controller !== null && controller !== command.playerId) {
    return engineError("no_valid_target", "you do not control that card", command);
  }
  // An obligation is controlled by nobody, but RRG 1.8 "Obligation" (p. 30): "Only the player with the obligation in
  // their play area can trigger abilities or pay costs on that obligation" (MC10 p. 17 says the same of its Alter-Ego
  // Action), however it got there.
  if (mustCardOf(ctx.state, command.cardInstanceId).type === "obligation") {
    const holder = ctx.state.players.find((p) => p.playArea.includes(command.cardInstanceId));
    if (holder && holder.playerId !== command.playerId) {
      return engineError(
        "no_valid_target",
        "only the player with that obligation in their play area can use it",
        command,
      );
    }
  }
  if (definition.trigger.firstPlayerOnly === true && command.playerId !== ctx.state.firstPlayerId) {
    return engineError("no_valid_target", "only the first player may trigger that ability", command);
  }
  const player = mustPlayer(ctx.state, command.playerId);
  if (definition.trigger.form && player.identity.form !== definition.trigger.form) {
    return engineError("wrong_form", `${command.abilityId} requires ${definition.trigger.form} form`, command);
  }
  // "(Limit once per round per player.)" counts the triggering player's uses (docs/phase7-wave3.md §3.36).
  if (limitReached(ctx.state, command.cardInstanceId, command.abilityId, definition, null, command.playerId)) {
    const limit = definition.limit;
    return engineError("limit_reached", `limit ${limit?.count} per ${limit?.period}`, command);
  }
  const plan = planCost(
    ctx.state,
    ctx.deps,
    command.cardInstanceId,
    command.playerId,
    definition.cost,
    command.costChoices ?? {},
    handCardsIn(command.payment),
    command.costSelection,
  );
  if (isFault(plan)) return engineError(plan.code, plan.message, command);
  const pool = priceOf(ctx, command.playerId, command.payment, null, plan.payingFor);
  if (isFault(pool)) return engineError(pool.code, pool.message, command);
  if (!satisfies(pool, plan.requirement)) {
    return engineError(
      "insufficient_resources",
      `need ${requirementTotal(plan.requirement)}, paid ${poolTotal(pool)}`,
      command,
    );
  }
  const vars = resourceVars(pool, plan.cost ?? definition.cost, plan.requirement);
  if (isFault(vars)) return engineError(vars.code, vars.message, command);

  const spent = payPayment(ctx, command.playerId, command.payment);
  pushActionAbility(ctx, command.cardInstanceId, command.abilityId, command.playerId, plan.bindings, {
    ...plan.vars,
    ...vars,
  });
  payCost(ctx, command.cardInstanceId, command.playerId, definition.cost, plan);
  announceResourcesSpent(ctx, command.playerId, spent, command.cardInstanceId, "ability");
  return null;
}

function usableCharacter(ctx: Ctx, playerId: PlayerId, characterId: InstanceId, command: Command): EngineError | null {
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
  /** Receives the cards the payment spent, for the caller to announce once the power is on the stack. */
  spentOut: InstanceId[],
): EngineError | null {
  const cost = basicPowerCost(ctx.state, ctx.deps, characterId, power);
  if (!cost) return null;
  const payment = command.payment ?? [];
  const plan = planCost(
    ctx.state,
    ctx.deps,
    characterId,
    command.playerId,
    cost,
    command.costChoices ?? {},
    handCardsIn(payment),
  );
  if (isFault(plan)) return engineError(plan.code, plan.message, command);
  const pool = priceOf(ctx, command.playerId, payment, null, null);
  if (isFault(pool)) return engineError(pool.code, pool.message, command);
  if (!satisfies(pool, plan.requirement)) {
    return engineError(
      "insufficient_resources",
      `need ${requirementTotal(plan.requirement)}, paid ${poolTotal(pool)}`,
      command,
    );
  }
  spentOut.push(...payPayment(ctx, command.playerId, payment));
  payCost(ctx, characterId, command.playerId, cost, plan);
  return null;
}

/**
 * RRG "Consequential Damage": tier 5 of the timing chart, after the attack fully resolves.
 *
 * Returns where the basic power's own attack/thwart event(s) report their results (docs/phase7-wave3.md §3.44): into
 * this damage event, prefixed `attack.`/`thwart.`, so "After Martyr takes consequential damage from performing an
 * attack, if that attack defeated an enemy" (Martyr, `drax` 19012) reads `attack.defeated` in the damage's own response
 * window. The damage is pushed first and so resolves after the power (LIFO); the power's frame reports into it as it
 * finishes, before the damage applies. Null when the ally takes none.
 */
function pushConsequentialDamage(ctx: Ctx, characterId: InstanceId, kind: "attack" | "thwart"): ReportTarget | null {
  const card = cardOf(ctx.state, characterId);
  if (card?.type !== "ally") return null;
  const printed = kind === "attack" ? card.consequentialDamage.attack : card.consequentialDamage.thwart;
  // "Takes +1 consequential damage after it attacks" (Enraged): a modifier on the printed value.
  const amount = Math.max(
    0,
    printed +
      statBonus(ctx.state, ctx.deps, characterId, kind === "attack" ? "consequentialAttack" : "consequentialThwart"),
  );
  if (amount <= 0) return null;
  const frameId = pushEvent(ctx, {
    kind: "dealDamage",
    targetInstanceId: characterId,
    amount,
    sourceInstanceId: characterId,
    fromAttack: false,
    consequential: true,
  });
  return { frameId, prefix: kind };
}

/**
 * A basic power whose extra cost spent cards announces them on top of everything the power pushed, so "after you spend
 * this card" resolves before the power does (docs/phase7-wave2.md §12) — also when a stun or confusion cancels the
 * power, since its costs are still paid (RRG 1.8 "Stun, Stunned", p. 41; "Confuse, Confused", p. 13).
 */
function withSpentAnnounced<C extends Command & { type: "basicAttack" | "basicThwart" }>(
  run: (ctx: Ctx, command: C, spent: InstanceId[]) => EngineError | null,
  characterOf: (command: C) => InstanceId,
): (ctx: Ctx, command: C) => EngineError | null {
  return (ctx, command) => {
    const spent: InstanceId[] = [];
    const error = run(ctx, command, spent);
    if (!error) announceResourcesSpent(ctx, command.playerId, spent, characterOf(command), "ability");
    return error;
  };
}

export const basicAttack = withSpentAnnounced(basicAttackPaying, (command) => command.attackerInstanceId);
export const basicThwart = withSpentAnnounced(basicThwartPaying, (command) => command.thwarterInstanceId);

function basicAttackPaying(
  ctx: Ctx,
  command: Command & { type: "basicAttack" },
  spent: InstanceId[],
): EngineError | null {
  const invalid = requireActivePlayer(ctx.state, command.playerId, command);
  if (invalid) return invalid;
  const unusable = usableCharacter(ctx, command.playerId, command.attackerInstanceId, command);
  if (unusable) return unusable;

  const shares = dividedShares(
    ctx,
    command,
    command.attackerInstanceId,
    command.targetInstanceId,
    "attack",
    command.divide,
  );
  if ("code" in shares) return shares;
  // Every target is checked now, when the power is used (FAQ "Wasp (#1C)", RRG 1.8 p. 61).
  for (const { targetInstanceId } of shares) {
    const targetCard = cardOf(ctx.state, targetInstanceId);
    const targetIsEnemy =
      (targetCard?.type === "villain" && villainOf(ctx.state, targetInstanceId)?.defeated === false) ||
      isMinion(ctx.state, targetInstanceId);
    if (!targetIsEnemy) return engineError("no_valid_target", "basic attacks target enemies", command);
    // The Once and Future Kang insert: "Players cannot attack or defend enemies in other game areas" (§3.1).
    if (!sameGameArea(areaOfPlayer(ctx.state, command.playerId), areaOfCard(ctx.state, targetInstanceId))) {
      return engineError("no_valid_target", "that enemy is in another game area", command);
    }
    if (!canAttack(ctx.state, command.attackerInstanceId, targetInstanceId, ctx.deps)) {
      return engineError("no_valid_target", "a guard minion blocks attacks against the villain", command);
    }
  }

  if (characterProfile(ctx.state, command.attackerInstanceId, ctx.deps)?.missing.includes("atk")) {
    return engineError("no_valid_target", "a character with a printed '—' ATK cannot attack", command);
  }
  const unpaid = payBasicPowerCost(ctx, command, command.attackerInstanceId, "attack", spent);
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
  announceBasicPower(ctx, command.attackerInstanceId, "attack", command.playerId);
  const consequential = pushConsequentialDamage(ctx, command.attackerInstanceId, "attack");
  if (!command.divide) {
    pushEvent(
      ctx,
      {
        kind: "attack",
        attackerInstanceId: command.attackerInstanceId,
        targetInstanceId: command.targetInstanceId,
        playerId: command.playerId,
        basic: true,
      },
      consequential,
    );
  } else {
    // "Wasp is considered to attack each target affected by her divided basic attack" (FAQ "Wasp (#1C)"): one attack per
    // target, in the order given, so each retaliate resolves in the order of her choice.
    pushEvents(
      ctx,
      shares.map(({ targetInstanceId, amount }) => ({
        kind: "attack" as const,
        attackerInstanceId: command.attackerInstanceId,
        targetInstanceId,
        playerId: command.playerId,
        basic: true,
        amount,
      })),
      consequential,
    );
  }
  announceBasicPowerUsing(ctx, command.attackerInstanceId, "attack", command.playerId);
  return null;
}

function basicThwartPaying(
  ctx: Ctx,
  command: Command & { type: "basicThwart" },
  spent: InstanceId[],
): EngineError | null {
  const invalid = requireActivePlayer(ctx.state, command.playerId, command);
  if (invalid) return invalid;
  const unusable = usableCharacter(ctx, command.playerId, command.thwarterInstanceId, command);
  if (unusable) return unusable;
  if (cannotThwart(ctx.state, ctx.deps, command.playerId)) {
    return engineError("no_valid_target", "you cannot thwart", command);
  }

  const shares = dividedShares(
    ctx,
    command,
    command.thwarterInstanceId,
    command.schemeInstanceId,
    "thwart",
    command.divide,
  );
  if ("code" in shares) return shares;
  for (const { targetInstanceId: schemeId } of shares) {
    const schemeCard = cardOf(ctx.state, schemeId);
    const isMainScheme = mainSchemeStateOf(ctx.state, schemeId) !== undefined;
    const isSideScheme =
      (schemeCard?.type === "side_scheme" || schemeCard?.type === "player_side_scheme") &&
      ctx.state.villainArea.includes(schemeId);
    if (!isMainScheme && !isSideScheme) {
      return engineError("no_valid_target", "target is not a scheme in play", command);
    }
    // "they cannot target any game elements in the other game areas" (The Once and Future Kang insert; §3.1).
    const thwarterArea = areaOfPlayer(ctx.state, command.playerId);
    if (!sameGameArea(thwarterArea, areaOfCard(ctx.state, schemeId))) {
      return engineError("no_valid_target", "that scheme is in another game area", command);
    }
    // RRG "Crisis Icon": while any crisis icon is in play, player cards cannot remove threat from the main scheme. For a
    // divided thwart this holds "even if the card [...] is removed from play during her basic thwart's resolution" (FAQ
    // "Wasp (#1C)"), which checking every share now gives.
    if (isMainScheme && countSchemeIcons(ctx.state, "crisis", thwarterArea) > 0) {
      return engineError("no_valid_target", "a crisis icon blocks thwarting the main scheme", command);
    }
    // RRG 1.8 "Patrol" (p. 32): the engaged player "cannot use cards they control to thwart the main scheme" — checked
    // per share, as the crisis icon is (FAQ "Wasp (#1C)", p. 61, names both). docs/phase7-wave3.md §3.5.
    if (isMainScheme && patrolledBy(ctx.state, ctx.deps, command.playerId)) {
      return engineError(
        "no_valid_target",
        "a minion with patrol engaged with you blocks thwarting the main scheme",
        command,
      );
    }
  }

  // RRG 1.8 "Assault" (p. 8): "Basic thwarts against this scheme use ATK instead of THW"; The Red House's optional
  // "they may use their ATK instead of their THW" is `thwartWithAtk` (docs/phase7-wave2.md §3.11). A divided thwart is THW.
  const assault = !command.divide && hasKeyword(ctx.state, command.schemeInstanceId, "assault", ctx.deps);
  if (
    command.useAtk &&
    !assault &&
    (command.divide || !mayThwartWithAtk(ctx.state, ctx.deps, command.schemeInstanceId))
  ) {
    return engineError("no_valid_target", "this thwart cannot use ATK", command);
  }
  const useAtk = assault || command.useAtk === true;
  const thwartStat = useAtk ? "atk" : "thw";
  if (characterProfile(ctx.state, command.thwarterInstanceId, ctx.deps)?.missing.includes(thwartStat)) {
    return engineError(
      "no_valid_target",
      `a character with a printed '—' ${thwartStat.toUpperCase()} cannot thwart this way`,
      command,
    );
  }
  const confused = statusActive(ctx.state, command.thwarterInstanceId, "confused", ctx.deps);
  const scheme = mustInstance(ctx.state, command.schemeInstanceId);
  if (scheme.threat < 1 && !confused) {
    return engineError("no_valid_target", "scheme has no threat to remove", command);
  }
  const unpaid = payBasicPowerCost(ctx, command, command.thwarterInstanceId, "thwart", spent);
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
  if (thwarterProfile.missing.includes(thwartStat)) {
    return engineError(
      "no_valid_target",
      `a character with a printed '—' ${thwartStat.toUpperCase()} cannot thwart this way`,
      command,
    );
  }
  announceBasicPower(ctx, command.thwarterInstanceId, "thwart", command.playerId);
  const consequential = pushConsequentialDamage(ctx, command.thwarterInstanceId, "thwart");
  if (!command.divide) {
    pushEvent(
      ctx,
      {
        kind: "thwart",
        thwarterInstanceId: command.thwarterInstanceId,
        schemeInstanceId: command.schemeInstanceId,
        playerId: command.playerId,
        basic: true,
        ...(useAtk ? { useAtk: true } : {}),
      },
      consequential,
    );
  } else {
    // "simultaneously remove threat from each scheme that Wasp chooses" (FAQ "Wasp (#1C)"): one thwart per scheme.
    pushEvents(
      ctx,
      shares.map(({ targetInstanceId, amount }) => ({
        kind: "thwart" as const,
        thwarterInstanceId: command.thwarterInstanceId,
        schemeInstanceId: targetInstanceId,
        playerId: command.playerId,
        basic: true,
        amount,
      })),
      consequential,
    );
  }
  announceBasicPowerUsing(ctx, command.thwarterInstanceId, "thwart", command.playerId);
  return null;
}

/**
 * The targets of a basic power: the one target, or a divided power's shares (docs/phase7-wave2.md §3.7). A division
 * needs the character's `divideBasicPower` rule, distinct targets starting with the command's own, whole shares of at
 * least 1, and shares that total the power's current value.
 */
function dividedShares(
  ctx: Ctx,
  command: Command,
  characterId: InstanceId,
  firstTarget: InstanceId,
  power: "attack" | "thwart",
  divide: readonly BasicPowerShare[] | undefined,
): readonly BasicPowerShare[] | EngineError {
  if (!divide) return [{ targetInstanceId: firstTarget, amount: 0 }];
  if (!canDivideBasicPower(ctx.state, ctx.deps, characterId, power))
    return engineError("no_valid_target", `this ${power} cannot be divided`, command);
  const targets = divide.map((share) => share.targetInstanceId);
  if (divide.length === 0 || divide[0]?.targetInstanceId !== firstTarget || new Set(targets).size !== targets.length) {
    return engineError(
      "no_valid_target",
      "a divided power names distinct targets, the first being the command's target",
      command,
    );
  }
  if (divide.some((share) => !Number.isInteger(share.amount) || share.amount < 1))
    return engineError("no_valid_target", "each share is at least 1", command);
  const value = characterProfile(ctx.state, characterId, ctx.deps)?.[power === "attack" ? "atk" : "thw"] ?? 0;
  const total = divide.reduce((sum, share) => sum + share.amount, 0);
  if (total !== value) return engineError("no_valid_target", `the shares must total ${value}`, command);
  return divide;
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
  announceBasicPower(ctx, player.identity.instanceId, "recover", command.playerId);
  return null;
}

/**
 * "After you use a basic power" (docs/phase7-wave2.md §3.11): announced beneath the power's own events, so its responses
 * come after the power has resolved, and only when an ability could react. A stunned attack or a confused thwart never
 * reaches here (FAQ "Quicksilver (#1A)", RRG 1.8 p. 61).
 */
export function announceBasicPower(
  ctx: Ctx,
  characterId: InstanceId,
  power: "attack" | "thwart" | "defense" | "recover",
  playerId: PlayerId,
): void {
  const event: TriggerEvent = { kind: "basicPowerUsed", characterInstanceId: characterId, power, playerId };
  if (heard(ctx.state, ctx.deps, event)) pushEvent(ctx, event);
}

/**
 * "When you use one of your hero's basic powers" (docs/phase7-wave2.md §17.4): pushed *on top of* the power's own
 * events, so its interrupt window resolves before the power's value is read. Like its "used" twin it goes on the stack
 * only when an ability could react, and a stunned attack or confused thwart never reaches either of them (the cancel
 * returns before both), so a power that is cancelled is not "used" for any timing.
 */
export function announceBasicPowerUsing(
  ctx: Ctx,
  characterId: InstanceId,
  power: "attack" | "thwart" | "defense" | "recover",
  playerId: PlayerId,
): void {
  const event: TriggerEvent = { kind: "basicPowerUsing", characterInstanceId: characterId, power, playerId };
  if (heard(ctx.state, ctx.deps, event)) pushEvent(ctx, event);
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
