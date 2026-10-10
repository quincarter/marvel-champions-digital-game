import { abilityId as asAbilityId, requirementResources, type AbilityId, type AnyCard } from "@mc/content";
import { displayNameOf } from "./visibility.js";
import {
  DEFAULT_DEPS,
  type AbilityCost,
  type AbilityDefinition,
  type AbilityRegistry,
  type AbilityTriggerSpec,
  type CostModifierSpec,
  type EngineDeps,
  type ResourceGeneration,
  type ResourceMultiplierSpec,
} from "./abilities.js";
import type { ChoiceOption } from "./choices.js";
import type { BasicPowerShare, Command, CostChoices, CostSelection, Payment, ResourceAbilityUse } from "./commands.js";
import { createCtx, emit, moveCard, setFrame, updateFrame, updateInstance, type Ctx } from "./ctx.js";
import {
  addCounters,
  areaCostReductionFor,
  consumeAreaCostReductions,
  consumeCostReductions,
  costReductionFor,
  dealEncounterCardTo,
  discardFromDeckAsCost,
  discardFromHand,
  discardFromPlay,
  discardRandomFromHand,
  discardStatusCards,
  exhaustCard,
  giveStatus,
  healDamage,
  permanentStopsLeaving,
  removeCounters,
  changeIdentityForm,
  startNextBasicPowerEffects,
  turnToFlipSide,
} from "./effects.js";
import { engineError, EngineInvariantError, type EngineError, type EngineErrorCode } from "./errors.js";
import { finishTurn } from "./flow.js";
import { statBonus } from "./modifiers.js";
import {
  canDivideBasicPower,
  attachLimitFault,
  cannotBeHealed,
  cannotChangeForm,
  formChangeCostsFor,
  cannotChooseToDiscard,
  cannotFlip,
  cannotLeavePlay,
  cannotRecover,
  cannotEnterPlay,
  cannotPlayCard,
  cannotTakeDamage,
  cannotThwart,
  cannotTriggerAction,
  characterCannotRemoveThreat,
  triggeredAbilityForbidden,
  iconsInPlay,
  mayThwartWithAtk,
  patrolledBy,
  playerTraitLimitFault,
  attachmentReachOf,
  playDestinationsOf,
} from "./rules.js";
import {
  inPlayPicksOf,
  type DamageCostPick,
  type DiscardCombined,
  type InPlayCostMode,
  type InPlayCostPick,
  tuckedPickOf,
  fixedResourcesOf,
  resourcesChoiceOf,
} from "./abilities.js";
import type { BasicPowerName, EffectSpec, StatName, TargetRef, ValueSpec } from "./spec.js";
import { BASIC_POWER_STAT, cardFlippedEvent, carriedByEvent, type TriggerEvent } from "./trigger-events.js";
import { instanceId as asInstanceId, type FrameId, type InstanceId, type PlayerId } from "./ids.js";
import { attackKeywordsOf, canTakeStatus, hasKeyword, statusActive } from "./keywords.js";
import {
  canTakeCostDamage,
  chosenSelfCostDamageEffects,
  DAMAGE_SELF_MAX_VAR,
  DAMAGE_SELF_MIN_VAR,
  damageSelfChoiceRange,
  isDamageSelfChoice,
  costDamageEffects,
  indirectDamageCapacity,
  pickedCostDamageEffects,
  selfCostDamageEffects,
} from "./cost-damage.js";
import {
  chosenDeckDiscardEffects,
  DECK_DISCARD_MAX_VAR,
  DECK_DISCARD_MIN_VAR,
  deckDiscardChoiceRange,
  deckDiscardSupply,
  isDeckDiscardChoice,
} from "./deck-discard-choice-cost.js";
import { encounterLookDiscardEffects, encounterLookPayable } from "./encounter-look-cost.js";
import { enemyAttackCostEffects, enemyAttackCostEnemy, enemyAttackCostFault } from "./enemy-attack-cost.js";
import {
  planResolveAbilityCost,
  resolveAbilityCostCard,
  resolveAbilityCostEffects,
  resolvingWouldChange,
} from "./resolve-ability-cost.js";
import { canPayReadyCost, readyCardsCostEffects, withReadyCosts } from "./ready-cards-cost.js";
import {
  attachCardSlot,
  dealDamageCostTargets,
  payAttachCost,
  payDealDamageCost,
  planAttachCost,
  planDealDamageChoice,
} from "./attach-cost.js";
import {
  REMOVE_THREAT_FROM_SLOT,
  REMOVE_THREAT_MAX_VAR,
  REMOVE_THREAT_MIN_VAR,
  REMOVE_THREAT_VAR,
  removeThreatCostEffects,
  removeThreatCostPlan,
} from "./remove-threat-cost.js";
import { dealBoostCard } from "./resolve/enemy-activation.js";
import {
  activeEncounterDeckId,
  cardOf,
  cardZoneCandidates,
  encounterDeckOf,
  characterProfile,
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
  printedCostOf,
  sameGameArea,
  mustInstance,
  mustPlayer,
  showingResources,
  turnInProgress,
  villainOf,
  inClosedScenarioPlayArea,
  scenarioPlayAreaOf,
} from "./query.js";
import {
  announceStatusDiscarded,
  attachmentHostCandidates,
  upgradeHostCandidates,
  checkRestrictedAfterFlip,
  heard,
  pushActionAbility,
  pushEffects,
  pushEvent,
  pushEvents,
  pushEventsSharingResponses,
  pushPlayCardFrame,
  recordAbilityUse,
} from "./resolve/index.js";
import { limitReached } from "./resolve/ability.js";
import { thwartBlockedOn } from "./resolve/event.js";
import { abilityLacksValidTarget, abilityTargetFault, TARGET_FAULT_MESSAGE } from "./resolve/target-validity.js";
import { moveCardsTo } from "./resolve/cards.js";
import { addFrameSlots, eventFrame } from "./resolve/frames.js";
import {
  addPools,
  combineRequirements,
  countUsableAs,
  EMPTY_POOL,
  payableWithOneType,
  canBePaidFor,
  declaredPool,
  paidSetsAsDeclared,
  paidTypesReading,
  poolOf,
  poolTotal,
  printedResources,
  describeRequirement,
  distinctTypeCount,
  requirementOf,
  requirementTotal,
  satisfies,
  scalePool,
  TYPED_RESOURCES,
  wildDeclarationFault,
  wildDeclarations,
  type PaidTypesRead,
  type ResolvedRequirement,
  type ResourcePool,
  type ResourceType,
  type TypedResource,
} from "./resources.js";
import {
  activeAbilityRefs,
  activeRules,
  basicThwartTargetAllowed,
  canAttack,
  cardsInPlay,
  cardTypeOf,
  categoriesOf,
  characterIgnores,
  controllerOf,
  evaluate,
  isAlly,
  isCaptiveAlly,
  matchesQuery,
  printedAbilityRefs,
  printedResourcesOf,
  resolvePlayers,
  resolveRef,
  resolveValue,
  speakerOf,
  traitsOf,
  triggeringPlayers,
  type EffectContext,
  isProtectedMainScheme,
  withSelfHost,
} from "./select.js";
import {
  describeFrame,
  paidAsVars,
  type Bindings,
  type ReportTarget,
  type UndeclaredWilds,
  type Vars,
} from "./stack.js";
import type { GameState } from "./state.js";
import { anyThwartCost, askBasicThwartCost, thwartCostsPayable, thwartCostTotal } from "./thwart-cost.js";
import {
  formChangeCostMessage,
  payFormChangeCosts,
  planFormChangeCosts,
  settleFormChangeCosts,
} from "./form-change-cost.js";
import { characterTitledAs } from "./titles.js";
import { entersPlayWhenPlayed, matchingCardInPlay, uniqueBlockedMessageIn } from "./unique.js";

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

/**
 * The timing gate of an Action ability, on a card in play or as an Action event played from hand: the player's own
 * turn, or another player's. RRG 1.8 "Action" (p. 6): "Players are permitted to trigger action abilities during their
 * turn, or by request during other players' turns." "Player Turn" (pp. 34–35) lists it among what the active player
 * may do: "Ask another player to trigger any 'Action' ability that player could trigger on their own turn. The other
 * player then decides whether or not to trigger the ability. (Another player may offer to use an action during the
 * active player's turn, as well.)" The command is that offer, so nobody is asked (owner ruling 2026-10-05,
 * docs/phase7-wave7.md §4.1): during any player's turn, whenever an Action could be taken at all, which is with
 * nothing on the stack and no choice pending (`applyCommand` refuses every command but an answer while one is).
 *
 * It is not a turn for that player. Everything else `requireActivePlayer` gates stays the active player's: basic
 * powers, changing form, playing an ally, support, upgrade or player side scheme, ending the turn. Every later check
 * of the command reads the acting player, exactly as on their own turn.
 */
function requireActionTiming(state: GameState, playerId: PlayerId, command: Command): EngineError | null {
  const step = state.step;
  if (step.phase !== "player" || step.kind !== "turn") {
    return engineError("wrong_phase", `cannot act during ${step.phase}/${step.kind}`, command);
  }
  if (step.activePlayerId === playerId) return null;
  const player = getPlayer(state, playerId);
  if (!player) return engineError("unknown_player", `${playerId} is not at this table`, command);
  if (player.eliminated) return engineError("not_active_player", `${playerId} is out of the game`, command);
  if (state.stack.length > 0) {
    return engineError("wrong_phase", "an Action cannot be taken while something is resolving", command);
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
  // An additional cost to change form (`RuleSpec formChangeCost`, docs/phase7-wave8.md §3.63) is paid with the change or
  // the change is refused, nothing paid and the round's change unused (RRG 1.8 "Cost", p. 14).
  const costs = formChangeCostsFor(ctx.state, ctx.deps, command.playerId, to);
  const payment = command.payment ?? [];
  if (costs.length === 0) {
    if (payment.length > 0) return engineError("invalid_choice", "this change of form costs nothing", command);
    const changed = changeIdentityForm(ctx, command.playerId, to, true, heroForm);
    if (changed) pushEvent(ctx, changed);
    return null;
  }
  const planned = planFormChangeCosts(ctx, command.playerId, costs, payment, command.costChoices ?? {});
  if (isFault(planned)) {
    return engineError(planned.code, formChangeCostMessage(ctx.state, costs, to, planned.message), command);
  }
  const spent = payFormChangeCosts(ctx, command.playerId, planned, to, payment);
  const changed = changeIdentityForm(ctx, command.playerId, to, true, heroForm);
  if (changed) pushEvent(ctx, changed);
  // Above the change on the stack, so the rest of the cost and "after you spend this card" resolve before "when you
  // change form" (`formChanging`, when an interrupt listens) and "after you change form" (RRG 1.8 "Initiating
  // Abilities", p. 24, steps 5–6).
  settleFormChangeCosts(ctx, command.playerId, planned, spent);
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

/**
 * Every attached card `playerId` may play "as if it were in your hand" (`playableFromAttachment`), wherever the host
 * sits. The attachments of *every* card in play, not just `cardsInPlay` itself: that list goes one level deep (an
 * identity and what is attached to it), and Hawkeye's Quiver is itself attached to Hawkeye, so an Arrow on it sat a
 * level below and was never considered at all (2026-09-21 report). Read by both the action list (`legalActions`) and
 * the timing windows (`inHandCandidates`), so an attached Interrupt/Response event is offered where one in hand is.
 */
export const attachmentsPlayableBy = (state: GameState, deps: EngineDeps, playerId: PlayerId): readonly InstanceId[] =>
  [...new Set(cardsInPlay(state).flatMap((id) => [id, ...(getInstance(state, id)?.attachments ?? [])]))].filter((id) =>
    playableFromAttachment(state, deps, playerId, id),
  );

/** Where a card may be played from besides hand: its own discard permission, or an attachment permission on its host. */
export const playableOutsideHand = (state: GameState, deps: EngineDeps, playerId: PlayerId, id: InstanceId): boolean =>
  playableFromDiscard(state, deps, playerId, id) || playableFromAttachment(state, deps, playerId, id);

/**
 * A `playableTopOfDeck` permission in force for a player (docs/phase7-wave8.md §3.49): the card and ability it is
 * printed on, what it takes off the cost, and the top card of the player's deck it covers.
 */
export interface DeckTopPermission {
  /** The top card of the player's deck: the one card the permission covers right now. */
  readonly instanceId: InstanceId;
  readonly sourceInstanceId: InstanceId;
  readonly abilityId: AbilityId;
  /** "…, reducing its resource cost by N", as a positive number; 0 when the permission prints none. */
  readonly costReduction: number;
  /** The ability's limit has been reached for its period ("once per phase"), so the card cannot be played this way. */
  readonly limitUsed: boolean;
}

const REGISTRIES_WITH_DECK_TOP_PLAY = new WeakMap<AbilityRegistry, boolean>();

/** Whether any ability of this registry carries the permission, read once per registry. */
function registryHasDeckTopPlay(deps: EngineDeps): boolean {
  let found = REGISTRIES_WITH_DECK_TOP_PLAY.get(deps.abilities);
  if (found === undefined) {
    found = Object.values(deps.abilities).some(
      (definition) => definition.trigger.kind === "constant" && definition.trigger.playableTopOfDeck !== undefined,
    );
    REGISTRIES_WITH_DECK_TOP_PLAY.set(deps.abilities, found);
  }
  return found;
}

/**
 * The `playableTopOfDeck` permission over `playerId`'s deck right now, or null: none is in force (no such constant on
 * an active face in play, a blank text box), or the deck is empty. Derived each time it is asked, like the faceup rule
 * (`shownDeckTop`); only the limit's count is state (`abilityUses`). With several in force, the first whose limit is
 * not used. `limitUsed` says the permission stands but cannot be used again this period: the card is then not playable,
 * and `legalActions` and `choiceExclusions` say why.
 *
 * Not tied to `RuleSpec topOfDeckFaceup`: see `AbilityTriggerSpec.playableTopOfDeck`.
 */
export function deckTopPermission(state: GameState, deps: EngineDeps, playerId: PlayerId): DeckTopPermission | null {
  if (!registryHasDeckTopPlay(deps)) return null;
  const top = getPlayer(state, playerId)?.deck[0];
  if (top === undefined) return null;
  let used: DeckTopPermission | null = null;
  for (const sourceId of cardsInPlay(state)) {
    for (const ref of activeAbilityRefs(state, sourceId, deps)) {
      const definition = deps.abilities[ref.id];
      const trigger = definition?.trigger;
      if (!definition || trigger?.kind !== "constant" || !trigger.playableTopOfDeck) continue;
      const context: EffectContext = {
        selfInstanceId: sourceId,
        controllerId: speakerOf(state, sourceId),
        event: null,
        bindings: {},
        deps,
      };
      if (!resolvePlayers(state, trigger.playableTopOfDeck.player, context).includes(playerId)) continue;
      const permission: DeckTopPermission = {
        instanceId: top,
        sourceInstanceId: sourceId,
        abilityId: ref.id,
        costReduction: Math.max(0, trigger.playableTopOfDeck.costReduction ?? 0),
        limitUsed: limitReached(state, sourceId, ref.id, definition, null, playerId),
      };
      if (!permission.limitUsed) return permission;
      used ??= permission;
    }
  }
  return used;
}

/**
 * The permission under which `playerId` may play `id` "as if it was in your hand" from the top of their deck now
 * (`deckTopPermission`, in force with its limit unused, and `id` that top card), or null. Every route that plays a card
 * from the hand asks this of a card that is not in the hand: the play command, a timing window's in-hand candidates and
 * `EffectSpec playFromHand` from the hand. A play from the deck by an effect that searches it (`from: "deck"`) does
 * not ask, so a searched card that happens to be on top is neither reduced nor counted against the limit.
 */
export function deckTopPlayOf(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  id: InstanceId,
): DeckTopPermission | null {
  const permission = deckTopPermission(state, deps, playerId);
  return permission && !permission.limitUsed && permission.instanceId === id ? permission : null;
}

/** The top card of `playerId`'s deck when they may play it as if from hand now (`deckTopPlayOf`), as a list. */
export function deckTopPlayableBy(state: GameState, deps: EngineDeps, playerId: PlayerId): readonly InstanceId[] {
  const permission = deckTopPermission(state, deps, playerId);
  return permission && !permission.limitUsed ? [permission.instanceId] : [];
}

/** What the permission takes off the cost of playing `id` from the top of the deck; 0 for any other card. */
export const deckTopCostReduction = (state: GameState, deps: EngineDeps, playerId: PlayerId, id: InstanceId): number =>
  deckTopPlayOf(state, deps, playerId, id)?.costReduction ?? 0;

/**
 * Whether a card counts as "in your hand" for being played: in the hand, or the top card of the deck under
 * `playableTopOfDeck`. Only for playing (RRG 1.8 FAQ "Magik (#30A)", p. 64, fourth entry).
 */
export const inHandForPlaying = (state: GameState, deps: EngineDeps, playerId: PlayerId, id: InstanceId): boolean =>
  (getPlayer(state, playerId)?.hand.includes(id) ?? false) || deckTopPlayOf(state, deps, playerId, id) !== null;

/**
 * An ability that works from the hand (`activeIn: "hand"`) and plays its own card from there ("Interrupt: When an
 * enemy attacks you, play Colossus from your hand …"): using it is an opportunity to play that card from the hand, so
 * it is heard from the top of the deck under `playableTopOfDeck` too (docs/phase7-wave8.md §3.49). Any other in-hand
 * ability is not a play of its card and stays off there.
 */
export const playsOwnCardFromHand = (definition: AbilityDefinition): boolean =>
  definition.activeIn === "hand" && ownCardPlayOf(definition) !== undefined;

/** The top-level effect that plays the ability's own card from the hand: named (`card: self`) or filtered to it. */
const ownCardPlayOf = (definition: AbilityDefinition) =>
  definition.effects.find(
    (effect): effect is Extract<EffectSpec, { kind: "playFromHand" }> =>
      effect.kind === "playFromHand" &&
      (effect.from ?? "hand") === "hand" &&
      (effect.card?.kind === "self" || effect.filter?.self === true),
  );

/**
 * Why an in-hand ability that plays its own card (`playsOwnCardFromHand`) could not play it right now, or null: the
 * card's play restrictions and, when its cost is paid, whether everything the player could spend covers it, exactly as
 * the effect itself judges the card when it resolves (`playWithPaymentFault` / `playIgnoringCostFault`). RRG 1.8
 * "Initiating Abilities" (p. 24, step 2): an ability whose cost cannot be paid is not initiated, and the card's
 * resource cost is the cost of this play ("play Colossus from your hand (paying his resource cost)"), so a timing
 * window does not offer the ability while this is non-null. An optional play ("you may play …") is never a fault.
 */
export function ownCardPlayFault(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  id: InstanceId,
  definition: AbilityDefinition,
  event: TriggerEvent | null,
): string | null {
  const effect = ownCardPlayOf(definition);
  if (!effect || effect.optional === true) return null;
  const ctx = createCtx(state, deps);
  const timing: ActionTiming = effect.ignoreActionTiming === true ? "any" : "turn";
  if (effect.ignoreCost === true) return playIgnoringCostFault(ctx, playerId, id, "hand", undefined, timing);
  const context: EffectContext = { selfInstanceId: id, controllerId: playerId, event, bindings: {}, deps };
  const reduction =
    effect.costReduction === undefined ? 0 : Math.max(0, resolveValue(state, effect.costReduction, context, deps));
  return playWithPaymentFault(ctx, playerId, id, reduction, "hand", undefined, timing);
}

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
    ...player.playArea.filter((id) => isAlly(state, id) && controllerOf(state, id) !== null),
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
    // A card nobody controls still speaks for a player (`speakerOf`): an attachment on a player card for that card's
    // controller (RRG 1.8 "Attachment", p. 8: "it refers to the attached player card's controller"), a card in a
    // player's area (an obligation, RRG 1.8 "Obligation", p. 30) for that player.
    const controllerId = speakerOf(state, sourceId);
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
  const printed = "specialCost" in card && card.specialCost === "X" ? Math.max(0, x) : printedCostOf(state, card);
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

/**
 * Why a card of this type cannot be played into an in-play scenario area (`playCard.into`), or null when it can: a
 * play has a place to put a card only when the card stays in play. RRG 1.8 "Player Turn" (p. 34) lists what a player
 * plays from hand to have in play, "an ally, upgrade, support, or player side scheme card"; "Event" (p. 18) has the
 * player place an event "faceup on the table in front of them (the event is not in play)" and then in its owner's
 * discard pile, so it is never in any area. A resource card is refused before this, as for any play.
 */
function playedIntoAreaFault(card: AnyCard): string | null {
  switch (card.type) {
    case "ally":
    case "support":
    case "upgrade":
    case "player_side_scheme":
      return null;
    case "event":
      return "an event is not in play while it resolves, so it is not played into an area";
    default:
      return `a ${card.type} card is not played into an area`;
  }
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

/**
 * A hand card's resources, including "double … while paying for an [aspect] card" (The Power of X, read from this
 * card) and "double … generated while paying for this card" (read from the card paid for, `paidForMultiplied`).
 */
export function handCardResources(
  state: GameState,
  deps: EngineDeps,
  cardInstanceId: InstanceId,
  playerId: PlayerId,
  payingFor: InstanceId | null,
): ResourcePool {
  const card = cardOf(state, cardInstanceId);
  if (!card) return EMPTY_POOL;
  // "This card generates [wild] for each ally you control" (`handGenerates`, docs/phase7-wave4.md §3.38).
  const instead = printedAbilityRefs(card)
    .map((ref) => deps.abilities[ref.id]?.trigger)
    .find((trigger) => trigger?.kind === "constant" && trigger.handGenerates !== undefined);
  const generated =
    instead?.kind === "constant" && instead.handGenerates !== undefined
      ? generatedResources(state, instead.handGenerates, null, { deps, sourceId: cardInstanceId, playerId })
      : printedResourcesOf(state, cardInstanceId, deps);
  const context: EffectContext = {
    selfInstanceId: cardInstanceId,
    controllerId: playerId,
    event: null,
    bindings: {},
    deps,
  };
  // "This card generates 1 additional [wild] resource for each …", "Double the number of resources this card generates
  // if …" (`resourceMultiplier.thisCardGenerates`, docs/phase7-wave7.md §3.80): whatever the card pays for, and before
  // the multipliers below, which then count what it added.
  const pool = printedConstants(state, deps, cardInstanceId).reduce((sum, trigger) => {
    const multiplier = trigger.resourceMultiplier;
    return multiplier && "thisCardGenerates" in multiplier ? multiplyPool(state, sum, multiplier, context) : sum;
  }, generated);
  if (!payingFor) return pool;
  const own = printedConstants(state, deps, cardInstanceId).find((trigger) => {
    const multiplier = trigger.resourceMultiplier;
    return (
      multiplier && "whilePayingFor" in multiplier && matchesQuery(state, payingFor, multiplier.whilePayingFor, context)
    );
  })?.resourceMultiplier;
  return paidForMultiplied(state, deps, payingFor, own ? multiplyPool(state, pool, own, context) : pool, playerId);
}

/**
 * A pool with a `ResourceMultiplierSpec` applied: its `additional` resources first, then its `factor` on every type, or
 * only on its `resource`. Both are read now, with `context` naming the card carrying the text and the player spending.
 */
function multiplyPool(
  state: GameState,
  pool: ResourcePool,
  multiplier: ResourceMultiplierSpec,
  context: EffectContext,
): ResourcePool {
  const read = (value: number | ValueSpec): number =>
    Math.max(0, Math.floor(typeof value === "number" ? value : resolveValue(state, value, context, context.deps)));
  const additional = "thisCardGenerates" in multiplier ? multiplier.additional : undefined;
  const base = additional
    ? { ...pool, [additional.resource]: pool[additional.resource] + read(additional.amount) }
    : pool;
  if (multiplier.factor === undefined) return base;
  const factor = read(multiplier.factor);
  const { resource } = multiplier;
  return resource ? { ...base, [resource]: base[resource] * factor } : scalePool(base, factor);
}

/**
 * What one source's resources count as toward the card being paid for, once that card's own "Double the number of
 * [wild] resources generated while paying for this card" (`resourceMultiplier.forThisCard`, Lightspeed Flight `nova`
 * 28004) applies. Every source of one payment goes through it (a hand card, a resource ability), each on its own pool,
 * so each source's generated resources (the `resourcesGenerated` log, the payment strip's per-source pools) already
 * count the doubling. Read from the card's printed text wherever it is, like `paymentOnly`: an event is in hand while it
 * is paid for.
 */
export function paidForMultiplied(
  state: GameState,
  deps: EngineDeps,
  payingFor: InstanceId | null,
  pool: ResourcePool,
  /** The player generating the resources: "you" for a factor that is a value. */
  playerId: PlayerId,
): ResourcePool {
  if (!payingFor) return pool;
  const context: EffectContext = {
    selfInstanceId: payingFor,
    controllerId: playerId,
    event: null,
    bindings: {},
    deps,
  };
  return printedConstants(state, deps, payingFor).reduce((scaled, trigger) => {
    const multiplier = trigger.resourceMultiplier;
    return multiplier && "forThisCard" in multiplier ? multiplyPool(state, scaled, multiplier, context) : scaled;
  }, pool);
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
  /**
   * The card generating and the player using it, for a generation that reads the table (§3.38 of wave 4), and the
   * cards its own cost picked (`bindings`, by slot): "Exhaust an [Interface] upgrade you control → generate that
   * upgrade's resources" reads the upgrade from the cost's slot (`resourceAbilityGenerates`).
   */
  from?: {
    readonly deps: EngineDeps;
    readonly sourceId: InstanceId;
    readonly playerId: PlayerId;
    readonly bindings?: Bindings;
    /**
     * What the ability's own cost will have paid, as the text after the arrow reads it: `cost.removeThreat` for "a
     * resource for each threat you removed this way" (`resourceCostVars`; docs/phase7-wave9.md §3.7 (b)).
     */
    readonly vars?: Vars;
  },
): ResourcePool {
  if (generation === undefined) return poolOf({ wild: 1 });
  if (typeof generation === "number") return poolOf({ wild: generation });
  if ("kind" in generation) {
    if (generation.kind === "topCardOfDiscard") {
      // Pepper Potts: "equal in quantity and type to the resources on the top card of the discard pile" (FFG ruling).
      return discardTop ? showingResources(state, discardTop) : EMPTY_POOL;
    }
    if (!from) return EMPTY_POOL;
    const context: EffectContext = {
      selfInstanceId: from.sourceId,
      controllerId: from.playerId,
      event: null,
      bindings: from.bindings ?? {},
      ...(from.vars ? { vars: from.vars } : {}),
      deps: from.deps,
    };
    if (generation.kind === "amount") {
      const n = Math.min(resolveValue(state, generation.amount, context, from.deps), generation.max ?? Infinity);
      return poolOf({ [generation.resource]: Math.max(0, n) });
    }
    const matching = cardsInPlay(state).filter((id) =>
      matchesQuery(state, id, generation.kind === "perCard" ? generation.per : generation.cards, context),
    );
    if (generation.kind === "perCard") {
      const n = Math.min(matching.length, generation.max ?? Infinity);
      return poolOf({ [generation.resource]: n });
    }
    return matching.reduce((pool, id) => addPools(pool, showingResources(state, id)), EMPTY_POOL);
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
  /** The picks this use names for the ability's own cost (`ResourceAbilityUse.costChoices`). */
  choices: CostChoices = {},
): PriceFault | null {
  const definition = deps.abilities[abilityId];
  if (!definition || definition.trigger.kind !== "resource") {
    return { code: "no_valid_target", message: `${abilityId} is not a resource ability` };
  }
  // "When you spend this card" (`whenSpent`): used by the entry that spends its card (`Payment.whenSpent`) only.
  if (definition.trigger.whenSpent) {
    return { code: "no_valid_target", message: `${abilityId} is used by spending its card from hand` };
  }
  if (!activeAbilityRefs(state, instanceId, deps).some((ref) => ref.id === abilityId)) {
    return { code: "no_valid_target", message: `${abilityId} is not active on ${instanceId}` };
  }
  // The player who resolves a resource ability is its card's controller, also when it generates "for any player" and
  // another player spends it (RRG 1.8 "Ownership and Control", p. 31); the payer on a card no player controls.
  if (
    triggeredAbilityForbidden(state, deps, instanceId, definition.trigger, controllerOf(state, instanceId) ?? playerId)
  ) {
    return { code: "no_valid_target", message: `${abilityId} cannot be resolved right now` };
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
  const context: EffectContext = { selfInstanceId: instanceId, controllerId: spender, event: null, bindings: {}, deps };
  // "While Brawn is exhausted, he gains: 'Resource: …'" (`trigger.while`): no ability to trigger while it is false.
  if (definition.trigger.while && !evaluate(state, definition.trigger.while, context)) {
    return { code: "no_valid_target", message: `${abilityId}'s condition is not met` };
  }
  if (limitReached(state, instanceId, asAbilityId(abilityId), definition, null, spender)) {
    return { code: "limit_reached", message: `${abilityId} has reached its limit` };
  }
  // "Generate a [wild] resource for an event": only while paying for a matching card.
  if (definition.generatesFor) {
    if (payingFor === null || !matchesQuery(state, payingFor, definition.generatesFor, context)) {
      return { code: "no_valid_target", message: `${abilityId} only generates resources for a certain kind of card` };
    }
  }
  const plan = planCost(state, deps, instanceId, spender, definition.cost, choices, new Set());
  return isFault(plan) ? plan : null;
}

/** A hand entry's `whenSpent` use as a use of that ability on the spent card, or null for a plain spending. */
const spentCardUse = (entry: Extract<Payment, { fromHand: InstanceId }>): ResourceAbilityUse | null =>
  entry.whenSpent
    ? {
        instanceId: entry.fromHand,
        abilityId: entry.whenSpent.abilityId,
        ...(entry.whenSpent.costChoices ? { costChoices: entry.whenSpent.costChoices } : {}),
      }
    : null;

/** The `whenSpent` abilities printed on a card ("Interrupt: When you spend this card, … → generate …"). */
function whenSpentAbilitiesOf(state: GameState, deps: EngineDeps, id: InstanceId): readonly AbilityId[] {
  const card = cardOf(state, id);
  if (!card) return [];
  return printedAbilityRefs(card).flatMap((ref) => {
    const trigger = deps.abilities[ref.id]?.trigger;
    return trigger?.kind === "resource" && trigger.whenSpent ? [ref.id] : [];
  });
}

/**
 * Why a card's "Interrupt: When you spend this card, [cost] → generate …" (a resource trigger with `whenSpent`) cannot
 * be used as `spender` spends the card from their hand, or null when it can. The spending itself (the card is in that
 * hand and may be spent on this cost) is `priceOf`'s to check; this is the ability's own: it is printed on the card,
 * no rule stops the spender resolving it, their form, its condition, its limit, the kind of card it generates for,
 * and its cost with the picks named. RRG 1.8 "Initiating Abilities" (p. 24), steps 2 and 3.
 */
function whenSpentFault(
  state: GameState,
  deps: EngineDeps,
  use: ResourceAbilityUse,
  spender: PlayerId,
  payingFor: InstanceId | null,
): PriceFault | null {
  const { instanceId, abilityId } = use;
  const definition = deps.abilities[abilityId];
  if (!definition || !whenSpentAbilitiesOf(state, deps, instanceId).includes(abilityId)) {
    return { code: "no_valid_target", message: `${abilityId} is not a when-spent ability of ${instanceId}` };
  }
  const trigger = definition.trigger;
  if (trigger.kind !== "resource") return { code: "no_valid_target", message: `${abilityId} generates nothing` };
  if (triggeredAbilityForbidden(state, deps, instanceId, trigger, spender)) {
    return { code: "no_valid_target", message: `${abilityId} cannot be resolved right now` };
  }
  if (trigger.form && getPlayer(state, spender)?.identity.form !== trigger.form) {
    return { code: "wrong_form", message: `${abilityId} requires ${trigger.form} form` };
  }
  const context: EffectContext = { selfInstanceId: instanceId, controllerId: spender, event: null, bindings: {}, deps };
  if (trigger.while && !evaluate(state, trigger.while, context)) {
    return { code: "no_valid_target", message: `${abilityId}'s condition is not met` };
  }
  if (limitReached(state, instanceId, asAbilityId(abilityId), definition, null, spender)) {
    return { code: "limit_reached", message: `${abilityId} has reached its limit` };
  }
  if (definition.generatesFor) {
    if (payingFor === null || !matchesQuery(state, payingFor, definition.generatesFor, context)) {
      return { code: "no_valid_target", message: `${abilityId} only generates resources for a certain kind of card` };
    }
  }
  const plan = planCost(state, deps, instanceId, spender, definition.cost, use.costChoices ?? {}, new Set());
  return isFault(plan) ? plan : null;
}

/**
 * A resource ability's own cost, planned with the picks this use names. RRG 1.8 "Initiating Abilities" (p. 24): the
 * cost is determined (step 3) and paid (step 5) before the ability's effect, generating resources, happens (step 6),
 * so what the ability generates may depend on what its cost picked ("Exhaust an [Interface] upgrade you control →
 * generate that upgrade's resources", SP//dr Suit's Sync Ratio; RRG 1.8 "Resource Ability", p. 37).
 */
function resourceCostPlan(
  state: GameState,
  deps: EngineDeps,
  use: ResourceAbilityUse,
  spender: PlayerId,
): CostPlan | PriceFault {
  const cost = deps.abilities[use.abilityId]?.cost;
  const plan = planCost(
    state,
    deps,
    use.instanceId,
    spender,
    cost,
    use.costChoices ?? {},
    new Set(),
    use.costSelection ?? {},
  );
  if (isFault(plan)) return plan;
  // "Remove up to 2 threat from … →" with no amount named: the most it can (`ResourceAbilityUse.costSelection`). A
  // use in a payment is priced before it is paid and is not asked in between, so its range is one number here.
  const most = plan.vars[REMOVE_THREAT_MAX_VAR];
  if (most === undefined || plan.vars[REMOVE_THREAT_MIN_VAR] === most) return plan;
  return { ...plan, vars: { ...plan.vars, [REMOVE_THREAT_MIN_VAR]: most } };
}

/**
 * What a resource ability's planned cost will have paid, for a generation that reads it: `cost.removeThreat`, the
 * threat a `removeThreat` cost removes ("generate a [mental] resource for each threat you removed this way";
 * docs/phase7-wave9.md §3.7 (b)). The amount is the plan's (`resourceCostPlan` leaves a range of one number), which is
 * what paying it removes, so pricing a payment and paying it agree. RRG 1.8 "Initiating Abilities" (p. 24): the cost is
 * paid (step 5) before the resources are generated (step 6).
 */
function resourceCostVars(plan: CostPlan): Vars {
  const removed = plan.vars[REMOVE_THREAT_MAX_VAR];
  return removed === undefined ? {} : { [REMOVE_THREAT_VAR]: removed };
}

/**
 * What one use of a resource ability generates, read with its own cost's picks bound by slot. The picks are read as
 * the cost has them before it is paid, which is what paying leaves them as (an exhausted upgrade still prints the same
 * resources), so pricing a payment and paying it agree.
 */
export function resourceAbilityGenerates(
  state: GameState,
  deps: EngineDeps,
  use: ResourceAbilityUse,
  spender: PlayerId,
  discardTop: InstanceId | null,
): ResourcePool {
  const plan = resourceCostPlan(state, deps, use, spender);
  return generatedResources(state, deps.abilities[use.abilityId]?.generates, discardTop, {
    deps,
    sourceId: use.instanceId,
    playerId: spender,
    bindings: isFault(plan) ? {} : plan.bindings,
    vars: isFault(plan) ? {} : resourceCostVars(plan),
  });
}

/** The cards in play one use of a resource ability spends on its own cost: itself when it exhausts, and its picks. */
function cardsSpentByResourceCost(deps: EngineDeps, use: ResourceAbilityUse, plan: CostPlan): readonly InstanceId[] {
  const cost = plan.cost ?? deps.abilities[use.abilityId]?.cost;
  return [
    ...(cost?.exhaustSelf ? [use.instanceId] : []),
    ...inPlayPicksOf(cost).flatMap(({ pick }) => plan.bindings[pick.slot] ?? []),
  ];
}

/**
 * Whether a resource ability whose cost is only cards picked in play may be used again in the same payment: RRG 1.8
 * "Resource Ability" (p. 37) lets it trigger "anytime the player … is generating resources to pay a cost", so with no
 * limit it may trigger once per set of cards that can pay its cost (Sync Ratio with two ready Interface upgrades). One
 * card still pays one cost (`priceOf`'s check, RRG 1.8 "Cost", p. 13).
 */
function repeatsWithNewPicks(deps: EngineDeps, abilityId: string): boolean {
  const definition = deps.abilities[abilityId];
  const cost = definition?.cost;
  if (definition?.trigger.kind !== "resource" || definition.limit || !cost) return false;
  const pickKeys = new Set(["exhaustCards", "returnToHand", "discardCards", "discardTucked"]);
  return inPlayPicksOf(cost).length > 0 && Object.entries(cost).every(([key, v]) => pickKeys.has(key) || !v);
}

/** Most payment options one resource ability offers for the different cards its cost could pick (a cap, not a rule). */
const MAX_PICK_OPTIONS = 20;

/** Every way to choose `size` of `ids`, in order. */
function combinations<T>(ids: readonly T[], size: number): readonly (readonly T[])[] {
  if (size === 0) return [[]];
  return ids.flatMap((id, i) => combinations(ids.slice(i + 1), size - 1).map((rest) => [id, ...rest]));
}

/**
 * The picks a resource ability's cost could be paid with, one `CostChoices` per legal choice, when its cost leaves a
 * choice of cards in play; `[undefined]` when it leaves none (no pick, or a forced one: `InPlayCostPick`). Each choice
 * is its own payment option, so the payment view shows what that choice generates.
 */
function resourcePickChoices(
  state: GameState,
  deps: EngineDeps,
  instanceId: InstanceId,
  abilityId: string,
  spender: PlayerId,
): readonly (CostChoices | undefined)[] {
  const picks = inPlayPicksOf(deps.abilities[abilityId]?.cost);
  let sets: CostChoices[] = [{}];
  let choosing = false;
  for (const { mode, pick } of picks) {
    const candidates = eligibleForInPlayPick(state, deps, instanceId, spender, pick).filter((id) =>
      canPayInPlayPick(state, deps, instanceId, id, mode, pick),
    );
    // A forced pick (exactly `min` candidates) pays itself; fewer can't pay, which the fault check reports. An `each`
    // pick takes every matching card, so it is never a choice.
    if (pick.each || candidates.length <= pick.min) continue;
    choosing = true;
    const most = Math.min(pick.max ?? candidates.length, candidates.length);
    const options: (readonly InstanceId[])[] = [];
    for (let size = pick.min; size <= most && options.length < MAX_PICK_OPTIONS; size++) {
      // "This card and up to N others" (`InPlayCostPick.includesSelf`): only the picks holding the card pay.
      options.push(...combinations(candidates, size).filter((ids) => !pick.includesSelf || ids.includes(instanceId)));
    }
    sets = sets.flatMap((set) => options.map((ids) => ({ ...set, [pick.slot]: ids }))).slice(0, MAX_PICK_OPTIONS);
  }
  return choosing ? sets : [undefined];
}

/**
 * The option id of one use of a resource ability: "ability:<id>:<abilityId>", then ":<n>" for the n-th use of a
 * `repeatable` one (docs/phase7-wave5.md §3.25), then "@" and, separated by ";", "<slot>=<id>,<id>" for the cards its
 * cost picks and "#removeThreat=<n>" for the threat a chosen-amount threat cost removes (`CostSelection.removeThreat`;
 * docs/phase7-wave9.md §3.7 (b)). Parsed back by `paymentsFromOptionIds`.
 */
export function resourceAbilityOptionId(use: ResourceAbilityUse, n = 1): string {
  const base = `ability:${use.instanceId}:${use.abilityId}${n > 1 ? `:${n}` : ""}`;
  const parts = Object.entries(use.costChoices ?? {}).map(([slot, ids]) => `${slot}=${ids.join(",")}`);
  const threat = use.costSelection?.removeThreat;
  if (threat !== undefined) parts.push(`${REMOVE_THREAT_OPTION}${threat}`);
  return parts.length === 0 ? base : `${base}@${parts.join(";")}`;
}

/**
 * The option id of a hand card's spending: "hand:<id>", and for a spending that uses the card's own "When you spend
 * this card" ability (`Payment.whenSpent`) "hand:<id>:<abilityId>" with the same "@<slot>=<id>,<id>" suffix for the
 * cards its cost picks as `resourceAbilityOptionId`. Parsed back by `paymentsFromOptionIds`.
 */
export function spentCardOptionId(entry: Extract<Payment, { fromHand: InstanceId }>): string {
  if (!entry.whenSpent) return `hand:${entry.fromHand}`;
  const base = `hand:${entry.fromHand}:${entry.whenSpent.abilityId}`;
  const parts = Object.entries(entry.whenSpent.costChoices ?? {}).map(([slot, ids]) => `${slot}=${ids.join(",")}`);
  return parts.length === 0 ? base : `${base}@${parts.join(";")}`;
}

/** The hand card a payment option spends ("hand:<id>…", plain or with its own ability), or null for any other. */
export function handCardOfOptionId(optionId: string): InstanceId | null {
  const [entry] = paymentsFromOptionIds([optionId]);
  return entry && "fromHand" in entry ? entry.fromHand : null;
}

/** The option-id part naming the threat a resource ability's cost removes (`resourceAbilityOptionId`). */
const REMOVE_THREAT_OPTION = "#removeThreat=";

/**
 * The amounts a resource ability's chosen-amount threat cost could remove right now, fewest first ("remove up to 2
 * threat from … →": 1 and 2 with 2 or more threat there); empty when the cost has no such choice, cannot be paid, or
 * has only one amount to offer. Each amount below the most is its own payment option (`paymentOptions`).
 */
function resourceThreatAmounts(
  state: GameState,
  deps: EngineDeps,
  instanceId: InstanceId,
  abilityId: string,
  spender: PlayerId,
  choices: CostChoices = {},
): readonly number[] {
  const cost = deps.abilities[abilityId]?.cost;
  if (!cost?.removeThreat || typeof cost.removeThreat.amount === "number") return [];
  const plan = planCost(state, deps, instanceId, spender, cost, choices, new Set());
  if (isFault(plan)) return [];
  const min = plan.vars[REMOVE_THREAT_MIN_VAR] ?? 0;
  const max = plan.vars[REMOVE_THREAT_MAX_VAR] ?? 0;
  return max > min ? Array.from({ length: max - min + 1 }, (_, i) => min + i) : [];
}

/**
 * A payment source that is another amount of a use already listed: a resource ability's use naming how much threat
 * its cost removes (`paymentOptions` lists the most as the plain option). A list of everything a player could spend at
 * once (`legal.ts spendOrder`, the upper bound of `costPayable`) leaves these out, since one use pays one amount.
 */
export const isAlternativeAmount = (payment: Payment): boolean =>
  "ability" in payment && payment.ability.costSelection?.removeThreat !== undefined;

/**
 * A payment source that is another way to spend a hand card already listed: the card with its own "When you spend this
 * card" ability (`Payment.whenSpent`; `paymentOptions` lists the plain spending first). One card is spent once, so a
 * list of everything a player could spend at once holds one entry per card: the plain one (leave these out), or the
 * one that generates the most (`mostFromEachHandCard`).
 */
export const isWhenSpentUse = (payment: Payment): boolean => "fromHand" in payment && payment.whenSpent !== undefined;

/**
 * `payments` with each hand card spent once, the way that generates the most: its plain spending, or one use of its
 * "When you spend this card" ability. Cards are taken in the order listed, and a use whose cost picks a card an
 * earlier one already picked is passed over (one card pays one cost, RRG 1.8 "Cost", p. 13), so the result can be
 * priced whole as far as these entries go. Entries that are not hand cards are returned as they are, in place.
 * `atMostPicks`: only the uses whose cost picks that many cards or fewer, for a caller that wants the cheapest use
 * that pays (`legal.ts walletsWithWhenSpent`).
 */
export function mostFromEachHandCard(
  ctx: Ctx,
  playerId: PlayerId,
  payments: readonly Payment[],
  excludeInstanceId: InstanceId | null,
  payingFor: InstanceId | null,
  atMostPicks = Infinity,
): readonly Payment[] {
  const picked = new Set<InstanceId>();
  const best = new Map<InstanceId, Extract<Payment, { fromHand: InstanceId }>>();
  for (const id of new Set(payments.flatMap((p) => ("fromHand" in p ? [p.fromHand] : [])))) {
    let most = -1;
    for (const entry of payments) {
      if (!("fromHand" in entry) || entry.fromHand !== id) continue;
      const picks = Object.values(entry.whenSpent?.costChoices ?? {}).flat();
      if (picks.length > atMostPicks || picks.some((pick) => picked.has(pick))) continue;
      const pool = priceOrNull(ctx, playerId, [entry], excludeInstanceId, payingFor);
      if (pool === null || poolTotal(pool) <= most) continue;
      most = poolTotal(pool);
      best.set(id, entry);
    }
    for (const pick of Object.values(best.get(id)?.whenSpent?.costChoices ?? {}).flat()) picked.add(pick);
  }
  const placed = new Set<InstanceId>();
  return payments.flatMap((entry): Payment[] => {
    if (!("fromHand" in entry)) return [entry];
    if (placed.has(entry.fromHand)) return [];
    placed.add(entry.fromHand);
    return [best.get(entry.fromHand) ?? entry];
  });
}

/**
 * RRG "Cost": resources come from cards discarded from hand and from "Resource"
 * abilities. Overpaying is legal; the excess is simply lost. Every resource in
 * one payment is generated simultaneously, so "the top card of your discard
 * pile" is the pile as it stood before the payment — never a card this same
 * payment is spending (FAQ "Pepper Potts (#33)", RRG 1.8 p. 58).
 */
/** "This card can be spent for any player" (`spendableForAnyPlayer`, docs/phase7-wave5.md §3.17), read in its owner's hand. */
function spendableForAnyPlayer(state: GameState, deps: EngineDeps, id: InstanceId, ownerId: PlayerId): boolean {
  const context: EffectContext = { selfInstanceId: id, controllerId: ownerId, event: null, bindings: {}, deps };
  return printedConstants(state, deps, id).some(
    (trigger) =>
      trigger.spendableForAnyPlayer !== undefined &&
      (!trigger.spendableForAnyPlayer.while || evaluate(state, trigger.spendableForAnyPlayer.while, context)),
  );
}

/**
 * How much of a payment each resource ability generated, as `paid.ability.<abilityId>` vars (docs/phase7-wave5.md
 * §3.16): "for each resource generated by SP//dr Suit's 'Sync Ratio' ability to pay for her" (VEN#m, `spdr` 31017),
 * "If you paid for this card using a resource generated by … 'Sync Ratio'" (Rapid Deployment, Web-Trap). Read as the
 * ability generates, before any doubling of the whole payment. They travel with the other `paid.*` vars
 * (`playPaymentVars`), so the played card's own abilities read them.
 */
function paymentSourceVars(ctx: Ctx, playerId: PlayerId, payment: readonly Payment[]): Record<string, number> {
  const vars: Record<string, number> = {};
  for (const entry of payment) {
    // A hand card's "When you spend this card" use counts as its ability's, like any other use.
    const use = "ability" in entry ? entry.ability : spentCardUse(entry);
    if (!use) continue;
    const { instanceId, abilityId } = use;
    const zone = locateCard(ctx.state, instanceId);
    const spender =
      "ability" in entry
        ? resourceSpender(ctx.state, ctx.deps, instanceId, abilityId, playerId)
        : zone?.kind === "hand"
          ? zone.playerId
          : playerId;
    const generated = resourceAbilityGenerates(
      ctx.state,
      ctx.deps,
      use,
      spender,
      mustPlayer(ctx.state, spender).discard[0] ?? null,
    );
    const key = `paid.ability.${abilityId}`;
    vars[key] = (vars[key] ?? 0) + poolTotal(generated);
  }
  return vars;
}

/**
 * What a cost took of the pool generated for it: its resolved requirement, with the X resources of a "spend X
 * resources" cost (`resourcesX`) added to the slot they are spent in, since they are paid too. Everything in the pool
 * beyond it is overpaid (RRG 1.8 "Cost", p. 13). The view `paid.cards.<cardType>` (§3.51), `paid.count` and the
 * declared types (§3.62) all take of one payment.
 */
function paidRequirementOf(
  pool: ResourcePool,
  requirement: ResolvedRequirement,
  cost: AbilityCost | undefined,
  resourceVarsRead: Vars,
): ResolvedRequirement {
  // A cost the player sizes took the size chosen (`cost.resources`, `chosenResourceCount`); anything generated beyond
  // it is overpaid like any other cost's (owner decision, 2026-10-08, §4.1 row 78; RRG 1.8 "Cost", p. 13).
  if (resourcesChoiceOf(cost)) {
    const chosen = resourceVarsRead["cost.resources"] ?? 0;
    return { ...requirement, generic: requirement.generic + chosen };
  }
  const x = cost?.resourcesX;
  const xPaid = x ? (resourceVarsRead[x.bind] ?? 0) : 0;
  const xSlot = x && x.resource !== "any" ? x.resource : "generic";
  const withX: ResolvedRequirement = xPaid > 0 ? { ...requirement, [xSlot]: requirement[xSlot] + xPaid } : requirement;
  return satisfies(pool, withX) ? withX : requirement;
}

/**
 * Which hand cards paid, by card type, as `paid.cards.<cardType>` vars (docs/phase7-wave8.md §3.51): "If you paid for
 * this event with a resource card" (Concussive Blast `aoa` 45007, Command Authority 45008) reads
 * `paid.cards.resource`. Each is the number of cards of that type (`cardTypeOf`, read in hand) discarded from a hand in
 * this payment with a resource among the ones **paid** (`canBePaidFor`). A type with no such card has no var.
 *
 * - RRG 1.8 "Cost" (p. 13): resources come "by discarding cards from their hand or by using 'Resource' card
 *   abilities". A resource ability is not a card discarded to pay, whatever card carries it: only `fromHand` entries
 *   are counted. "Resource Card" (p. 37) is a card type, so the card's type is what is read, not what it generates.
 * - §4.1 Q28 = A: overpaid resources "were not paid for that cost" (p. 13), so a card whose every resource is
 *   overpaid is left out, and at a cost of 0 nothing was paid (FAQ "Unstoppable Force (#6)", p. 60). The rules do not
 *   say which resources are the overpaid ones: a card counts when some reading of the payment has one of its resources
 *   paid, which is the reading its player would give.
 *   Each card is judged on its own, so in an overpaid payment the var can count more cards than one reading of the
 *   payment holds together (two resource cards toward a cost of 1 count 2): it is exact as "at least one", which is
 *   all a card in the pool asks, and an upper bound as a number.
 * - "Spend X resources" (`resourcesX`): the X resources are paid too, so they join the requirement here.
 *
 * Read before paying, while the cards are still in hand. They travel with the other `paid.*` vars (`playPaymentVars`).
 */
function paidCardVars(
  ctx: Ctx,
  playerId: PlayerId,
  payment: readonly Payment[],
  payingFor: InstanceId | null,
  pool: ResourcePool,
  requirement: ResolvedRequirement,
  cost: AbilityCost | undefined,
  resourceVarsRead: Vars,
): Record<string, number> {
  const vars: Record<string, number> = {};
  const paidFor = paidRequirementOf(pool, requirement, cost, resourceVarsRead);
  for (const entry of payment) {
    if (!("fromHand" in entry)) continue;
    const type = cardTypeOf(ctx.state, entry.fromHand);
    if (type === null) continue;
    const zone = locateCard(ctx.state, entry.fromHand);
    const ownerId = zone?.kind === "hand" ? zone.playerId : playerId;
    const generated = handCardResources(ctx.state, ctx.deps, entry.fromHand, ownerId, payingFor);
    if (!canBePaidFor(pool, generated, paidFor)) continue;
    const key = `paid.cards.${type}`;
    vars[key] = (vars[key] ?? 0) + 1;
  }
  return vars;
}

/**
 * Whether a `repeatable` resource ability (docs/phase7-wave5.md §3.25) can be used `uses` times in one payment: each
 * use pays its own cost, so the cost `uses` times over must be payable now. Only a fixed `spendCounters` cost repeats
 * (a card exhausts once); any other cost, or a non-repeatable ability, allows one use.
 */
function repeatUsesFault(
  state: GameState,
  deps: EngineDeps,
  instanceId: InstanceId,
  abilityId: string,
  spender: PlayerId,
  uses: number,
): PriceFault | null {
  if (uses <= 1) return null;
  const definition = deps.abilities[abilityId];
  const cost = definition?.cost;
  const counters = cost?.spendCounters;
  if (definition?.trigger.kind !== "resource" || !definition.trigger.repeatable) {
    return { code: "insufficient_resources", message: "duplicate resource ability" };
  }
  const onlyCounters = cost !== undefined && Object.entries(cost).every(([key, v]) => key === "spendCounters" || !v);
  if (!counters || counters.upTo || counters.all || !onlyCounters) {
    return { code: "insufficient_resources", message: `${abilityId} can only be used once per payment` };
  }
  const repeated: AbilityCost = { spendCounters: { ...counters, amount: counters.amount * uses } };
  const plan = planCost(state, deps, instanceId, spender, repeated, {}, new Set());
  return isFault(plan) ? { code: plan.code, message: `${abilityId} cannot be used ${uses} times` } : null;
}

/** Most uses the payment options offer for one `repeatable` resource ability (a safety cap, not a rule). */
const MAX_REPEAT_OPTIONS = 20;

export function priceOf(
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
  const abilityUses = new Map<string, number>();
  // Cards in play the payment's resource abilities spend on their own costs: one card pays one cost (RRG 1.8 "Cost").
  const spentOnCosts = new Set<InstanceId>();
  // Each player's pile as it stood before the payment (FAQ "Pepper Potts (#33)", RRG 1.8 p. 58): never a card this
  // same payment is spending. Pricing changes no state, so the live pile is that snapshot.
  const topOf = (id: PlayerId): InstanceId | null => mustPlayer(ctx.state, id).discard[0] ?? null;
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
      if (
        ownerId === null ||
        (ownerId !== playerId && !group && !spendableForAnyPlayer(ctx.state, ctx.deps, entry.fromHand, ownerId))
      ) {
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
          message: `${displayNameOf(ctx.state, entry.fromHand)} can only be spent in ${spendableIn} form`,
        };
      }
      pool = addPools(pool, handCardResources(ctx.state, ctx.deps, entry.fromHand, ownerId, payingFor));
      // "Interrupt: When you spend this card, [cost] → generate …" (`whenSpent`): what it generates joins the payment.
      const use = spentCardUse(entry);
      if (use) {
        const fault = whenSpentFault(ctx.state, ctx.deps, use, ownerId, payingFor);
        if (fault) return fault;
        const plan = resourceCostPlan(ctx.state, ctx.deps, use, ownerId);
        if (isFault(plan)) return plan;
        for (const id of cardsSpentByResourceCost(ctx.deps, use, plan)) {
          if (spentOnCosts.has(id)) return { code: "invalid_choice", message: "one card cannot pay two costs" };
          spentOnCosts.add(id);
        }
        pool = addPools(
          pool,
          paidForMultiplied(
            ctx.state,
            ctx.deps,
            payingFor,
            resourceAbilityGenerates(ctx.state, ctx.deps, use, ownerId, topOf(ownerId)),
            ownerId,
          ),
        );
      }
      continue;
    }
    const { instanceId, abilityId } = entry.ability;
    const key = `ability:${instanceId}:${abilityId}`;
    const spender = resourceSpender(ctx.state, ctx.deps, instanceId, abilityId, playerId);
    // The same ability again: only a `repeatable` one, its cost paid once per use (docs/phase7-wave5.md §3.25).
    const uses = (abilityUses.get(key) ?? 0) + 1;
    abilityUses.set(key, uses);
    if (!(uses > 1 && repeatsWithNewPicks(ctx.deps, abilityId))) {
      const repeatFault = repeatUsesFault(ctx.state, ctx.deps, instanceId, abilityId, spender, uses);
      if (repeatFault) return repeatFault;
    }
    const choices = entry.ability.costChoices ?? {};
    const fault = resourceAbilityFault(ctx.state, ctx.deps, instanceId, abilityId, playerId, payingFor, group, choices);
    if (fault) return fault;
    const plan = resourceCostPlan(ctx.state, ctx.deps, entry.ability, spender);
    if (isFault(plan)) return plan;
    for (const id of cardsSpentByResourceCost(ctx.deps, entry.ability, plan)) {
      if (spentOnCosts.has(id)) return { code: "invalid_choice", message: "one card cannot pay two costs" };
      spentOnCosts.add(id);
    }
    pool = addPools(
      pool,
      paidForMultiplied(
        ctx.state,
        ctx.deps,
        payingFor,
        resourceAbilityGenerates(ctx.state, ctx.deps, entry.ability, spender, topOf(spender)),
        spender,
      ),
    );
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
        label: displayNameOf(ctx.state, id),
        ref: { kind: "card", instanceId: id },
      });
      // The same card spent with its own "When you spend this card" ability (`whenSpent`): one more option per legal
      // pick of the ability's cost, after the plain spending, each showing what it generates. One of them at most
      // joins a payment (`isWhenSpentUse`).
      for (const abilityId of whenSpentAbilitiesOf(ctx.state, ctx.deps, id)) {
        for (const choices of resourcePickChoices(ctx.state, ctx.deps, id, abilityId, payerId)) {
          const use: ResourceAbilityUse = { instanceId: id, abilityId, ...(choices ? { costChoices: choices } : {}) };
          if (whenSpentFault(ctx.state, ctx.deps, use, payerId, payingFor)) continue;
          const picked = Object.values(choices ?? {}).flatMap((ids) => ids.map((p) => displayNameOf(ctx.state, p)));
          options.push({
            optionId: spentCardOptionId({
              fromHand: id,
              whenSpent: { abilityId, ...(choices ? { costChoices: choices } : {}) },
            }),
            label:
              picked.length > 0
                ? `${displayNameOf(ctx.state, id)} (${picked.join(", ")})`
                : displayNameOf(ctx.state, id),
            ref: { kind: "ability", instanceId: id, abilityId },
          });
        }
      }
    }
  }
  for (const id of cardsInPlay(ctx.state)) {
    const controlled = controllerOf(ctx.state, id) === playerId;
    for (const ref of activeAbilityRefs(ctx.state, id, ctx.deps)) {
      const trigger = ctx.deps.abilities[ref.id]?.trigger;
      if (trigger?.kind !== "resource") continue;
      if (!controlled && trigger.forAnyPlayer !== true && !group) continue;
      const spender = resourceSpender(ctx.state, ctx.deps, id, ref.id, playerId);
      // A cost that picks cards in play: one option per legal pick, so each shows what it generates (Sync Ratio).
      const pickChoices = resourcePickChoices(ctx.state, ctx.deps, id, ref.id, spender);
      if (pickChoices.some((choices) => choices !== undefined)) {
        for (const choices of pickChoices) {
          if (!choices) continue;
          if (resourceAbilityFault(ctx.state, ctx.deps, id, ref.id, playerId, payingFor, group, choices)) continue;
          const picked = Object.values(choices).flatMap((ids) => ids.map((pick) => displayNameOf(ctx.state, pick)));
          options.push({
            optionId: resourceAbilityOptionId({ instanceId: id, abilityId: ref.id, costChoices: choices }),
            label: `${displayNameOf(ctx.state, id)} (${picked.join(", ")})`,
            ref: { kind: "ability", instanceId: id, abilityId: ref.id },
          });
        }
        continue;
      }
      if (resourceAbilityFault(ctx.state, ctx.deps, id, ref.id, playerId, payingFor, group)) continue;
      // "Remove up to 2 threat from … → generate a resource for each" (docs/phase7-wave9.md §3.7 (b)): the plain
      // option removes the most; each smaller amount is an option of its own, so each shows what it generates.
      const amounts = resourceThreatAmounts(ctx.state, ctx.deps, id, ref.id, spender);
      const most = amounts[amounts.length - 1];
      options.push({
        optionId: `ability:${id}:${ref.id}`,
        label:
          most === undefined ? displayNameOf(ctx.state, id) : `${displayNameOf(ctx.state, id)} (remove ${most} threat)`,
        ref: { kind: "ability", instanceId: id, abilityId: ref.id },
      });
      for (const amount of amounts.slice(0, -1).reverse()) {
        options.push({
          optionId: resourceAbilityOptionId({
            instanceId: id,
            abilityId: ref.id,
            costSelection: { removeThreat: amount },
          }),
          label: `${displayNameOf(ctx.state, id)} (remove ${amount} threat)`,
          ref: { kind: "ability", instanceId: id, abilityId: ref.id },
        });
      }
      // A `repeatable` ability (docs/phase7-wave5.md §3.25): one more option per further use its cost can pay for.
      if (!trigger.repeatable) continue;
      for (let n = 2; n <= MAX_REPEAT_OPTIONS; n++) {
        if (repeatUsesFault(ctx.state, ctx.deps, id, ref.id, spender, n)) break;
        options.push({
          optionId: `ability:${id}:${ref.id}:${n}`,
          label: displayNameOf(ctx.state, id),
          ref: { kind: "ability", instanceId: id, abilityId: ref.id },
        });
      }
    }
  }
  return options;
}

/**
 * Option ids name payment entries: "hand:<id>", "hand:<id>:<abilityId>" for a card spent with its own "When you spend
 * this card" ability (`spentCardOptionId`), "ability:<id>:<abilityId>", "ability:<id>:<abilityId>:<n>" for the
 * n-th use of a `repeatable` resource ability (docs/phase7-wave5.md §3.25), which is the same entry again, and a
 * "@<slot>=<id>,<id>;…" suffix for the cards a resource ability's own cost picks (`resourceAbilityOptionId`).
 */
export function paymentsFromOptionIds(optionIds: readonly string[]): readonly Payment[] {
  const payments: Payment[] = [];
  for (const optionId of optionIds) {
    const at = optionId.indexOf("@");
    const head = at < 0 ? optionId : optionId.slice(0, at);
    const [kind, first, second] = head.split(":");
    if (kind === "hand" && first) {
      const picks = at < 0 ? undefined : pickChoicesFromSuffix(optionId.slice(at + 1));
      const whenSpent = second ? { abilityId: asAbilityId(second), ...(picks ? { costChoices: picks } : {}) } : null;
      payments.push({ fromHand: asInstanceId(first), ...(whenSpent ? { whenSpent } : {}) });
    }
    if (kind === "ability" && first && second) {
      const costChoices = at < 0 ? undefined : pickChoicesFromSuffix(optionId.slice(at + 1));
      const costSelection = at < 0 ? undefined : costSelectionFromSuffix(optionId.slice(at + 1));
      payments.push({
        ability: {
          instanceId: asInstanceId(first),
          abilityId: asAbilityId(second),
          ...(costChoices ? { costChoices } : {}),
          ...(costSelection ? { costSelection } : {}),
        },
      });
    }
  }
  return payments;
}

/** "#removeThreat=<n>" among an option id's parts back into the use's `CostSelection`. */
function costSelectionFromSuffix(suffix: string): CostSelection | undefined {
  const part = suffix.split(";").find((each) => each.startsWith(REMOVE_THREAT_OPTION));
  if (part === undefined) return undefined;
  const amount = Number(part.slice(REMOVE_THREAT_OPTION.length));
  return Number.isInteger(amount) ? { removeThreat: amount } : undefined;
}

/** "<slot>=<id>,<id>;<slot>=<id>" back into `CostChoices`; a "#…" part is not a slot (`costSelectionFromSuffix`). */
function pickChoicesFromSuffix(suffix: string): CostChoices | undefined {
  const choices: Record<string, readonly InstanceId[]> = {};
  for (const part of suffix.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0 || part.startsWith("#")) continue;
    choices[part.slice(0, eq)] = part
      .slice(eq + 1)
      .split(",")
      .filter((id) => id.length > 0)
      .map(asInstanceId);
  }
  return Object.keys(choices).length > 0 ? choices : undefined;
}

/** A resource ability a payment used, and who used it: its own effects resolve with the payment (§3.30 of wave 4). */
export interface UsedResourceAbility {
  readonly instanceId: InstanceId;
  readonly abilityId: AbilityId;
  readonly spender: PlayerId;
}

/**
 * The threat cost of a resource ability a payment used (`AbilityCost.removeThreat`; docs/phase7-wave9.md §3.7 (b)):
 * `amount` threat to come off `fromId`, the amount the payment was priced with (`resourceCostVars`).
 */
export interface ResourceThreatCost {
  readonly instanceId: InstanceId;
  readonly spender: PlayerId;
  readonly fromId: InstanceId;
  readonly amount: number;
}

/** Resources one player generated in a payment (docs/phase7-wave5.md §3.25). */
export interface GeneratedByPlayer {
  readonly playerId: PlayerId;
  readonly amount: number;
}

/**
 * What a payment spent: hand cards discarded (in payment order) and resource abilities used, and how many resources
 * each player generated doing it (in the order the players first appear in the payment). A `spentAsIfResource` use
 * generates nothing (docs/phase7-wave5.md §4.1 Q5): a payment of only those has no `generated` entry.
 */
export interface SpentPayment {
  readonly cards: readonly InstanceId[];
  readonly resourceAbilities: readonly UsedResourceAbility[];
  readonly generated: readonly GeneratedByPlayer[];
  /**
   * The `countersRemoved` (`paidAsCost`) a resource ability's counter cost made (Psionic Bond, wave 6 §3.85), held for
   * `announceResourcesSpent` so they sit above the card or ability paid for, not below it.
   */
  readonly countersRemoved?: readonly TriggerEvent[];
  /**
   * The threat costs of the resource abilities used ("remove up to 2 threat from … → generate a resource for each
   * threat you removed this way"; docs/phase7-wave9.md §3.7 (b)), held for `announceResourcesSpent` like
   * `countersRemoved`: the removal is an ordinary `removeThreat` event, which has to sit above the card or ability
   * paid for so that it resolves first (RRG 1.8 "Initiating Abilities", p. 24, step 5 before step 6).
   */
  readonly threatCosts?: readonly ResourceThreatCost[];
}

export const NOTHING_SPENT: SpentPayment = { cards: [], resourceAbilities: [], generated: [] };

/** A player's amount added to a per-player list, keeping first-appearance order. */
function addGenerated(
  into: readonly GeneratedByPlayer[],
  playerId: PlayerId,
  amount: number,
): readonly GeneratedByPlayer[] {
  if (!into.some((entry) => entry.playerId === playerId)) return [...into, { playerId, amount }];
  return into.map((entry) => (entry.playerId === playerId ? { playerId, amount: entry.amount + amount } : entry));
}

/** Two payments' spending together (a basic power's extra cost). */
export const joinSpent = (a: SpentPayment, b: SpentPayment): SpentPayment => ({
  cards: [...a.cards, ...b.cards],
  resourceAbilities: [...a.resourceAbilities, ...b.resourceAbilities],
  generated: b.generated.reduce((all, entry) => addGenerated(all, entry.playerId, entry.amount), a.generated),
  countersRemoved: [...(a.countersRemoved ?? []), ...(b.countersRemoved ?? [])],
});

/**
 * Spends a priced payment. Returns the cards it discarded from hand, in payment order — the cards that were *spent* —
 * and the resource abilities it used, which the caller announces with `announceResourcesSpent` once the thing being
 * paid for is on the stack.
 */
export function payPayment(
  ctx: Ctx,
  playerId: PlayerId,
  payment: readonly Payment[],
  /** The card being paid for, so a hand card counts as `priceOf` counted it ("double … while paying for X"). */
  payingFor: InstanceId | null = null,
): SpentPayment {
  const spent: InstanceId[] = [];
  const used: UsedResourceAbility[] = [];
  const countersRemoved: TriggerEvent[] = [];
  const threatCosts: ResourceThreatCost[] = [];
  let generatedBy: readonly GeneratedByPlayer[] = [];
  // Read before anything is discarded: the payment's resources are generated simultaneously (see `priceOf`).
  // Each player's pile top before any card of this payment is discarded (FAQ "Pepper Potts (#33)", RRG 1.8 p. 58).
  const discardTopBefore = new Map(ctx.state.players.map((p) => [p.playerId, p.discard[0] ?? null] as const));
  // What each hand card generates, read before any is discarded (docs/phase7-wave5.md §3.25).
  const handGenerated = new Map<InstanceId, GeneratedByPlayer>();
  for (const entry of payment) {
    if (!("fromHand" in entry)) continue;
    const zone = locateCard(ctx.state, entry.fromHand);
    const ownerId = zone?.kind === "hand" ? zone.playerId : playerId;
    const pool = handCardResources(ctx.state, ctx.deps, entry.fromHand, ownerId, payingFor);
    handGenerated.set(entry.fromHand, { playerId: ownerId, amount: poolTotal(pool) });
  }
  for (const entry of payment) {
    if ("fromHand" in entry) {
      // From the hand it is in: another player's, when they help pay for an alliance card (§3.17).
      const zone = locateCard(ctx.state, entry.fromHand);
      const spenderOfCard = zone?.kind === "hand" ? zone.playerId : playerId;
      // "Interrupt: When you spend this card, [cost] → generate …" (`whenSpent`): its cost is paid before the card is
      // discarded (RRG 1.8 "Interrupt", p. 25), measured first as any resource ability's is.
      const use = spentCardUse(entry);
      const definition = use ? ctx.deps.abilities[use.abilityId] : undefined;
      if (use && definition) {
        const generated = paidForMultiplied(
          ctx.state,
          ctx.deps,
          payingFor,
          resourceAbilityGenerates(
            ctx.state,
            ctx.deps,
            use,
            spenderOfCard,
            discardTopBefore.get(spenderOfCard) ?? null,
          ),
          spenderOfCard,
        );
        const plan = resourceCostPlan(ctx.state, ctx.deps, use, spenderOfCard);
        if (!isFault(plan))
          payCost(ctx, use.instanceId, spenderOfCard, definition.cost, plan, countersRemoved, threatCosts);
        recordAbilityUse(ctx, use.instanceId, use.abilityId, definition, null, spenderOfCard);
        emit(ctx, {
          type: "resourcesGenerated",
          playerId: spenderOfCard,
          instanceId: use.instanceId,
          abilityId: use.abilityId,
          amount: poolTotal(generated),
          pool: generated,
        });
        generatedBy = addGenerated(generatedBy, spenderOfCard, poolTotal(generated));
        if (definition.effects.length > 0)
          used.push({ instanceId: use.instanceId, abilityId: use.abilityId, spender: spenderOfCard });
      }
      discardFromHand(ctx, spenderOfCard, entry.fromHand);
      spent.push(entry.fromHand);
      const counted = handGenerated.get(entry.fromHand);
      if (counted) generatedBy = addGenerated(generatedBy, counted.playerId, counted.amount);
      continue;
    }
    const { instanceId, abilityId } = entry.ability;
    const definition = ctx.deps.abilities[abilityId];
    if (!definition) continue;
    const spender = resourceSpender(ctx.state, ctx.deps, instanceId, abilityId, playerId);
    // The cost with this use's own picks (Sync Ratio's Interface upgrade), measured before paying it moves anything,
    // then paid: RRG 1.8 "Initiating Abilities" (p. 24), steps 3 and 5 before the resources are generated (step 6).
    const generated = paidForMultiplied(
      ctx.state,
      ctx.deps,
      payingFor,
      resourceAbilityGenerates(ctx.state, ctx.deps, entry.ability, spender, discardTopBefore.get(spender) ?? null),
      spender,
    );
    const plan = resourceCostPlan(ctx.state, ctx.deps, entry.ability, spender);
    if (!isFault(plan)) payCost(ctx, instanceId, spender, definition.cost, plan, countersRemoved, threatCosts);
    recordAbilityUse(ctx, instanceId, abilityId, definition, null, spender);
    emit(ctx, {
      type: "resourcesGenerated",
      playerId: spender,
      instanceId,
      abilityId,
      amount: poolTotal(generated),
      pool: generated,
    });
    // A counter spent as if it were a resource pays but generates nothing (docs/phase7-wave5.md §4.1 Q5; RRG 1.8 p. 13).
    const spentAsIf = definition.trigger.kind === "resource" && definition.trigger.spentAsIfResource === true;
    if (!spentAsIf) generatedBy = addGenerated(generatedBy, spender, poolTotal(generated));
    if (definition.effects.length > 0) used.push({ instanceId, abilityId, spender });
  }
  return {
    cards: spent,
    resourceAbilities: used,
    generated: generatedBy,
    ...(countersRemoved.length > 0 ? { countersRemoved } : {}),
    ...(threatCosts.length > 0 ? { threatCosts } : {}),
  };
}

/**
 * "After you spend this card" / "When you spend this card" (docs/phase7-wave2.md §12): announces the cards one payment
 * spent (`resourcesSpent`). Call it **after** pushing the card or ability the payment was for, so the event sits above
 * it on the stack and its windows resolve first — between paying the costs and the card commencing being played (RRG
 * 1.8 "Initiating Abilities", p. 24, steps 5–6; "Cost Arrow Icon", p. 14; ruling, Feb 28, 2026 (1)).
 *
 * The payment is one occurrence: its `resourcesSpent` events (the paying player's first) and its `resourcesGenerated`
 * events (docs/phase7-wave5.md §3.25) share one response window (§4.1 Q25; RRG 1.8 "Triggering Condition", p. 45), so
 * forced responses to any of them resolve before optional ones to any (RRG 1.8 "Simultaneous Timing Priority", p. 5).
 * Each `resourcesSpent` keeps its own interrupt window.
 *
 * Pushed only when an ability could react, so a payment nothing cares about leaves the stack and the log as they were.
 */
export function announceResourcesSpent(
  ctx: Ctx,
  playerId: PlayerId,
  paid: SpentPayment,
  payingForInstanceId: InstanceId | null,
  purpose: "playCard" | "ability" | "effect",
): void {
  const events = [
    // A resource ability's counter cost, paid first (RRG 1.8 "Initiating Abilities", p. 24, step 5), already heard.
    ...(paid.countersRemoved ?? []),
    ...cardsSpentEvents(ctx, playerId, paid.cards, payingForInstanceId, purpose),
    ...resourcesGeneratedEvents(playerId, paid.generated, payingForInstanceId, purpose),
  ].filter((event) => heard(ctx.state, ctx.deps, event));
  pushEventsSharingResponses(ctx, events);
  // "Resource: Exhaust Gauntlet Gun → generate a [wild] resource for a War Machine event **and place 1 ammo counter on
  // War Machine**" (docs/phase7-wave4.md §3.30): a resource ability's own effects are part of using it, so they resolve
  // with the payment — pushed last, they resolve before the "after you spend" windows and before the card or ability
  // paid for (RRG 1.8 "Initiating Abilities", p. 24, steps 5–6; "Resource Ability", p. 37). "That event deals 1
  // additional damage" (Cybernetic Arm) reads the card paid for from slot `paidFor`.
  for (const { instanceId, abilityId, spender } of [...paid.resourceAbilities].reverse()) {
    const definition = ctx.deps.abilities[abilityId];
    if (!definition || definition.effects.length === 0) continue;
    emit(ctx, { type: "resourceAbilityEffects", instanceId, abilityId, playerId: spender });
    pushEffects(ctx, {
      effects: definition.effects,
      selfInstanceId: instanceId,
      controllerId: spender,
      bindings: payingForInstanceId ? { paidFor: [payingForInstanceId] } : {},
    });
  }
  // A resource ability's threat cost (`SpentPayment.threatCosts`): pushed last of all, so the threat comes off before
  // the ability's own effects, the "after you spend" windows and the card or ability paid for. The resources were
  // generated from the planned amount; the removal has no frame to report an unpaid cost to.
  for (const { instanceId, spender, fromId, amount } of [...(paid.threatCosts ?? [])].reverse()) {
    pushEffects(ctx, {
      effects: removeThreatCostEffects({ fromId, min: amount, max: amount }, null),
      selfInstanceId: instanceId,
      controllerId: spender,
    });
  }
}

/**
 * "After the engaged player generates any number of resources" (M.O.R.B.I.U.S.; docs/phase7-wave5.md §3.25): one
 * `resourcesGenerated` per player who generated at least 1 resource in the payment, the paying player's first. They
 * resolve after the payment's `resourcesSpent` events, in the same response window (§4.1 Q25).
 */
function resourcesGeneratedEvents(
  playerId: PlayerId,
  generated: readonly GeneratedByPlayer[],
  payingForInstanceId: InstanceId | null,
  purpose: "playCard" | "ability" | "effect",
): readonly TriggerEvent[] {
  return generated.flatMap(({ playerId: generator, amount }): TriggerEvent[] =>
    amount > 0
      ? [
          {
            kind: "resourcesGenerated",
            playerId: generator,
            amount,
            forPlayerId: playerId,
            payingForInstanceId,
            purpose,
          },
        ]
      : [],
  );
}

/**
 * One `resourcesSpent` per player who spent cards, the paying player's first: an alliance payment (§3.17) spans
 * players, and "After you spend this card for a player" (Everyday Hero) names both the spender and the player paid for.
 * Spenders are the cards' owners (a hand card is in its owner's hand).
 */
function cardsSpentEvents(
  ctx: Ctx,
  playerId: PlayerId,
  spent: readonly InstanceId[],
  payingForInstanceId: InstanceId | null,
  purpose: "playCard" | "ability" | "effect",
): readonly TriggerEvent[] {
  if (spent.length === 0) return [];
  const spenders = [playerId, ...ctx.state.players.flatMap((p) => (p.playerId === playerId ? [] : [p.playerId]))];
  return spenders.flatMap((spender): TriggerEvent[] => {
    const theirs = spent.filter((id) => (getInstance(ctx.state, id)?.ownerId ?? playerId) === spender);
    if (theirs.length === 0) return [];
    return [
      {
        kind: "resourcesSpent",
        cardInstanceIds: theirs,
        playerId: spender,
        forPlayerId: playerId,
        payingForInstanceId,
        purpose,
      },
    ];
  });
}

/**
 * Cards a payment already uses: hand cards it discards, cards whose resource ability it uses, and the cards those
 * abilities' own costs name as picks. A hand card can't also be picked for a "discard N cards" cost, and an in-play card
 * can't also pay an `InPlayCostPick` (RRG 1.8 "Cost", p. 13).
 */
export const handCardsIn = (payment: readonly Payment[]): ReadonlySet<InstanceId> =>
  new Set(
    payment.flatMap((entry) =>
      "fromHand" in entry
        ? [entry.fromHand]
        : [entry.ability.instanceId, ...Object.values(entry.ability.costChoices ?? {}).flat()],
    ),
  );

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
 *   branch whose non-resource components can be paid now is taken (the only branch a timing window can take: it asks
 *   for no branch). A branch index out of range is refused. RRG 1.8 "Choose (Option)" (p. 12): a player "cannot
 *   choose an option that cannot be at least partially resolved", including one with "a cost the player cannot pay".
 * - `spendCounters.all`: every counter of the type the holder has, at least one; no choice.
 * - `spendCounters.upTo`: `selection.counters` counters, from 1 (RRG 1.8 "Cost", p. 14: "up to" some number "requires
 *   a minimum of one") to the printed maximum and what the card holds; with none, as many as it can. A timing window
 *   asks for it first (`chooseCostCounters`, docs/phase7-wave6.md §3.53) and passes the answer here.
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
  /** The event a triggered ability answers, as `planCost` takes it; a branch's computed X is read against it. */
  event: TriggerEvent | null = null,
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
        const concrete = selectCost(
          state,
          deps,
          sourceId,
          playerId,
          branchCost(i),
          selection,
          choices,
          reserved,
          event,
        );
        return (
          !isFault(concrete) &&
          !isFault(planCost(state, deps, sourceId, playerId, concrete.cost, choices, reserved, {}, event))
        );
      });
      index = payable < 0 ? 0 : payable;
    }
    chosen = branchCost(index);
    if (chosen.either) return { code: "invalid_choice", message: "an either/or cost cannot nest another" };
    vars["cost.branch"] = index;
  }
  const counters = chosen.spendCounters;
  if (counters?.all) {
    // "Remove each [type] counter": every counter the holder has, at least one (RRG 1.8 "Cost", p. 14, by analogy).
    if (counters.upTo) return { code: "invalid_choice", message: "a counter cost is either 'up to' or 'each'" };
    const holderId = counterCostHolder(state, deps, sourceId, playerId, counters.target);
    if (typeof holderId !== "string") return holderId;
    const held = getInstance(state, holderId)?.counters[counters.counterType] ?? 0;
    if (held < 1) return { code: "insufficient_resources", message: `no ${counters.counterType} counters to remove` };
    const { all: _all, ...fixed } = counters;
    chosen = { ...chosen, spendCounters: { ...fixed, amount: held } };
  } else if (counters?.upTo) {
    const holderId = counterCostHolder(state, deps, sourceId, playerId, counters.target);
    if (typeof holderId !== "string") return holderId;
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

/**
 * The count an "up to N" counter cost (`spendCounters.upTo`) leaves to the player right now: its counter type and the
 * most that can be removed (the printed N or what the card holds, whichever is lower), on the cost the board picks
 * (`conditional`) and, for an either/or cost, the branch the default selection takes (the first payable one, the
 * only branch a timing window can pick). Null when the cost has no such component or cannot be paid. A timing window
 * asks for the count from 1 to `max` (docs/phase7-wave6.md §3.53; RRG 1.8 "Cost", p. 14: "up to" needs at least one).
 */
export function upToCounterChoice(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  written: AbilityCost | undefined,
  choices: CostChoices = {},
): { readonly counterType: string; readonly max: number } | null {
  if (!written) return null;
  let cost = determineConditionalCost(state, deps, sourceId, playerId, written).cost;
  if (cost.either) {
    // One counter is payable whenever any count is, so this finds the branch every count of it would take.
    const selected = selectCost(state, deps, sourceId, playerId, written, { counters: 1 }, choices);
    if (isFault(selected)) return null;
    const { either, ...common } = cost;
    cost = { ...common, ...either[selected.vars["cost.branch"] ?? 0] };
  }
  const counters = cost.spendCounters;
  if (!counters?.upTo) return null;
  const holderId = counterCostHolder(state, deps, sourceId, playerId, counters.target);
  if (typeof holderId !== "string") return null;
  const held = getInstance(state, holderId)?.counters[counters.counterType] ?? 0;
  return { counterType: counters.counterType, max: Math.min(counters.amount, held) };
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
/**
 * How many cards a "discard the top N cards of your deck →" cost takes (docs/phase7-wave4.md §3.42): a number, or a value
 * read against the event of the innermost open window ("discard that many cards", Shield Spell), none outside one.
 */
function deckDiscardCount(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  spec: number | ValueSpec,
): number {
  if (typeof spec === "number") return spec;
  const window = state.stack.find((f) => f.kind === "window");
  const event = window?.kind === "window" ? window.event : null;
  const carried = carriedByEvent(event);
  const context: EffectContext = {
    selfInstanceId: sourceId,
    controllerId: playerId,
    event,
    bindings: carried.bindings,
    vars: carried.vars,
    deps,
  };
  return Math.max(0, resolveValue(state, spec, context, deps));
}

/**
 * The resources an ability's cost asks for: its fixed `resources` plus "spend X resources of any type, where X is …"
 * (`resourcesEqualTo`), X read now, as the cost is determined. `computed` is that X when the cost has one. `planCost`
 * and a window's estimate of an in-hand event's cost (`windowEventCost`) both read it.
 *
 * `event` is the event a triggered ability answers (an interrupt or response, forced or not, in play or played from
 * hand), so "spend 1 resource for each damage dealt by that attack →" reads that attack's result; null for an action,
 * which answers nothing. RRG 1.8 "Initiating Abilities" (p. 24): the cost is determined (step 3) once the ability's
 * triggering condition has been met, so the event is there to read.
 */
export function costResourceRequirement(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  cost: AbilityCost | undefined,
  event: TriggerEvent | null = null,
): { readonly requirement: ResolvedRequirement; readonly computed?: number } {
  // A size the payer chooses (`ResourcesChoice`) is no fixed requirement: `resourceVars` reads it off the payment.
  const fixed = combineRequirements(fixedResourcesOf(cost), 0);
  if (cost?.resourcesEqualTo === undefined) return { requirement: fixed };
  const carried = carriedByEvent(event);
  const context: EffectContext = {
    selfInstanceId: sourceId,
    controllerId: playerId,
    event,
    bindings: carried.bindings,
    vars: carried.vars,
    deps,
  };
  const computed = Math.max(0, Math.floor(resolveValue(state, cost.resourcesEqualTo, context, deps)));
  return { requirement: combineRequirements(fixed, computed), computed };
}

export function planCost(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  cost: AbilityCost | undefined,
  choices: CostChoices,
  reserved: ReadonlySet<InstanceId>,
  selection: CostSelection = {},
  /** The event a triggered ability answers, for a computed X that reads it (`costResourceRequirement`). */
  event: TriggerEvent | null = null,
): CostPlan | PriceFault {
  if (!cost) return { requirement: NO_REQUIREMENT, bindings: {}, vars: {}, payingFor: null };
  const source = getInstance(state, sourceId);
  if (!source) return { code: "unknown_instance", message: `no instance ${sourceId}` };
  // Conditional, either/or and "up to N" costs become the cost actually paid (docs/phase7-wave3.md §3.32, §3.36, §3.49).
  const selected =
    cost.conditional || cost.either || cost.spendCounters?.upTo || cost.spendCounters?.all
      ? selectCost(state, deps, sourceId, playerId, cost, selection, choices, reserved, event)
      : null;
  if (selected && isFault(selected)) return selected;
  if (selected) cost = selected.cost;
  const player = mustPlayer(state, playerId);
  const identity = mustInstance(state, player.identity.instanceId);
  const bindings: Record<string, readonly InstanceId[]> = {};
  const vars: Record<string, number> = { ...selected?.vars };
  const asked = costResourceRequirement(state, deps, sourceId, playerId, cost, event);
  let requirement = asked.requirement;
  let payingFor: InstanceId | null = null;
  if (asked.computed !== undefined) vars["cost.resources"] = asked.computed;

  if (cost.exhaustSelf && source.exhausted)
    return { code: "already_exhausted", message: "the card is already exhausted" };
  // "Flip this card →" (docs/phase7-wave7.md §3.64): a card that cannot flip cannot pay it (RRG 1.8 "Cost", p. 13).
  if (cost.flipSelf) {
    const card = cardOf(state, sourceId);
    if (!cardsInPlay(state).includes(sourceId) || !(card && "flipSide" in card && card.flipSide)) {
      return { code: "card_not_in_zone", message: "the card must be in play with another face to pay this cost" };
    }
    if (cannotFlip(state, deps, sourceId)) return { code: "no_valid_target", message: "this card cannot be flipped" };
  }
  if (cost.spendCounters) {
    const holderId = counterCostHolder(state, deps, sourceId, playerId, cost.spendCounters.target);
    if (typeof holderId !== "string") return holderId;
    const holder = mustInstance(state, holderId);
    if ((holder.counters[cost.spendCounters.counterType] ?? 0) < cost.spendCounters.amount) {
      return { code: "insufficient_resources", message: `not enough ${cost.spendCounters.counterType} counters` };
    }
    if (cost.spendCounters.bind) vars[cost.spendCounters.bind] = cost.spendCounters.amount;
  }
  // "Discard the top card of your deck →" (docs/phase7-wave3.md §3.33): the deck, or the deck the rules would already
  // have reshuffled from the discard pile (an empty deck beside a discard pile is a state built before §4 Q15's
  // immediate reset), must hold them all.
  if (isDeckDiscardChoice(cost.discardFromDeck)) {
    // "Discard up to 3 cards from the top of your deck →" (docs/phase7-wave8.md §3.55): the range the payer will pick
    // from as the cost is paid, read now and cut to what the deck can supply (RRG 1.8 "Player Deck", p. 33).
    const range = deckDiscardChoiceRange(player, cost.discardFromDeck);
    if (!range) {
      return { code: "card_not_in_zone", message: "your deck cannot supply the cards this cost discards" };
    }
    vars[DECK_DISCARD_MIN_VAR] = range.min;
    vars[DECK_DISCARD_MAX_VAR] = range.max;
  } else if (cost.discardFromDeck !== undefined) {
    const count = deckDiscardCount(state, deps, sourceId, playerId, cost.discardFromDeck);
    if (deckDiscardSupply(player) < count) {
      return { code: "card_not_in_zone", message: `discard the top ${count} card(s) of your deck` };
    }
  }
  // "Look at the top 2 cards of the encounter deck. Discard 1 of those cards →" (docs/phase7-wave6.md §3.54): the cards
  // looked at must supply every discard (RRG 1.8 "Cost", p. 13); an empty deck counts its discard pile, reset first.
  if (cost.encounterLookDiscard && !encounterLookPayable(state, cost.encounterLookDiscard)) {
    const { look, discard } = cost.encounterLookDiscard;
    return {
      code: "card_not_in_zone",
      message: `look at the top ${look} card(s) of the encounter deck and discard ${discard}`,
    };
  }
  if (cost.exhaustIdentity && identity.exhausted) {
    return { code: "already_exhausted", message: "your identity is already exhausted" };
  }
  // A heal cost can only be paid if there is that much damage to heal (RRG "Cost": costs are paid in full).
  if (cost.healIdentity !== undefined && identity.damage < cost.healIdentity) {
    return { code: "insufficient_resources", message: "not enough damage to heal as a cost" };
  }
  // Nor if the identity cannot be healed by this card (`RuleSpec cannotBeHealed`, docs/phase7-wave6.md §3.12).
  if (cost.healIdentity !== undefined && cannotBeHealed(state, deps, player.identity.instanceId, sourceId)) {
    return { code: "insufficient_resources", message: "your identity cannot be healed" };
  }
  const given = planGivenCards(state, deps, sourceId, playerId, cost);
  if (given) return given;
  // "Take 3 indirect damage →" (`AbilityCost.indirectDamage`): payable only if every point can be taken (RRG 1.8 "Cost",
  // p. 14), so not onto a character whose tough status card would prevent it.
  if (
    cost.indirectDamage !== undefined &&
    indirectDamageCapacity(state, deps, playerId, sourceId, { excludeTough: true }) < cost.indirectDamage
  ) {
    return {
      code: "insufficient_resources",
      message: `your characters cannot take all ${cost.indirectDamage} indirect damage this cost needs`,
    };
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
      // "You cannot choose to discard this card from your hand" (docs/phase7-wave4.md §3.13).
      if (cannotChooseToDiscard(state, deps, id)) {
        return { code: "no_valid_target", message: `${id} cannot be chosen to be discarded` };
      }
    }
    if (new Set(picks).size !== picks.length) return { code: "invalid_choice", message: "duplicate discard choice" };
    // "… with a combined resource cost of 3 or more →" (Advanced Glider, `sm` 27136): the picks together must reach it.
    const combined = cost.discardFromHand.combined;
    if (combined) {
      const total = discardCombinedTotal(state, picks, combined);
      if (total < combined.atLeast) {
        return {
          code: "invalid_choice",
          message: `the discarded cards' combined ${combined.measure} is ${total}; this cost needs ${combined.atLeast} or more`,
        };
      }
    }
    bindings.discard = picks;
    if (bind) vars[bind] = picks.length;
  }
  if (cost.discardRandomFromHand !== undefined) {
    // Picked when paid (`payCost`); here only whether enough cards are left once the payment and chosen discards are out.
    const chosen = new Set(bindings.discard ?? []);
    // "Discard 1 identity-specific card at random" (`discardRandomFromHandFilter`): only matching cards can pay it.
    const randomFilter = cost.discardRandomFromHandFilter;
    const randomContext: EffectContext = {
      selfInstanceId: sourceId,
      controllerId: playerId,
      event: null,
      bindings: {},
      deps,
    };
    const left = player.hand.filter(
      (id) =>
        id !== sourceId &&
        !reserved.has(id) &&
        !chosen.has(id) &&
        (!randomFilter || matchesQuery(state, id, randomFilter, randomContext)),
    ).length;
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
     * because it lets `legalActions` gray the card rather than let a player burn resources.
     * No FFG ruling found either way as of 2026-09-12; see the report for the open question.
     */
    if (entersPlay && card) {
      const match = matchingCardInPlay(state, card, new Set([pick]), playerId, deps);
      if (match) {
        return { code: "duplicate_unique_card", message: uniqueBlockedMessageIn(state, card, match) };
      }
      // The same reading for a card a rule keeps out of play (`RuleSpec cannotEnterPlay`, docs/phase7-wave8.md §3.43).
      if (cannotEnterPlay(state, deps, pick)) {
        return { code: "no_valid_target", message: `${card.name} cannot enter play during this game` };
      }
    }
    const printed = printedCostOf(state, card);
    requirement = combineRequirements(requirement, printed);
    bindings[slot] = [pick];
    payingFor = pick;
  }
  // "Choose an ATTACK event in your hand … →" (`AbilityCost.chooseCard`, docs/phase7-wave6.md §3.42).
  if (cost.chooseCard) {
    const { slot, from, playableIgnoringCost } = cost.chooseCard;
    const [pick, ...extra] = choices[slot] ?? [];
    if (!pick || extra.length > 0) return { code: "invalid_choice", message: `choose exactly one card for ${slot}` };
    if (pick === sourceId || reserved.has(pick) || !zoneMatches(state, pick, playerId, { ...from, player: "you" })) {
      return { code: "no_valid_target", message: `${pick} is not a legal choice for ${slot}` };
    }
    if (playableIgnoringCost) {
      // Played from hand (`playFromHand`), so a card picked from any other zone has no way to be played.
      const fault = playIgnoringCostFault(createCtx(state, deps), playerId, pick, "hand");
      if (fault) return { code: "no_valid_target", message: `${pick} cannot be played ignoring its cost: ${fault}` };
    }
    bindings[slot] = [pick];
  }
  // "Find Touched and attach it to a character other than Rogue and deal 2 damage to that character →" (`attach`,
  // `dealDamage`; `attach-cost.ts`, docs/phase7-wave6.md §3.49): the card, the payer's host pick, then the damage's
  // targets read with that pick bound.
  if (cost.attach) {
    const attached = planAttachCost(state, deps, sourceId, playerId, cost.attach, choices, reserved);
    if (isFault(attached)) return attached;
    Object.assign(bindings, attached);
  }
  // "Deal 1 damage to another friendly character →" (`dealDamage.choose`, docs/phase7-wave8.md §3.74): the payer's pick.
  if (cost.dealDamage?.choose) {
    const chosen = planDealDamageChoice(state, deps, sourceId, playerId, cost.dealDamage.choose, choices, bindings);
    if (isFault(chosen)) return chosen;
    Object.assign(bindings, chosen);
  }
  if (
    cost.dealDamage &&
    dealDamageCostTargets(state, deps, sourceId, playerId, cost.dealDamage.target, bindings).length === 0
  ) {
    return { code: "no_valid_target", message: "nothing in play to deal this cost's damage to" };
  }
  // "Attached villain attacks you →" (`enemyAttack`, `enemy-attack-cost.ts`; docs/phase7-wave7.md §4.1 Q13 = B): not
  // while the enemy could not attack, so a stunned one keeps its stun and the ability is not offered.
  if (cost.enemyAttack) {
    const enemyId = enemyAttackCostEnemy(state, deps, sourceId, playerId, cost.enemyAttack, bindings);
    const fault = enemyAttackCostFault(state, deps, enemyId, playerId);
    if (fault) return { code: "no_valid_target", message: fault };
  }
  // "Resolve its 'Forced Response' as if it just attacked you →" (`resolveAbility`, `resolve-ability-cost.ts`;
  // docs/phase7-wave8.md §4.1 Q7 = A): not while resolving it would change nothing, so the ability is not offered.
  if (cost.resolveAbility) {
    const planned = planResolveAbilityCost(state, deps, sourceId, playerId, cost.resolveAbility, choices, bindings);
    if ("fault" in planned)
      return { code: planned.choice ? "invalid_choice" : "no_valid_target", message: planned.fault };
    // "The [SETTING] environment" with several in play (`choose`, §4.1 Q15 = A): the payer's pick, bound for the rest.
    if (cost.resolveAbility.choose) bindings[cost.resolveAbility.choose] = [planned.ofId];
  }
  // "Take damage equal to its printed cost →": a value read now, with the picks above bound (`damageSelf`).
  if (cost.damageSelf !== undefined && typeof cost.damageSelf !== "number") {
    const context: EffectContext = {
      selfInstanceId: sourceId,
      controllerId: playerId,
      event: null,
      bindings,
      vars,
      deps,
    };
    if ("choose" in cost.damageSelf) {
      // "Take any amount of damage up to … →" (docs/phase7-wave7.md §3.79): the range the payer will pick from as the
      // cost is paid, read now and cut to what the identity could take in full (RRG 1.8 "Cost", p. 14).
      const range = damageSelfChoiceRange(state, deps, identity.instanceId, sourceId, cost.damageSelf, context);
      if (!range) {
        return { code: "insufficient_resources", message: "your identity cannot take the damage this cost needs" };
      }
      vars[DAMAGE_SELF_MIN_VAR] = range.min;
      vars[DAMAGE_SELF_MAX_VAR] = range.max;
    } else {
      vars["cost.damageSelf"] = Math.max(0, resolveValue(state, cost.damageSelf, context, deps));
    }
  }
  // "Remove up to 3 threat from here →" (`remove-threat-cost.ts`, docs/phase7-wave9.md §3.7 (b)): the card and the
  // range the payer will pick from as the cost is paid, read now with the picks above bound.
  if (cost.removeThreat) {
    const planned = removeThreatCostPlan(state, deps, sourceId, playerId, cost.removeThreat, bindings, vars);
    if ("fault" in planned) return { code: "insufficient_resources", message: planned.fault };
    // The amount named up front (`CostSelection.removeThreat`) is a range of one number, which is not asked.
    const named = typeof cost.removeThreat.amount === "number" ? undefined : selection.removeThreat;
    if (named !== undefined && (!Number.isInteger(named) || named < planned.min || named > planned.max)) {
      return {
        code: "invalid_choice",
        message: `this cost removes ${planned.min} to ${planned.max} threat, not ${named}`,
      };
    }
    bindings[REMOVE_THREAT_FROM_SLOT] = [planned.fromId];
    vars[REMOVE_THREAT_MIN_VAR] = named ?? planned.min;
    vars[REMOVE_THREAT_MAX_VAR] = named ?? planned.max;
  }
  // "Take 1 damage →" can be paid only if all of it can be taken (RRG 1.8 "Cost", p. 14): not by an identity holding a
  // tough status card (FAQ "Focused Rage (#27)", p. 57: "you cannot attempt to pay the cost of Focused Rage's ability
  // just to remove She-Hulk's tough status card"), nor one that cannot take damage or a constant would reduce it. The
  // same check as `damageCards`; an interrupt that prevents it is found out as it is paid (`settleCostDamage`).
  const damageSelf = costDamageSelf(cost, vars);
  if (damageSelf > 0 && !canTakeCostDamage(state, deps, identity.instanceId, sourceId, damageSelf)) {
    return {
      code: "insufficient_resources",
      message: `your identity cannot take all ${damageSelf} damage this cost needs`,
    };
  }
  // Costs paid with cards in play: "exhaust Captain America's Shield →", "exhaust any number of allies you control →",
  // "return Captain America's Shield from play to your hand →" (`InPlayCostPick`).
  const picked: { readonly pick: InPlayCostPick; readonly ids: readonly InstanceId[] }[] = [];
  for (const { mode, pick } of inPlayPicksOf(cost)) {
    const ids = planInPlayPick(state, deps, sourceId, playerId, mode, pick, choices);
    if (isFault(ids)) return ids;
    picked.push({ pick, ids });
    // "Ready [a card] →" (`readyCards`, docs/phase7-wave8.md §3.54): an additional cost to ready a picked card is
    // paid with this cost or the cost is not paid (RRG 1.8 "Ready", p. 36; "Cost", p. 13).
    if (mode === "ready") requirement = withReadyCosts(state, deps, playerId, ids, requirement);
  }
  const inPlayIds = picked.flatMap((entry) => entry.ids);
  // RRG 1.8 "Cost" (p. 13): a cost's components are paid simultaneously, so one card can't pay two of them. It can't
  // be exhausted twice, exhausted and also returned, or picked here and also exhausted for a resource in the payment.
  const spentInPlay = [
    ...(cost.exhaustSelf ? [sourceId] : []),
    ...(cost.exhaustIdentity ? [identity.instanceId] : []),
    ...inPlayIds,
    // An attach cost's card, when it is in play (moved from one host to another), pays only that part (§3.49).
    ...(cost.attach
      ? (bindings[attachCardSlot(cost.attach)] ?? []).filter((id) => cardsInPlay(state).includes(id))
      : []),
  ];
  if (new Set(spentInPlay).size !== spentInPlay.length || inPlayIds.some((id) => reserved.has(id))) {
    return { code: "invalid_choice", message: "one card cannot pay two parts of a cost" };
  }
  for (const { pick, ids } of picked) bindInPlayPick(state, deps, pick, ids, bindings, vars);
  return { requirement, bindings, vars, payingFor, ...(selected ? { cost } : {}) };
}

/**
 * The card a counter cost (`AbilityCost.spendCounters`) removes its counters from: the ability's own card (no
 * `target`, or `"self"`), the paying player's identity (`"identity"`), or the one card in play a `TargetRef` names,
 * read with the payer as `you` and the ability's card as `self` ("Remove 1 power counter from Phoenix Force →",
 * docs/phase7-wave6.md §3.85). A ref naming no card in play, or several, is a fault: the cost cannot be paid in full
 * (RRG 1.8 "Cost", p. 13), and which of several cards to pay from is not a choice the cost offers.
 */
export function counterCostHolder(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  target: NonNullable<AbilityCost["spendCounters"]>["target"],
): InstanceId | PriceFault {
  if (target === undefined || target === "self") return sourceId;
  if (target === "identity") return mustPlayer(state, playerId).identity.instanceId;
  const named = givenCostRecipients(state, deps, sourceId, playerId, target);
  if (named.length === 1) return named[0]!;
  return named.length === 0
    ? { code: "no_valid_target", message: "no card in play to remove counters from" }
    : { code: "invalid_choice", message: `the counter cost names ${named.length} cards; it needs exactly one` };
}

/**
 * The cards a "give [the villain] a tough status card and 1 facedown boost card →" cost (`AbilityCost.giveStatus`,
 * `giveBoostCards`; Neocarbon Scales, `sm` 27150) gives to, read with the payer as `you` and the ability's card as
 * `self`: the ones in play.
 */
function givenCostRecipients(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  to: TargetRef,
): readonly InstanceId[] {
  const context: EffectContext = { selfInstanceId: sourceId, controllerId: playerId, event: null, bindings: {}, deps };
  const inPlay = cardsInPlay(state);
  return resolveRef(state, to, context).filter((id) => inPlay.includes(id));
}

/**
 * Whether the cost's `giveStatus` / `discardStatus` / `giveBoostCards` components can be paid in full (RRG 1.8 "Cost",
 * p. 13): someone in play to give them to (or discard from), every recipient able to hold another status card of that
 * type (RRG 1.8 "Status Cards", p. 41), every holder holding one to discard, and enough encounter cards, counting the
 * discard pile the deck is reshuffled from when it empties ("Encounter Deck", p. 17). Null when payable.
 */
function planGivenCards(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  cost: AbilityCost,
): PriceFault | null {
  if (cost.giveStatus) {
    const { status, to } = cost.giveStatus;
    const recipients = givenCostRecipients(state, deps, sourceId, playerId, to);
    if (recipients.length === 0)
      return { code: "no_valid_target", message: `nothing in play to give a ${status} card` };
    const full = recipients.find((id) => !canTakeStatus(state, id, status, deps));
    if (full) return { code: "no_valid_target", message: `${full} cannot be given another ${status} status card` };
  }
  // "Discard a tough status card from your hero →" (`discardStatus`, docs/phase7-wave6.md §3.6): each card named must
  // hold one to discard.
  if (cost.discardStatus) {
    const { status, from } = cost.discardStatus;
    const holders = givenCostRecipients(state, deps, sourceId, playerId, from);
    if (holders.length === 0)
      return { code: "no_valid_target", message: `nothing in play to discard a ${status} card from` };
    const bare = holders.find((id) => mustInstance(state, id).statuses[status] <= 0);
    if (bare) return { code: "no_valid_target", message: `${bare} has no ${status} status card to discard` };
  }
  if (cost.giveBoostCards) {
    const recipients = givenCostRecipients(state, deps, sourceId, playerId, cost.giveBoostCards.to);
    if (recipients.length === 0) return { code: "no_valid_target", message: "nothing in play to give a boost card" };
    const piles = encounterDeckOf(state, activeEncounterDeckId(state));
    const needed = cost.giveBoostCards.count * recipients.length;
    if (piles.deck.length + piles.discard.length < needed) {
      return { code: "card_not_in_zone", message: `the encounter deck cannot supply ${needed} boost card(s)` };
    }
  }
  return null;
}

function bindInPlayPick(
  state: GameState,
  deps: EngineDeps,
  pick: InPlayCostPick,
  picks: readonly InstanceId[],
  bindings: Record<string, readonly InstanceId[]>,
  vars: Record<string, number>,
): void {
  bindings[pick.slot] = picks;
  if (pick.bind) vars[pick.bind] = picks.length;
  // "… from an enemy → … that enemy" (`bindHosts`): what each pick is attached to now, before the cost moves it.
  if (pick.bindHosts) {
    const hosts = picks.flatMap((id) => getInstance(state, id)?.attachedTo ?? []);
    bindings[pick.bindHosts] = [...new Set(hosts)];
  }
  // "… add that ally's matching power" (`snapshotStats`): the picks' powers now, before the cost takes them from play.
  if (pick.snapshotStats) {
    for (const stat of ["thw", "atk", "def"] as const) {
      vars[`${pick.slot}.${stat}`] = picks.reduce((sum, id) => {
        const profile = characterProfile(state, id, deps);
        return sum + (!profile || (profile.missing as readonly string[]).includes(stat) ? 0 : profile[stat]);
      }, 0);
    }
  }
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
  mode: InPlayCostMode,
  pick: InPlayCostPick,
): readonly InstanceId[] {
  const candidates = eligibleForInPlayPick(state, deps, sourceId, playerId, pick).filter((id) =>
    canPayInPlayPick(state, deps, sourceId, id, mode, pick),
  );
  if (!pick.includesSelf) return candidates;
  // "This card and up to N others" (`InPlayCostPick.includesSelf`): no card can pay while this one cannot, and it is
  // listed first, so the smallest payment (`defaultInPlayPicks`) is the card itself.
  return candidates.includes(sourceId) ? [sourceId, ...candidates.filter((id) => id !== sourceId)] : [];
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
    if (pick.each) {
      // "Each support you control" (`InPlayCostPick.each`) is no pick: `planCost` takes the whole set itself and
      // reports why it cannot. Its cards are still kept out of the later picks.
      for (const id of candidates) taken.add(id);
      continue;
    }
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
  // "Discard a card tucked here →" (`TuckedCostPick`): the cards under the one card named, which the payer controls.
  const tucked = tuckedPickOf(pick);
  if (tucked) {
    const hosts = resolveRef(state, tucked.under, context);
    const [host] = hosts;
    if (hosts.length !== 1 || host === undefined || controllerOf(state, host) !== playerId) return [];
    return (getInstance(state, host)?.tucked ?? []).filter((id) => matchesQuery(state, id, pick.query, context));
  }
  // RRG 1.8 "Cost" (p. 14): costs are paid with cards the player controls, except for an alliance card, whose costs
  // any player may help pay (RRG 1.8 "Alliance", p. 6): "exhaust an [Avenger] character and a [Guardian] character"
  // may take another player's characters (docs/phase7-wave4.md §3.17).
  const group = paidAsGroup(state, deps, sourceId);
  const eligible = cardsInPlay(state).filter(
    (id) => (group || controllerOf(state, id) === playerId) && matchesQuery(state, id, pick.query, context),
  );
  // "The highest-cost upgrade you control" (`InPlayCostPick.superlative`): only the cards tied for it.
  const superlative = pick.superlative;
  if (!superlative || eligible.length === 0) return eligible;
  const measure = (id: InstanceId): number =>
    discardCombinedValue(state, id, { measure: superlative.measure, atLeast: 0 });
  const values = eligible.map(measure);
  const best = superlative.order === "highest" ? Math.max(...values) : Math.min(...values);
  return eligible.filter((_, index) => values[index] === best);
}

/**
 * Whether a card in play can pay an `InPlayCostPick` of this ability (`sourceId`): ready, to exhaust it; able to take
 * all of the damage, to deal it damage (`canTakeCostDamage`); able to leave play, to discard or return it. A cost is paid in full or not at all (RRG 1.8 "Cost", p. 13; "Initiating Abilities",
 * p. 24), so a card the payment could not move is no option: one that "cannot leave play", or a permanent card that the
 * source card's ability is not of its set (`permanentStopsLeaving`, RRG 1.8 "Permanent", p. 32; `payCost` pays with the
 * same source card; docs/phase7-wave5.md §4.1 Q46).
 */
function canPayInPlayPick(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  id: InstanceId,
  mode: InPlayCostMode,
  pick: InPlayCostPick,
): boolean {
  // A tucked card is out of play (RRG 1.8 "Tuck", p. 45): nothing that keeps a card in play keeps it tucked.
  if (tuckedPickOf(pick)) return true;
  const instance = mustInstance(state, id);
  if (mode === "exhaust") return !instance.exhausted;
  if (mode === "ready") return canPayReadyCost(state, deps, id, sourceId);
  if (mode === "damage") return canTakeCostDamage(state, deps, id, sourceId, (pick as DamageCostPick).amount);
  const sourceCardId = getInstance(state, sourceId)?.cardId;
  // "Cannot be discarded" (docs/phase7-wave8.md §3.35) stops the discard cost only; a return to hand is not one.
  if (cannotLeavePlay(state, deps, id, sourceCardId, mode === "discard")) return false;
  if (permanentStopsLeaving(state, deps, id, sourceCardId)) return false;
  // Returning goes to the owner's hand (RRG 1.8 "Ownership and Control", p. 30); a card with no owning player can't go there.
  return mode === "discard" || instance.ownerId !== null;
}

/** Checks an `InPlayCostPick` against the command's picks (or the forced pick) without paying anything. */
function planInPlayPick(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  mode: InPlayCostMode,
  pick: InPlayCostPick,
  choices: CostChoices,
): readonly InstanceId[] | PriceFault {
  const verb =
    mode === "exhaust"
      ? "exhaust"
      : mode === "ready"
        ? "ready"
        : mode === "discard"
          ? "discard"
          : mode === "damage"
            ? "deal damage to"
            : "return to hand";
  const eligible = eligibleForInPlayPick(state, deps, sourceId, playerId, pick);
  const candidates = eligible.filter((id) => canPayInPlayPick(state, deps, sourceId, id, mode, pick));
  const tucked = tuckedPickOf(pick) !== null;
  const whyNot = (id: InstanceId): PriceFault =>
    !eligible.includes(id)
      ? {
          code: "no_valid_target",
          message: tucked
            ? `${id} is not a card tucked there that can pay ${pick.slot}`
            : `${id} is not a card in play you control that can pay ${pick.slot}`,
        }
      : mode === "exhaust"
        ? { code: "already_exhausted", message: `${id} is already exhausted` }
        : mode === "ready"
          ? { code: "no_valid_target", message: `${id} is already ready, or cannot ready` }
          : mode === "damage"
            ? { code: "no_valid_target", message: `${id} cannot take all of this cost's damage` }
            : { code: "no_valid_target", message: `${id} cannot leave play` };
  if (pick.each) {
    // "Exhaust … each support you control →" (`InPlayCostPick.each`): every matching card, or the cost is not paid.
    const blocked = eligible.find((id) => !candidates.includes(id));
    if (blocked) return whyNot(blocked);
    if (eligible.length < pick.min)
      return { code: "no_valid_target", message: `not enough cards you control to ${verb} for this cost` };
    const named = choices[pick.slot];
    if (named && (named.length !== eligible.length || new Set(named).size !== named.length))
      return { code: "invalid_choice", message: `${pick.slot} takes each matching card you control` };
    const stray = named?.find((id) => !eligible.includes(id));
    return stray ? whyNot(stray) : eligible;
  }
  // "This card and up to N others" (`InPlayCostPick.includesSelf`): the card the text names pays, or nothing does.
  if (pick.includesSelf && !candidates.includes(sourceId)) return whyNot(sourceId);
  // RRG 1.8 "Initiating Abilities" (p. 24, steps 3 and 5): a cost that can't be paid in full can't be initiated.
  if (candidates.length < pick.min) {
    // Enough matching cards, but some are exhausted (or can't leave play): say that, rather than "no card".
    const blocked = eligible.find((id) => !candidates.includes(id));
    return blocked && eligible.length >= pick.min
      ? whyNot(blocked)
      : {
          code: "no_valid_target",
          message: tucked
            ? `not enough tucked cards to ${verb} for this cost`
            : `not enough cards you control to ${verb} for this cost`,
        };
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
  if (pick.includesSelf && !picks.includes(sourceId))
    return { code: "invalid_choice", message: `${pick.slot} must include the card whose cost this is` };
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

/**
 * The size of a chosen-size resource cost as this payment makes it (`ResourcesChoice`; docs/phase7-wave8.md §3.62).
 * `named` is the size the command gave beside the payment (`CostSelection.resources`): a number in the cost's range
 * that the payment covers. Unnamed, the size is every resource generated beyond the rest of the requirement, up to
 * the cost's `max`. Null for any other cost.
 *
 * Overpaying is legal, as for any cost (owner decision, 2026-10-08, §4.1 row 78, applying RRG 1.8 "Cost", p. 13:
 * "While paying a cost, a player is permitted to generate resources beyond the specified cost. Resources generated
 * beyond the specified cost are considered to have been overpaid for that cost and were not paid for that cost."):
 * what is generated beyond the size is overpaid, and §4.1 Q34 = A decides which resources are the paid ones.
 */
function chosenResourceCount(
  pool: ResourcePool,
  cost: AbilityCost | undefined,
  requirement: ResolvedRequirement,
  named: number | undefined,
): number | PriceFault | null {
  const choice = resourcesChoiceOf(cost);
  if (!choice) return null;
  const size = poolTotal(pool) - requirementTotal(requirement);
  const plural = (n: number): string => `${n} resource${n === 1 ? "" : "s"}`;
  if (named !== undefined && (!Number.isInteger(named) || named < choice.min || named > choice.max)) {
    return { code: "invalid_choice", message: `choose to spend from ${choice.min} to ${plural(choice.max)}` };
  }
  // RRG 1.8 "Cost" (p. 14): "up to" needs at least one, so too little is a cost not paid (p. 13).
  if (size < choice.min) {
    return { code: "insufficient_resources", message: `spend at least ${plural(choice.min)}; the payment is ${size}` };
  }
  if (named !== undefined && named > size) {
    return { code: "insufficient_resources", message: `chose to spend ${plural(named)}; the payment is ${size}` };
  }
  return named ?? Math.min(size, choice.max);
}

/**
 * The `paid.*` and `overpaid.*` vars of a payment. "Spend X [type] resources": binds X from the pool beyond the cost's
 * fixed requirement. A chosen-size cost (`ResourcesChoice`) is checked and recorded here (`chosenResourceCount`), with
 * `chosenResources` the size the command named, if it named one.
 */
export function resourceVars(
  pool: ResourcePool,
  cost: AbilityCost | undefined,
  requirement: ResolvedRequirement,
  chosenResources?: number,
): Vars | PriceFault {
  const chosen = chosenResourceCount(pool, cost, requirement, chosenResources);
  if (chosen !== null && typeof chosen !== "number") return chosen;
  const vars: Record<string, number> = {
    "paid.physical": pool.physical,
    "paid.mental": pool.mental,
    "paid.energy": pool.energy,
    "paid.wild": pool.wild,
    "paid.total": poolTotal(pool),
    // Against a cost the player sizes, the size chosen was paid and the rest of the pool overpaid.
    ...overpaidVars(pool, chosen === null ? requirement : { ...requirement, generic: requirement.generic + chosen }),
  };
  if (chosen !== null) vars["cost.resources"] = chosen;
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
    const count = requirementTotal(requirementOf(fixedResourcesOf(cost)));
    if (!payableWithOneType(pool, count, requirement)) {
      return { code: "insufficient_resources", message: `spend ${count} resources of the same type` };
    }
  }
  if (cost?.distinctResourceTypes !== undefined) {
    if (distinctTypeCount(pool) < cost.distinctResourceTypes) {
      return {
        code: "insufficient_resources",
        message: `spend ${cost.distinctResourceTypes} resources of different types`,
      };
    }
  }
  // The number of resources the cost took (docs/phase7-wave8.md §3.62): the requirement after every reduction, with a
  // "spend X resources" cost's X. `paid.total` less this is `overpaid.total`: those "were not paid for that cost" (RRG
  // 1.8 "Cost", p. 13), so a cost of 3 reads at most three types (§4.1 Q34 = A) and a cost of 0 none.
  vars["paid.count"] = requirementTotal(paidRequirementOf(pool, requirement, cost, vars));
  return vars;
}

/** A "take N damage →" cost's amount: printed, or the value `planCost` read into var `cost.damageSelf`. */
function costDamageSelf(cost: AbilityCost, vars: Readonly<Record<string, number>>): number {
  if (cost.damageSelf === undefined || isDamageSelfChoice(cost.damageSelf)) return 0;
  return typeof cost.damageSelf === "number" ? cost.damageSelf : (vars["cost.damageSelf"] ?? 0);
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
  /**
   * Where a counter cost's `countersRemoved` (or `countersPlaced`, §3.53) announcement goes instead of the stack: a
   * resource ability paid before the frame it pays for is pushed (`payPayment`), announced later by
   * `announceResourcesSpent`.
   */
  collectCounterEvents?: TriggerEvent[],
  /**
   * Where a `removeThreat` cost's steps go instead of the stack, for the same reason: a resource ability's threat
   * cost (`SpentPayment.threatCosts`), pushed by `announceResourcesSpent` above the card or ability paid for.
   */
  collectThreatCosts?: ResourceThreatCost[],
): void {
  const cost = plan.cost ?? written;
  if (!cost) return;
  // The frame this cost pays for, which callers push just before paying (read before any payment pushes its own).
  const top = ctx.state.stack[0];
  const paidFor = (top?.kind === "ability" || top?.kind === "playCard") && top.instanceId === sourceId ? top : null;
  const identityId = mustPlayer(ctx.state, playerId).identity.instanceId;
  if (cost.exhaustSelf) exhaustCard(ctx, sourceId);
  // "Flip this card →": announced above the frame being paid for, as any flip is (docs/phase7-wave7.md §3.64).
  if (cost.flipSelf) {
    turnToFlipSide(ctx, sourceId);
    pushEvents(ctx, [cardFlippedEvent(sourceId, playerId)]);
    checkRestrictedAfterFlip(ctx, sourceId);
  }
  if (cost.spendCounters) {
    // Checked payable by `planCost`, so the holder is a card (never a fault) here.
    const holderId = counterCostHolder(ctx.state, ctx.deps, sourceId, playerId, cost.spendCounters.target);
    if (typeof holderId !== "string") throw new EngineInvariantError(`counter cost unpaid: ${holderId.message}`);
    const { counterType, amount } = cost.spendCounters;
    const held = mustInstance(ctx.state, holderId).counters[counterType] ?? 0;
    const removed = removeCounters(ctx, holderId, counterType, amount);
    // Announced (response only) above the frame being paid for, so "after the last power counter is removed from
    // here" (Phoenix Force, wave 6 §3.85, §4.1 Q24) resolves before the ability's effects; pushed only when heard.
    const event: TriggerEvent = {
      kind: "countersRemoved",
      instanceId: holderId,
      counterType,
      amount: removed,
      remaining: held - removed,
      paidAsCost: true,
    };
    if (removed > 0 && heard(ctx.state, ctx.deps, event)) {
      if (collectCounterEvents) collectCounterEvents.push(event);
      else pushEvents(ctx, [event]);
    }
  }
  // "Place 1 charge counter on Gambit →" (docs/phase7-wave6.md §3.53): always payable; announced like a counter cost's
  // removal, above the frame being paid for, so its responses resolve before the effects that may count the counter.
  if (cost.placeCounters) {
    const { counterType, amount, target } = cost.placeCounters;
    const holderId = target === "identity" ? identityId : sourceId;
    addCounters(ctx, holderId, counterType, amount);
    const event: TriggerEvent = {
      kind: "countersPlaced",
      targetInstanceId: holderId,
      counterType,
      amount,
      playerId,
      paidAsCost: true,
    };
    if (amount > 0 && heard(ctx.state, ctx.deps, event)) {
      if (collectCounterEvents) collectCounterEvents.push(event);
      else pushEvents(ctx, [event]);
    }
  }
  if (cost.exhaustIdentity) exhaustCard(ctx, identityId);
  if (cost.healIdentity) healDamage(ctx, identityId, cost.healIdentity, sourceId);
  // "Deal yourself 1 facedown encounter card →" (docs/phase7-wave3.md §3.20). A cost is paid in one piece: should one
  // of several cards dealt here reset the encounter deck, the response to the reset follows the whole payment (no
  // card in the pool deals more than one this way; docs/phase7-wave6.md §4.1 Q58).
  for (let i = 0; i < (cost.dealEncounterCards ?? 0); i++) dealEncounterCardTo(ctx, playerId, "ability");
  for (const id of plan.bindings.discard ?? []) {
    const zone = locateCard(ctx.state, id);
    discardFromHand(ctx, zone?.kind === "hand" ? zone.playerId : playerId, id);
  }
  if (isDeckDiscardChoice(cost.discardFromDeck)) {
    // "Discard up to 3 cards from the top of your deck →" (`deck-discard-choice-cost.ts`, docs/phase7-wave8.md §3.55):
    // the payer picks from the planned range and the cards are discarded in a step above the frame being paid for,
    // which gets their count as `cost.discardFromDeck`.
    pushEffects(ctx, {
      effects: chosenDeckDiscardEffects(
        plan.vars[DECK_DISCARD_MIN_VAR] ?? 0,
        plan.vars[DECK_DISCARD_MAX_VAR] ?? 0,
        cost.discardFromDeckSlot,
        paidFor,
      ),
      selfInstanceId: sourceId,
      controllerId: playerId,
    });
  } else if (cost.discardFromDeck !== undefined) {
    const count = deckDiscardCount(ctx.state, ctx.deps, sourceId, playerId, cost.discardFromDeck);
    // "… add each SP//dr card discarded this way to your hand" (`discardFromDeckSlot`): bound on the frame being paid for.
    // That slot is what a response to one of these discards takes its card out of (docs/phase7-wave7.md §4.1 Q32).
    const slot = cost.discardFromDeckSlot;
    const boundOn = slot !== undefined && paidFor ? { frameId: paidFor.frameId, slot } : undefined;
    const by = { sourceInstanceId: sourceId, ...(boundOn ? { boundOn } : {}) };
    const discarded = count > 0 ? discardFromDeckAsCost(ctx, playerId, count, by) : [];
    if (slot !== undefined) addFrameSlots(ctx, paidFor?.frameId, { [slot]: discarded });
  }
  // "Look at the top 2 cards of the encounter deck. Discard 1 of those cards →" (`encounter-look-cost.ts`, docs/phase7-
  // wave6.md §3.54): the look and the payer's pick are a step above the frame being paid for, so they resolve first.
  if (cost.encounterLookDiscard) {
    pushEffects(ctx, {
      effects: encounterLookDiscardEffects(cost.encounterLookDiscard, paidFor),
      selfInstanceId: sourceId,
      controllerId: playerId,
    });
  }
  // After the payment and the chosen discards have left the hand, so the random pick is among what remains.
  if (cost.discardRandomFromHand) {
    const filter = cost.discardRandomFromHandFilter;
    const context: EffectContext = {
      selfInstanceId: sourceId,
      controllerId: playerId,
      event: null,
      bindings: {},
      deps: ctx.deps,
    };
    const excluded = filter
      ? mustPlayer(ctx.state, playerId).hand.filter((id) => !matchesQuery(ctx.state, id, filter, context))
      : [];
    discardRandomFromHand(ctx, playerId, cost.discardRandomFromHand, [sourceId, ...excluded]);
  }
  // "Take 1 damage →" (`damageSelf`, `cost-damage.ts`): dealt above the frame being paid for, so it resolves first; if
  // not all of it is taken, that frame's effects don't (RRG 1.8 "Cost", p. 14).
  const damageSelf = costDamageSelf(cost, plan.vars);
  if (damageSelf > 0) {
    pushEffects(ctx, {
      effects: selfCostDamageEffects(damageSelf, paidFor),
      selfInstanceId: sourceId,
      controllerId: playerId,
    });
  }
  // "Take any amount of damage up to … →" (docs/phase7-wave7.md §3.79): the payer picks from the planned range, takes
  // it, and the pick is recorded on the frame being paid for as `cost.damageSelf`.
  if (isDamageSelfChoice(cost.damageSelf)) {
    pushEffects(ctx, {
      effects: chosenSelfCostDamageEffects(
        plan.vars[DAMAGE_SELF_MIN_VAR] ?? 0,
        plan.vars[DAMAGE_SELF_MAX_VAR] ?? 0,
        paidFor,
      ),
      selfInstanceId: sourceId,
      controllerId: playerId,
    });
  }
  // "Remove up to 3 threat from here →" (docs/phase7-wave9.md §3.7 (b)): the payer picks from the planned range, the
  // threat comes off, and the amount removed is recorded on the frame being paid for as `cost.removeThreat`.
  const threatFrom = cost.removeThreat ? plan.bindings[REMOVE_THREAT_FROM_SLOT]?.[0] : undefined;
  if (threatFrom && collectThreatCosts) {
    collectThreatCosts.push({
      instanceId: sourceId,
      spender: playerId,
      fromId: threatFrom,
      amount: plan.vars[REMOVE_THREAT_MAX_VAR] ?? 0,
    });
  } else if (threatFrom) {
    pushEffects(ctx, {
      effects: removeThreatCostEffects(
        {
          fromId: threatFrom,
          min: plan.vars[REMOVE_THREAT_MIN_VAR] ?? 0,
          max: plan.vars[REMOVE_THREAT_MAX_VAR] ?? 0,
        },
        paidFor,
      ),
      selfInstanceId: sourceId,
      controllerId: playerId,
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
  // "Give the villain a tough status card and 1 facedown boost card →" (`giveStatus`, `giveBoostCards`), checked
  // payable by `planCost`.
  if (cost.giveStatus) {
    for (const id of givenCostRecipients(ctx.state, ctx.deps, sourceId, playerId, cost.giveStatus.to))
      giveStatus(ctx, id, cost.giveStatus.status, { sourceInstanceId: sourceId, playerId });
  }
  // "Discard a tough status card from your hero →" (`discardStatus`, checked payable by `planCost`): one card from each,
  // announced (§3.5) above the ability's own frame, so those responses resolve before its effects (RRG 1.8 "Cost Arrow
  // Icon", p. 14).
  if (cost.discardStatus) {
    const { status, from } = cost.discardStatus;
    announceStatusDiscarded(
      ctx,
      givenCostRecipients(ctx.state, ctx.deps, sourceId, playerId, from).flatMap((id) =>
        discardStatusCards(ctx, id, status, "cost", mustInstance(ctx.state, id).statuses[status] - 1),
      ),
    );
  }
  if (cost.giveBoostCards) {
    for (const id of givenCostRecipients(ctx.state, ctx.deps, sourceId, playerId, cost.giveBoostCards.to))
      for (let i = 0; i < cost.giveBoostCards.count; i++) dealBoostCard(ctx, id, true);
  }
  // "Find Touched and attach it to a character other than Rogue and deal 2 damage to that character →" (`attach-cost.ts`,
  // docs/phase7-wave6.md §3.49): attached now, then the damage dealt above the frame being paid for.
  if (cost.attach) payAttachCost(ctx, sourceId, playerId, cost.attach, plan.bindings);
  if (cost.dealDamage) payDealDamageCost(ctx, sourceId, playerId, cost.dealDamage, plan.bindings);
  // "Take 3 indirect damage →" (`indirectDamage`, `cost-damage.ts`): assigned and dealt above the ability's own frame,
  // which the caller has just pushed, so it resolves first; if not all of it is taken, that frame's effects don't.
  if (cost.indirectDamage) {
    pushEffects(ctx, {
      effects: costDamageEffects(cost.indirectDamage, paidFor),
      selfInstanceId: sourceId,
      controllerId: playerId,
    });
  }
  // "Attached villain attacks you →" (`enemyAttack`, `enemy-attack-cost.ts`): the attack resolves in full above the
  // frame being paid for; one that is not made leaves the cost unpaid, and that frame's effects don't resolve. Read
  // before a `discardSelf` in the same cost moves the card the enemy is named from.
  if (cost.enemyAttack) {
    const enemyId = enemyAttackCostEnemy(ctx.state, ctx.deps, sourceId, playerId, cost.enemyAttack, plan.bindings);
    if (enemyId === null) throw new EngineInvariantError("enemy attack cost unpaid: no enemy");
    pushEffects(ctx, { ...enemyAttackCostEffects(enemyId, paidFor), selfInstanceId: sourceId, controllerId: playerId });
  }
  // "Resolve its 'Forced Response' as if it just attacked you →" (`resolveAbility`, `resolve-ability-cost.ts`): the
  // abilities resolve in full above the frame being paid for; none resolved leaves the cost unpaid, and that frame's
  // effects don't resolve. Read, and judged able to change the game, before a `discardSelf` in the same cost moves the
  // card the other is named from.
  if (cost.resolveAbility) {
    const ofId = resolveAbilityCostCard(ctx.state, ctx.deps, sourceId, playerId, cost.resolveAbility, plan.bindings);
    if (ofId === null) throw new EngineInvariantError("resolve-ability cost unpaid: no card");
    const wouldChange = resolvingWouldChange(ctx.state, ctx.deps, sourceId, playerId, ofId, cost.resolveAbility);
    pushEffects(ctx, {
      ...resolveAbilityCostEffects(ofId, cost.resolveAbility, wouldChange, paidFor),
      selfInstanceId: sourceId,
      controllerId: playerId,
    });
  }
  // A cost is part of its card's ability, so the Permanent keyword's same-set exception reads that card (§4.1 Q46).
  // It is not that ability's effect (RRG 1.8 "Cost", p. 13), so each move below says so (`leaveCauseSide`).
  const source = getInstance(ctx.state, sourceId)?.cardId;
  if (cost.discardSelf && getInstance(ctx.state, sourceId)) discardFromPlay(ctx, sourceId, source, true);
  for (const { mode, pick } of inPlayPicksOf(cost)) {
    const ids = plan.bindings[pick.slot] ?? [];
    if (mode === "exhaust") {
      for (const id of ids) exhaustCard(ctx, id);
    } else if (mode === "ready") {
      // "Ready your sidekick →" (`readyCards`, `ready-cards-cost.ts`): readied above the ability's own frame, so it
      // resolves first; a picked card that is not ready afterward leaves that frame's effects unresolved.
      if (ids.length > 0) {
        pushEffects(ctx, {
          effects: readyCardsCostEffects(pick.slot, paidFor),
          selfInstanceId: sourceId,
          controllerId: playerId,
          bindings: { [pick.slot]: ids },
        });
      }
    } else if (mode === "damage") {
      // "Deal 1 damage to a [Web-Warrior] character you control →" (`damageCards`, `cost-damage.ts`): dealt above the
      // ability's own frame, so it resolves first; if not all of it is taken, that frame's effects don't.
      if (ids.length > 0) {
        pushEffects(ctx, {
          effects: pickedCostDamageEffects(pick.slot, ids.length, (pick as DamageCostPick).amount, paidFor),
          selfInstanceId: sourceId,
          controllerId: playerId,
          bindings: { [pick.slot]: ids },
        });
      }
    } else if (tuckedPickOf(pick)) {
      // "Discard a card tucked here →" (`TuckedCostPick`): the move an effect's discard of a tucked card makes
      // (`EffectSpec moveCards` to "discard"), from this ability's card, so both are heard alike (§4.1 Q7).
      moveCardsTo(ctx, ids, "discard", undefined, source, { sourceInstanceId: sourceId }, true);
    } else if (mode === "discard") {
      for (const id of ids) if (getInstance(ctx.state, id)) discardFromPlay(ctx, id, source, true);
    } else {
      moveCardsTo(ctx, ids, "hand", undefined, source, undefined, true);
    }
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

/** The play frame's record of the one Action ability a played event resolves (`pushPlayCardFrame`). */
const triggeredAction = (chosen: EventAction | undefined) =>
  chosen ? { triggeredAbilityId: chosen.abilityId, event: null, eventFrameId: null } : undefined;

/**
 * Why a labeled-thwart interrupt (Psychic Manipulation) could not be used right now even in its window: the main scheme
 * cannot be thwarted (a crisis icon, an engaged patrol minion; RRG 1.8 "Crisis" p. 14, "Patrol" p. 32, "Target" p. 43).
 * Appended to the "only played from its window" message so Inspect says why the card is not offered while its trigger
 * would otherwise be met (QA playthrough B, QB-10). Empty when nothing blocks it.
 */
function thwartBlockNote(ctx: Ctx, card: AnyCard, playerId: PlayerId): string {
  const labeled = printedAbilityRefs(card).some((ref) => ctx.deps.abilities[ref.id]?.label?.includes("thwart"));
  if (!labeled) return "";
  const identity = getPlayer(ctx.state, playerId)?.identity.instanceId;
  if (!identity) return "";
  const why = thwartBlockedOn(
    ctx.state,
    ctx.deps,
    { thwarterInstanceId: identity, playerId },
    ctx.state.mainScheme.instanceId,
  );
  if (why === "crisis")
    return ". Right now it could not be used anyway: it is a thwart, and a crisis icon is in play, so you can't thwart the main scheme";
  if (why === "patrol")
    return ". Right now it could not be used anyway: it is a thwart, and an engaged patrol minion keeps you from thwarting the main scheme";
  if (why === "rule")
    return ". Right now it could not be used anyway: it is a thwart, and a rule keeps you from thwarting the main scheme";
  return "";
}

/** One of an event's printed Action abilities: playing the event triggers exactly one of them. */
export interface EventAction {
  readonly abilityId: AbilityId;
  readonly definition: AbilityDefinition;
}

/** Every Action ability printed on an event, in printed order; empty for any other card. */
export function eventActions(ctx: Ctx, card: AnyCard): readonly EventAction[] {
  if (card.type !== "event") return [];
  return printedAbilityRefs(card).flatMap((ref) => {
    const definition = ctx.deps.abilities[ref.id];
    return definition?.trigger.kind === "action" ? [{ abilityId: ref.id, definition }] : [];
  });
}

/** Whether playing this card is an Action (an event with at least one Action ability). */
export const isActionEvent = (ctx: Ctx, card: AnyCard): boolean => eventActions(ctx, card).length > 0;

/**
 * Why `playerId` could not trigger this Action ability of an event by playing it now, or null: the play restrictions
 * of RRG 1.8 "Initiating Abilities" (p. 24) step 2, which are the ability's form, its condition (`trigger.while`) and a
 * valid target. The cost is step 3 and is judged by the caller against the payment.
 */
function eventActionFault(
  ctx: Ctx,
  action: EventAction,
  id: InstanceId,
  playerId: PlayerId,
): (PriceFault & { readonly note: string }) | null {
  const trigger = action.definition.trigger;
  const form = trigger.kind === "action" ? trigger.form : undefined;
  if (form && getPlayer(ctx.state, playerId)?.identity.form !== form)
    return { code: "wrong_form", message: `this event requires ${form} form`, note: "wrong form" };
  if (actionConditionUnmet(ctx.state, ctx.deps, action.definition, id, playerId))
    return { code: "no_valid_target", message: "this event's condition is not met", note: "its condition is not met" };
  // RRG 1.8 "Target" (pp. 42–43): no valid target, no play (the main scheme, for a "(thwart)" while patrolled; §3.5).
  const fault = abilityTargetFault(ctx.state, ctx.deps, action.definition, id, playerId);
  if (fault === "moveSource")
    return { code: "no_valid_target", message: TARGET_FAULT_MESSAGE.moveSource, note: "it has no threat to move" };
  if (fault !== null)
    return { code: "no_valid_target", message: "this event has no valid target", note: "it has no valid target" };
  return null;
}

/**
 * The Action abilities of an event that `playerId` could trigger by playing it now, costs aside (`eventActionFault`).
 *
 * RRG 1.8 "Event" (p. 18): "If an event has more than one triggered ability on it, the player playing it chooses one
 * of those abilities to trigger when playing that event." So an event is playable when at least one of its abilities
 * is, and only the chosen one is paid for and resolves. With one usable ability there is nothing to choose.
 */
export function usableEventActions(
  ctx: Ctx,
  card: AnyCard,
  id: InstanceId,
  playerId: PlayerId,
): readonly EventAction[] {
  return eventActions(ctx, card).filter((action) => eventActionFault(ctx, action, id, playerId) === null);
}

/**
 * The Action ability a play of this event triggers (RRG 1.8 "Event", p. 18): the one the player named, else the only
 * one usable now. Undefined for a card with no Action ability. A fault when the named one, or every one, cannot be
 * triggered, and when several could be and none is named: the choice is the player's and is never made for them.
 *
 * The choice is made here, before the cost is determined: RRG 1.8 "Initiating Abilities" (p. 24) checks the play
 * restrictions of what is being initiated at step 2 and determines its cost at step 3, and each ability has its own
 * restrictions and its own cost, so which ability is being triggered is part of declaring the play.
 */
export function eventActionToPlay(
  ctx: Ctx,
  card: AnyCard,
  id: InstanceId,
  playerId: PlayerId,
  named?: AbilityId,
): EventAction | PriceFault | undefined {
  const actions = eventActions(ctx, card);
  if (named !== undefined) {
    const action = actions.find((candidate) => candidate.abilityId === named);
    if (!action) return { code: "invalid_choice", message: `${named} is not an Action ability of that card` };
    return eventActionFault(ctx, action, id, playerId) ?? action;
  }
  const [first] = actions;
  if (!first) return undefined;
  const usable = actions.filter((action) => eventActionFault(ctx, action, id, playerId) === null);
  if (usable.length > 1)
    return {
      code: "invalid_choice",
      message: "this event has more than one ability you could trigger: choose one (abilityId)",
    };
  return usable[0] ?? eventActionFault(ctx, first, id, playerId) ?? first;
}

/**
 * The event action a listing or a payment query is about (`legalActions`, `paymentFor`): the named one, else the first
 * usable one, else the first printed. `named` says whether the command must carry its id, which is whenever the event
 * prints more than one Action ability, so a single-ability event's command stays as it always was.
 */
export function eventActionForQuery(
  ctx: Ctx,
  card: AnyCard,
  id: InstanceId,
  playerId: PlayerId,
  abilityId?: AbilityId,
): { readonly action: EventAction | undefined; readonly named: boolean } {
  const actions = eventActions(ctx, card);
  const action =
    actions.find((candidate) => candidate.abilityId === abilityId) ??
    usableEventActions(ctx, card, id, playerId)[0] ??
    actions[0];
  return { action, named: actions.length > 1 };
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
  /**
   * The in-play scenario area the play would go to (`LegalAction.destinations`): the price there, with any reduction
   * that reads the destination ("the next ally played to the mission", docs/phase7-wave8.md §3.35). Null or absent:
   * the play to the player's own area.
   */
  into: string | null = null,
): PlayCost | null {
  const card = cardOf(state, cardInstanceId);
  if (!card || !("cost" in card) || typeof card.cost !== "number") return null;
  const modifiers = playCostContributions(state, deps, playerId, cardInstanceId, attachTo);
  const printed = printedCostOf(state, card);
  const modified = Math.max(0, printed + modifiers.reduce((total, entry) => total + entry.delta, 0));
  const reduction =
    costReductionFor(state, deps, playerId, cardInstanceId) +
    Math.max(0, areaCostReductionFor(state, deps, playerId, cardInstanceId, into));
  // The top card of the deck under `playableTopOfDeck` (docs/phase7-wave8.md §3.49): what playing it from there costs,
  // with the permission's card listed last as the source of its reduction. Applied where the play's own reductions
  // are (`ownPlayCost`'s `extraReduction`), after the modifiers.
  const deckTop = deckTopPlayOf(state, deps, playerId, cardInstanceId);
  const offTheTop = deckTop?.costReduction ?? 0;
  const contributions =
    deckTop && offTheTop > 0
      ? [...modifiers, { sourceInstanceId: deckTop.sourceInstanceId, delta: -offTheTop }]
      : modifiers;
  return { printed, current: Math.max(0, modified - reduction - offTheTop), contributions, reduction };
}

export interface PricedPlay {
  readonly pool: ResourcePool;
  readonly plan: CostPlan;
  readonly vars: Vars;
  /** Present only when the payment is read for resource types (`settlePaidTypes`; docs/phase7-wave8.md §3.62). */
  readonly types?: PaidTypesSettled;
}

/**
 * How a payment that is read for resource types stands once priced (docs/phase7-wave8.md §3.62). `paidCount`: the
 * resources the cost took. Then either the wilds are declared (`declared`, with the paid resources by type in
 * `paidAs`, already in the play's vars as `paid.as.<type>`), or they are the player's to declare (`undeclared`), which
 * the play frame asks before the card does anything.
 */
export interface PaidTypesSettled {
  readonly paidCount: number;
  readonly declared?: {
    readonly types: readonly ResourceType[];
    /** The player was not asked: every legal declaration read the same (`wildTypesDeclared.skipped`). */
    readonly skipped: boolean;
    readonly paidAs: ResourcePool;
  };
  readonly undeclared?: UndeclaredWilds;
}

/** What a play command or a play inside a window or an effect says about the types of its payment (`pricePlay`). */
export interface PaidTypesInput {
  /** The ability of the card the play triggers, whose `readsPaidTypes` is read; absent, every ability printed on it. */
  readonly abilityId?: AbilityId | null;
  /** The player's declaration of the payment's wilds, when the command carries it (`playCard.wildAs`). */
  readonly wildAs?: readonly ResourceType[] | undefined;
}

/**
 * Everything that reads the resource types of `playerId`'s payment for `cardInstanceId` (docs/phase7-wave8.md §3.62):
 * the ability the play triggers when it is marked `readsPaidTypes` (every printed ability of a card that names none),
 * and each `readsPaymentTypesOf` rule in force whose speaker is the paying player and whose `cards` match the card
 * ("After you play a THWART event …", Jubilee's Coat). Empty for every other payment, which then asks nothing and
 * records no types.
 */
export function paidTypeReads(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  cardInstanceId: InstanceId,
  abilityId: AbilityId | null | undefined = null,
): readonly PaidTypesRead[] {
  const card = cardOf(state, cardInstanceId);
  const own = abilityId ? [abilityId] : card ? printedAbilityRefs(card).map((ref) => ref.id) : [];
  const reads: PaidTypesRead[] = own.flatMap((id) => deps.abilities[id]?.readsPaidTypes ?? []);
  for (const active of activeRules(state, deps, "readsPaymentTypesOf")) {
    if (active.speakerId !== playerId) continue;
    if (!matchesQuery(state, cardInstanceId, active.rule.cards, active.context)) continue;
    reads.push(active.rule.reads ?? { count: true });
  }
  return reads;
}

/**
 * Settles the declared types of a priced payment (docs/phase7-wave8.md §3.62; §4.1 Q33 = B, Q34 = A and its
 * follow-up). RRG 1.8 "Wild Resource" (p. 48): "When a player generates a wild resource, they may specify which
 * resource type (energy, mental, physical, or wild) it is being used as"; ruling January 17, 2026 - Ruling 4 (1): "you
 * specify which resource type it represents, even when overpaying a cost".
 *
 * - **A declaration given** (`wildAs`) must be legal whatever reads it (`wildDeclarationFault`): one type per wild
 *   generated, and the payment still pays the cost with each wild used as declared.
 * - **Nothing reads the types** (`reads` empty): nothing more is recorded and nobody is asked. This is every payment
 *   that existed before this section.
 * - **Read, and declared on the command:** the paid resources are the `paidRequirement` resources that give the most
 *   declared types (`paidAsDeclared`), recorded as `paid.as.<type>`.
 * - **Read, not declared:** the player is asked, except in the one case the owner allowed: every legal declaration
 *   gives every reader the same reading (`readOfPaidTypes`). That is so with no wild, at a cost of 0, when one wild
 *   pays alone for a card that only counts, and when the typed resources already fill everything a reader can read. It
 *   is not so merely because one declaration is plainly best: the engine never declares for the player. A skipped wild
 *   stays a wild where that is legal (a wild a typed slot needs is the type of that slot).
 * - **Several sets of resources can be the paid ones** (more generated than the cost took, and as many types either
 *   way; `paidSetsAsDeclared`). Owner decision, 2026-10-08 (§4.1 row 79; no official source says which resources are
 *   the overpaid ones, RRG 1.8 "Cost", p. 13): when the sets read differently to a reader, the player says which was
 *   paid (`choosePaidResources`, asked by the frame paid for, after any wild declaration); when they all read the
 *   same, the first is taken and nobody is asked. So "every legal declaration reads the same" above compares what
 *   each declaration lets the player reach: the readings of all its sets.
 */
function settlePaidTypes(
  pool: ResourcePool,
  vars: Vars,
  paidRequirement: ResolvedRequirement,
  only: readonly TypedResource[],
  reads: readonly PaidTypesRead[],
  wildAs: readonly ResourceType[] | undefined,
): { readonly vars: Vars; readonly types?: PaidTypesSettled } | PriceFault {
  if (wildAs !== undefined) {
    const fault = wildDeclarationFault(pool, wildAs, paidRequirement, only);
    if (fault) return { code: "invalid_choice", message: fault };
  }
  if (reads.length === 0) return { vars };
  const paidCount = requirementTotal(paidRequirement);
  // Every set of resources that can be the paid ones under a declaration (`paidSetsAsDeclared`), and what the readers
  // read of each: one reading is a payment settled; several are the player's to choose between.
  const setsOf = (types: readonly ResourceType[]): readonly ResourcePool[] =>
    wildDeclarationFault(pool, types, paidRequirement, only) === null
      ? paidSetsAsDeclared(declaredPool(pool, types), paidRequirement)
      : [];
  const readings = (sets: readonly ResourcePool[]): readonly string[] =>
    [...new Set(sets.map((paidAs) => paidTypesReading(paidAs, reads)))].sort();
  const settled = (types: readonly ResourceType[], paidAs: ResourcePool, skipped: boolean) => ({
    vars: { ...vars, ...paidAsVars(paidAs) },
    types: { paidCount, declared: { types, skipped, paidAs } },
  });
  const asked = (declared?: { readonly types: readonly ResourceType[]; readonly skipped: boolean }) => ({
    vars,
    types: {
      paidCount,
      undeclared: {
        pool,
        requirement: paidRequirement,
        ...(only.length > 0 ? { only } : {}),
        reads,
        ...(declared ? { declared } : {}),
      },
    },
  });
  // The wilds are settled as `types`: the paid set too when every candidate reads the same, else it is asked.
  const withWilds = (types: readonly ResourceType[], sets: readonly ResourcePool[], skipped: boolean) => {
    const [paidAs] = sets;
    return paidAs && readings(sets).length === 1 ? settled(types, paidAs, skipped) : asked({ types, skipped });
  };
  if (wildAs !== undefined) {
    const sets = setsOf(wildAs);
    if (sets.length > 0) return withWilds(wildAs, sets, false);
  }
  const legal = wildDeclarations(pool.wild).flatMap((types) => {
    const sets = setsOf(types);
    return sets.length > 0 ? [{ types, sets }] : [];
  });
  const [first] = legal;
  const same = (a: readonly string[], b: readonly string[]): boolean => a.join("/") === b.join("/");
  if (first && legal.every((entry) => same(readings(entry.sets), readings(first.sets)))) {
    return withWilds(first.types, first.sets, true);
  }
  return asked();
}

/**
 * Settles the declared types of an ability's own payment (docs/phase7-wave8.md §3.62): a `useAbility` command, or an
 * interrupt or response paid for inside a window. The reader is the ability itself when it is marked `readsPaidTypes`
 * ("spend up to 3 resources → if you spent at least 1 [energy] …"). A `readsPaymentTypesOf` rule is about a card
 * being played, so it reads no ability's payment. An unmarked ability records nothing and asks nothing, which is every
 * ability payment that existed before this section; `wildAs` must still be legal when given (`settlePaidTypes`).
 */
export function settleAbilityPaidTypes(
  ctx: Ctx,
  definition: AbilityDefinition,
  payingFor: InstanceId,
  pool: ResourcePool,
  vars: Vars,
  requirement: ResolvedRequirement,
  cost: AbilityCost | undefined,
  wildAs?: readonly ResourceType[],
): { readonly vars: Vars; readonly types?: PaidTypesSettled } | PriceFault {
  return settlePaidTypes(
    pool,
    vars,
    paidRequirementOf(pool, requirement, cost, vars),
    printedConstants(ctx.state, ctx.deps, payingFor).flatMap((trigger) => trigger.paymentOnly ?? []),
    definition.readsPaidTypes ? [definition.readsPaidTypes] : [],
    wildAs,
  );
}

/**
 * Logs the wilds of an ability's payment as declared on the command, or left as they are because no declaration could
 * change a reading (`commitPlay` does the same for a play). A payment with no wild declares nothing; one the player is
 * asked about is logged when they answer (`resolve/declare-wilds.ts`).
 */
export function logAbilityWildTypes(
  ctx: Ctx,
  playerId: PlayerId,
  instanceId: InstanceId,
  abilityId: AbilityId,
  types: PaidTypesSettled | undefined,
): void {
  const declared = types?.declared;
  if (!declared || declared.types.length === 0) return;
  emit(ctx, {
    type: "wildTypesDeclared",
    playerId,
    instanceId,
    abilityId,
    declared: declared.types,
    skipped: declared.skipped,
    paidAs: declared.paidAs,
  });
}

/** What a play frame is pushed with for a priced play: its cost's bindings and vars, and any wilds still to declare. */
export const playFrameCost = (priced: PricedPlay, bindings: Bindings = priced.plan.bindings) => ({
  bindings,
  vars: priced.vars,
  ...(priced.types?.undeclared ? { undeclaredWilds: priced.types.undeclared } : {}),
});

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
  /** The event an interrupt or response played inside a timing window answers (`planCost`). */
  event: TriggerEvent | null = null,
  /** The ability the play triggers and the declared types of its wilds (`settlePaidTypes`; docs/phase7-wave8.md §3.62). */
  paidTypes: PaidTypesInput = {},
): PricedPlay | PriceFault {
  const plan = planCost(
    ctx.state,
    ctx.deps,
    cardInstanceId,
    playerId,
    cost,
    choices,
    handCardsIn(payment),
    selection,
    event,
  );
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
  const vars = resourceVars(pool, plan.cost ?? cost, requirement, selection.resources);
  if (isFault(vars)) return vars;
  const payingFor = plan.payingFor ?? cardInstanceId;
  const settled = settlePaidTypes(
    pool,
    {
      ...plan.vars,
      ...vars,
      ...paymentSourceVars(ctx, playerId, payment),
      ...paidCardVars(ctx, playerId, payment, payingFor, pool, requirement, plan.cost ?? cost, vars),
      ...(printedX ? { x: xValue } : {}),
    },
    paidRequirementOf(pool, requirement, plan.cost ?? cost, vars),
    printedConstants(ctx.state, ctx.deps, payingFor).flatMap((trigger) => trigger.paymentOnly ?? []),
    paidTypeReads(ctx.state, ctx.deps, playerId, cardInstanceId, paidTypes.abilityId),
    paidTypes.wildAs,
  );
  if (isFault(settled)) return settled;
  return { pool, plan, ...settled };
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
  /**
   * The card is played from the top of the deck under this permission (`deckTopPlayOf`, read by the caller before
   * anything moved; docs/phase7-wave8.md §3.49). Null for every other play, a searched deck's card included.
   */
  deckTop: DeckTopPermission | null = null,
): SpentPayment {
  if (deckTop) {
    // RRG 1.8 "Initiating Abilities" (p. 24), step 1, and FAQ "Magik (#30A)" (p. 64, which calls it step 3): the card
    // goes to the table before any cost is paid, "as soon as she does this, she turns the new top card of her deck
    // faceup" (`moveCard` logs `deckTopShown`), and the card that was second is "the top card of your deck" to
    // everything the played card reads. The permission's use is counted here, so a play canceled later still used it
    // (RRG 1.8 "Limit", p. 27). The card waits in the player's resolving area whatever its type; an ally, support or
    // upgrade enters play from there when its play frame runs.
    const definition = ctx.deps.abilities[deckTop.abilityId];
    if (definition) recordAbilityUse(ctx, deckTop.sourceInstanceId, deckTop.abilityId, definition, null, playerId);
    moveCard(ctx, cardInstanceId, { kind: "resolving", playerId });
  }
  consumeCostReductions(ctx, ctx.deps, playerId, cardInstanceId);
  const spent = payPayment(ctx, playerId, payment, cardInstanceId);
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
    // "…if you have played another card this phase" (`Predicate playedThisPhase`): this player's plays, in any phase.
    playedByPlayerThisPhase: {
      ...ctx.state.playedByPlayerThisPhase,
      [playerId]: [...(ctx.state.playedByPlayerThisPhase?.[playerId] ?? []), cardInstanceId],
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
  // A card played from where it lay facedown (an event attached facedown to George Stacy, docs/phase7-wave5.md §3.15)
  // is played faceup and is itself again: its owner may look at it, and a played card is revealed as it is played.
  if (mustInstance(ctx.state, cardInstanceId).facedownAs !== null)
    updateInstance(ctx, cardInstanceId, (i) => ({ ...i, facedownAs: null, faceup: true }));
  emit(ctx, {
    type: "cardPlayed",
    playerId,
    instanceId: cardInstanceId,
    cardId: mustInstance(ctx.state, cardInstanceId).cardId,
    resourcesPaid: poolTotal(priced.pool),
    paid: priced.pool,
    // The log keeps where the card really was; every reader of a play treats it as played from the hand (FAQ "Magik
    // (#30A)", p. 64: "that card is considered to have been played from her hand").
    ...(deckTop ? { from: "deckTop" as const, countsAsFrom: "hand" as const } : {}),
    ...(priced.types ? { paidCount: priced.types.paidCount } : {}),
    ...(priced.types?.declared ? { paidAs: priced.types.declared.paidAs } : {}),
  });
  // The wilds as declared on the command, or left as they are because no declaration could change a reading
  // (docs/phase7-wave8.md §3.62). A payment with no wild declares nothing; one the player is asked about is logged
  // when they answer (`resolve/play-card.ts`).
  const declared = priced.types?.declared;
  if (declared && declared.types.length > 0) {
    emit(ctx, {
      type: "wildTypesDeclared",
      playerId,
      instanceId: cardInstanceId,
      declared: declared.types,
      skipped: declared.skipped,
      paidAs: declared.paidAs,
    });
  }
  // RRG "Event": a played event is out of play while it resolves, then it is discarded.
  if (!deckTop && cardOf(ctx.state, cardInstanceId)?.type === "event")
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
  // The top card of the deck played under `playableTopOfDeck` is played from the hand (docs/phase7-wave8.md §3.49).
  if (reduction.fromHand === true && !inHandForPlaying(state, deps, playerId, cardInstanceId))
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
  // An event whose play is its Action may be played during another player's turn (`requireActionTiming`); every other
  // card is played on its player's own turn only.
  const played = cardOf(ctx.state, command.cardInstanceId);
  const actionEvent = played !== undefined && isActionEvent(ctx, played);
  const invalid = (actionEvent ? requireActionTiming : requireActivePlayer)(ctx.state, command.playerId, command);
  if (invalid) return invalid;
  const player = mustPlayer(ctx.state, command.playerId);
  // "You may play the top card of your deck as if it was in your hand" (`playableTopOfDeck`, docs/phase7-wave8.md
  // §3.49): read before anything moves, and handed to `commitPlay`.
  const deckTop = deckTopPlayOf(ctx.state, ctx.deps, command.playerId, command.cardInstanceId);
  if (
    !deckTop &&
    !player.hand.includes(command.cardInstanceId) &&
    !playableOutsideHand(ctx.state, ctx.deps, command.playerId, command.cardInstanceId)
  ) {
    const standing = deckTopPermission(ctx.state, ctx.deps, command.playerId);
    if (standing?.limitUsed && standing.instanceId === command.cardInstanceId) {
      const period = ctx.deps.abilities[standing.abilityId]?.limit?.period ?? "phase";
      return engineError("limit_reached", `you have already played the top card of your deck this ${period}`, command);
    }
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
  // RRG "Event": an event's own ability says when it is played. An interrupt or
  // response event is played only from the window its trigger opens, never as an action.
  const windowOnly =
    card.type === "event" &&
    !actionEvent &&
    printedAbilityRefs(card).some((ref) => {
      const kind = ctx.deps.abilities[ref.id]?.trigger.kind;
      return kind === "interrupt" || kind === "response";
    });
  if (windowOnly) {
    return engineError(
      "card_type_not_playable",
      `this event can only be played when its interrupt or response triggers${thwartBlockNote(ctx, card, command.playerId)}`,
      command,
    );
  }
  // Which of the event's Action abilities this play triggers, and that one's form, condition and target
  // (`eventActionToPlay`). Everything below prices, pays for and resolves that ability alone.
  if (command.abilityId !== undefined && !actionEvent) {
    return engineError("invalid_choice", "only an event played as an Action names an ability to trigger", command);
  }
  const chosen = eventActionToPlay(ctx, card, command.cardInstanceId, command.playerId, command.abilityId);
  if (chosen && isFault(chosen)) return engineError(chosen.code, chosen.message, command);
  const ability = chosen?.definition;

  // Restricted is not checked here: RRG 1.8 "Restricted" (p. 38), "A player can play or put into play a restricted card
  // even if they already control two restricted cards." The limit is enforced once the card is in play
  // (`checkRestrictedLimits`; docs/phase7-wave7.md §4.1, owner ruling 2026-10-06).

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
  // "Max 1 TEAM card per player" (docs/phase7-wave6.md §3.28): counted under the player who would control it.
  const overTraitLimit = playerTraitLimitFault(ctx.state, ctx.deps, controllerId, card, command.cardInstanceId);
  if (overTraitLimit) return engineError("no_valid_target", overTraitLimit, command);
  const restricted = playRestrictionFault(ctx.state, ctx.deps, command.playerId, card, command.cardInstanceId);
  if (restricted) return engineError(restricted.code, restricted.message, command);
  // "You cannot play hero-specific cards." (Depowered; `cannotPlay`, docs/phase7-wave2.md §3.11).
  if (cannotPlayCard(ctx.state, ctx.deps, command.playerId, command.cardInstanceId)) {
    return engineError("no_valid_target", "you cannot play that card right now", command);
  }
  // "[A title] cannot enter play during this game" (`RuleSpec cannotEnterPlay`, docs/phase7-wave8.md §3.43): refused
  // before pricing, so the play costs nothing, and before the destination is read, so it is refused for either.
  if (entersPlayWhenPlayed(card) && cannotEnterPlay(ctx.state, ctx.deps, command.cardInstanceId)) {
    return engineError("no_valid_target", `${card.name} cannot enter play during this game`, command);
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
      return engineError("duplicate_unique_card", uniqueBlockedMessageIn(ctx.state, card, match), command);
    }
  }

  // "Either play that ally into their game area …, or play it into the mission area" (`RuleSpec playDestination`,
  // docs/phase7-wave8.md §3.34). Read after every check a play to the player's own area makes, so a card that cannot
  // be played is refused for the same reason whichever destination was named.
  if (command.into !== undefined) {
    const area = command.into.scenarioPlayArea;
    if (controllerId !== command.playerId) {
      return engineError("no_valid_target", "a card played into that area is under no player's control", command);
    }
    // Which cards may go there is the rule's own `cards` query, read by `playDestinationsOf` and by nothing else.
    if (!playDestinationsOf(ctx.state, ctx.deps, command.cardInstanceId).includes(area)) {
      return engineError("no_valid_target", "that card cannot be played into that area right now", command);
    }
    // What is left is not the rule's to say: only a card that stays in play has an area to be played into. One that
    // does not is refused, never quietly played somewhere else.
    const cannotStay = playedIntoAreaFault(card);
    if (cannotStay) return engineError("no_valid_target", cannotStay, command);
  }

  let attachTo: InstanceId | null = null;
  const ownIdentity = controller.identity.instanceId;
  if (card.type === "upgrade" && command.into !== undefined && !card.attachesTo) {
    // An upgrade with no "attach to" text, played into an area: it is in the area attached to nothing. RRG 1.8 "Attach
    // To" (p. 8) binds only a card that "uses the phrase 'attach to'", and "Upgrade" (p. 46) puts the others "near a
    // player's identity card" as "an extension of the controlling player's identity", which a card in an area no
    // player controls has none of. The command's host is not read, as on any play of such an upgrade; one that names
    // some other card is asking for a different play.
    if (command.attachToInstanceId && command.attachToInstanceId !== ownIdentity) {
      return engineError(
        "no_valid_target",
        "this upgrade has no 'attach to' text: played into that area it is attached to nothing",
        command,
      );
    }
  } else if (card.type === "upgrade") {
    attachTo = command.attachToInstanceId ?? (card.attachesTo ? null : ownIdentity);
    if (!attachTo || !getInstance(ctx.state, attachTo)) {
      return engineError("no_valid_target", "upgrade has no valid host", command);
    }
    // Played into an area, an upgrade with "attach to" text is still attached "as it enters play" (RRG 1.8 "Attach
    // To", p. 8), so its host is a card in that area; on a host anywhere else it would not be played into the area.
    if (command.into !== undefined && scenarioPlayAreaOf(ctx.state, attachTo) !== command.into.scenarioPlayArea) {
      return engineError("no_valid_target", "an upgrade played into that area attaches to a card in it", command);
    }
    // "Max N per enemy/ally" (copies by title) and "Max 1 TRAINING upgrade per ally" (by trait, docs/phase7-wave6.md
    // §3.28): read before the host query so the refusal names the maximum, not the "attach to" text.
    const overLimit = attachLimitFault(ctx.state, ctx.deps, attachTo, command.cardInstanceId);
    if (overLimit) return engineError("no_valid_target", overLimit, command);
    if (card.attachesTo) {
      const context: EffectContext = {
        selfInstanceId: command.cardInstanceId,
        controllerId,
        event: null,
        bindings: {},
        deps: ctx.deps,
        // "Players may attach upgrades to allies in the mission area" (`RuleSpec playDestination.attachments`). The
        // rule that lets the upgrade itself be played into the area reaches its hosts there the same way.
        ...(command.into !== undefined
          ? { reaches: command.into }
          : attachmentReachOf(ctx.state, ctx.deps, command.cardInstanceId)),
      };
      if (!attachmentHostCandidates(ctx.state, card.attachesTo, context).includes(attachTo)) {
        return engineError("no_valid_target", `upgrade must attach to ${card.attachesTo.kind}`, command);
      }
    } else if (attachTo !== ownIdentity) {
      return engineError("no_valid_target", "this upgrade attaches to your identity", command);
    }
  }

  // "Reduce the cost to play that card by 3" (Star-Lord; docs/phase7-wave3.md §3.20): each named ability is checked
  // before pricing, so a refused one costs nothing.
  const reductions = command.costReductionAbilities ?? [];
  let extraReduction = deckTop?.costReduction ?? 0;
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
  // "Reduce the cost of the next ally played to the mission this phase by 2" (docs/phase7-wave8.md §3.35): a reduction
  // that reads the destination is part of this play's price only when the play names that area.
  const intoArea = command.into?.scenarioPlayArea ?? null;
  extraReduction += Math.max(
    0,
    areaCostReductionFor(ctx.state, ctx.deps, command.playerId, command.cardInstanceId, intoArea),
  );

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
    null,
    { abilityId: chosen?.abilityId ?? null, wildAs: command.wildAs },
  );
  if (isFault(priced)) return engineError(priced.code, priced.message, command);

  const spent = commitPlay(ctx, command.playerId, command.cardInstanceId, command.payment, priced, deckTop);
  if (intoArea !== null) consumeAreaCostReductions(ctx, command.playerId, command.cardInstanceId, intoArea);
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
    triggeredAction(chosen),
    playFrameCost(priced),
    controllerId,
    command.into?.scenarioPlayArea,
  );
  payCost(ctx, command.cardInstanceId, command.playerId, ability?.cost, priced.plan);
  const unpayable = thwartCostUnpayableAfterPaying(ctx, card.type === "event" ? ability : undefined, command);
  if (unpayable) return unpayable;
  announceResourcesSpent(ctx, command.playerId, spent, command.cardInstanceId, "playCard");
  return null;
}

/**
 * docs/phase7-wave5.md §4.1 Q28: whether a scheme's additional thwart cost is payable is judged after the ability's
 * own cost is paid, at play time as at the target choice, so a "(thwart)" event or ability whose every target is a
 * scheme it could only pay for with what it just spent cannot be initiated (RRG 1.8 "Initiating Abilities", p. 24,
 * step 2, checked again on the game as paying left it; the command is refused, so nothing was paid).
 */
function thwartCostUnpayableAfterPaying(
  ctx: Ctx,
  definition: AbilityDefinition | undefined,
  command: Command & { type: "playCard" | "useAbility" },
): EngineError | null {
  if (!definition || !anyThwartCost(ctx.state, ctx.deps)) return null;
  if (!abilityLacksValidTarget(ctx.state, ctx.deps, definition, command.cardInstanceId, command.playerId)) return null;
  return engineError(
    "no_valid_target",
    "after paying for it you could not pay the additional cost to thwart any scheme it could target",
    command,
  );
}

/**
 * Whether an Action event cannot be played right now: RRG 1.8 "Action" (p. 6) lets players trigger action abilities
 * "during their turn, or by request during other players' turns", so only during a player's turn, and an effect that
 * plays the event does not lift that (docs/phase7-wave6.md §3.70: "only cards the player could legally play now";
 * Fetch Quest defeated in the villain phase offers no Action event). Any player may, during any player's turn: the
 * effect playing it stands in for the request.
 *
 * Lifted only for an effect that itself instructs the play of an event with an Action ability
 * (`EffectSpec playFromHand.ignoreActionTiming`, `ActionTiming "any"`).
 */
function actionTimingFault(state: GameState, _playerId: PlayerId): boolean {
  const step = state.step;
  return step.phase !== "player" || step.kind !== "turn";
}

/**
 * When an effect may play an Action event: `"turn"`, the Action's own timing (`actionTimingFault`), or `"any"`, for an
 * effect whose text instructs the play of an event with an Action ability (`EffectSpec playFromHand.
 * ignoreActionTiming`). Nothing else about the play changes with it.
 */
export type ActionTiming = "turn" | "any";

/**
 * Where an effect plays a card from "as if it were in your hand" (`EffectSpec playFromHand.from`). `tuckedUnder` holds
 * the resolved hosts: any card tucked under one of them (Med Lab 38028; docs/phase7-wave6.md §3.57), whoever owns it.
 */
export type PlayFromZone = "hand" | "setAside" | "deck" | { readonly tuckedUnder: readonly InstanceId[] };

/**
 * The cards an effect could play from `from` for this player, in zone order (before any play check). With `deps`, the
 * hand is followed by the top card of the deck the player may play "as if it was in your hand" (`deckTopPlayableBy`,
 * docs/phase7-wave8.md §3.49; RRG 1.8 FAQ "Magik (#30A)", p. 64, second entry). Only for `from: "hand"`: a searched
 * deck, the set-aside area and a tuck are not the hand.
 */
export function cardsInPlayFromZone(
  state: GameState,
  playerId: PlayerId,
  from: PlayFromZone,
  deps?: EngineDeps,
): readonly InstanceId[] {
  if (typeof from === "object") return from.tuckedUnder.flatMap((host) => getInstance(state, host)?.tucked ?? []);
  const cards = getPlayer(state, playerId)?.[from] ?? [];
  return from === "hand" && deps ? [...cards, ...deckTopPlayableBy(state, deps, playerId)] : cards;
}

/** The permission an effect's play of `id` from `from` uses: only a play "from your hand" may reach the deck's top. */
export const deckTopPlayFrom = (
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  id: InstanceId,
  from: PlayFromZone,
): DeckTopPermission | null => (from === "hand" ? deckTopPlayOf(state, deps, playerId, id) : null);

/** Why a card is not where `from` says, as a fault message, or null. */
function playFromZoneFault(
  state: GameState,
  playerId: PlayerId,
  id: InstanceId,
  from: PlayFromZone,
  deps: EngineDeps,
): string | null {
  if (cardsInPlayFromZone(state, playerId, from, deps).includes(id)) return null;
  if (typeof from === "object") return "not tucked there";
  return from === "hand" ? "not in hand" : from === "deck" ? "not in deck" : "not set aside";
}

/**
 * Whether an action ability cannot be initiated because it only plays a tucked card and none could be played now:
 * "play the ally here as if it was in your hand" (Med Lab 38028; docs/phase7-wave6.md §3.57). The tucked card is the
 * card the ability names, so RRG 1.8 "Initiating Abilities" (p. 24) steps 2–3 ("can the card be played … the player's
 * ability to pay") are checked for it before the ability's own cost is paid, the way "Target" (p. 42) blocks an
 * ability with no valid target. An optional play ("you may"), or an ability with any other effect, is left alone.
 */
export function tuckedPlayUnavailable(
  ctx: Ctx,
  definition: AbilityDefinition,
  sourceId: InstanceId,
  playerId: PlayerId,
): boolean {
  const effects = definition.effects;
  const plays = effects.filter(
    (effect): effect is Extract<EffectSpec, { kind: "playFromHand" }> =>
      effect.kind === "playFromHand" && typeof effect.from === "object" && effect.optional !== true,
  );
  if (plays.length === 0 || plays.length !== effects.length) return false;
  const context: EffectContext = {
    selfInstanceId: sourceId,
    controllerId: playerId,
    event: null,
    bindings: {},
    deps: ctx.deps,
  };
  return plays.every((effect) => {
    if (typeof effect.from !== "object") return false;
    const from: PlayFromZone = { tuckedUnder: resolveRef(ctx.state, effect.from.tuckedUnder, context) };
    const reduction =
      effect.costReduction === undefined
        ? 0
        : Math.max(0, resolveValue(ctx.state, effect.costReduction, context, ctx.deps));
    return !cardsInPlayFromZone(ctx.state, playerId, from).some(
      (id) =>
        (!effect.filter || matchesQuery(ctx.state, id, effect.filter, context)) &&
        (effect.ignoreCost === true
          ? playIgnoringCostFault(ctx, playerId, id, from)
          : playWithPaymentFault(ctx, playerId, id, reduction, from)) === null,
    );
  });
}

/**
 * The play restrictions every "play a card from your hand" effect checks, whatever it does about the cost. RRG 1.8
 * "Play, Put Into Play" (p. 32) and "Play Restrictions and Permissions" (p. 33): playing a card through an effect is
 * still *playing* it, so form, "max per", the unique rule and `cannotPlay` all apply. Restricted is a limit on what is
 * in play, not on playing (RRG 1.8 "Restricted", p. 38): it is enforced after the card enters play.
 */
function playFromEffectRestrictionFault(
  ctx: Ctx,
  playerId: PlayerId,
  id: InstanceId,
  from: PlayFromZone = "hand",
): string | null {
  const card = cardOf(ctx.state, id);
  const player = getPlayer(ctx.state, playerId);
  const misplaced = playFromZoneFault(ctx.state, playerId, id, from, ctx.deps);
  if (!card || !player || misplaced) return misplaced ?? "not a card";
  if (!("cost" in card)) return "not a card that is played";
  if ("specialCost" in card && card.specialCost === "dash") return "a '—' cost cannot be played";
  const restrictions = "playRestrictions" in card ? card.playRestrictions : undefined;
  if (restrictions?.form && player.identity.form !== restrictions.form) return "wrong form";
  if (playerTraitLimitFault(ctx.state, ctx.deps, playerId, card, id)) return "a max per player";
  if (
    playRestrictionFault(ctx.state, ctx.deps, playerId, card, id) ||
    cannotPlayCard(ctx.state, ctx.deps, playerId, id)
  )
    return "a play restriction";
  if (entersPlayWhenPlayed(card) && matchingCardInPlay(ctx.state, card, new Set(), playerId, ctx.deps))
    return "a matching unique card is in play";
  if (entersPlayWhenPlayed(card) && cannotEnterPlay(ctx.state, ctx.deps, id)) return "it cannot enter play";
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
  /** The event's Action ability to judge; absent, the play is legal when any of them is (`eventActionsForEffectPlay`). */
  abilityId?: AbilityId,
  timing: ActionTiming = "turn",
): string | null {
  const restriction = playFromEffectRestrictionFault(ctx, playerId, id, from);
  if (restriction) return restriction;
  const card = mustCardOf(ctx.state, id);
  if ("keywords" in card && card.keywords.some((keyword) => keyword.name === "requirement")) {
    return "a Requirement card cannot be played ignoring its cost";
  }
  if (card.type === "upgrade" && card.attachesTo) return "an upgrade with a host of its own";
  if (card.type !== "event") return null;
  return anyEventAction(ctx, card, abilityId, "an event with no cost-free action", (action) => {
    if (action.definition.cost) return "an event with no cost-free action";
    return eventActionEffectFault(ctx, action, id, playerId, timing);
  });
}

/**
 * An effect-played event's Action ability: its own restrictions, and the turn an Action needs (`actionTimingFault`)
 * unless the playing effect lifts it (`ActionTiming "any"`).
 */
function eventActionEffectFault(
  ctx: Ctx,
  action: EventAction,
  id: InstanceId,
  playerId: PlayerId,
  timing: ActionTiming,
): string | null {
  const fault = eventActionFault(ctx, action, id, playerId);
  if (fault?.code === "wrong_form") return fault.note;
  if (timing === "turn" && actionTimingFault(ctx.state, playerId)) return "an Action event outside its player's turn";
  return fault?.note ?? null;
}

/**
 * Judges an effect's play of an event across its Action abilities (RRG 1.8 "Event", p. 18: the player triggers one of
 * them): null when the named one, or any one, passes `judge`; else the first one's reason, or `none` when there is no
 * such ability.
 */
function anyEventAction(
  ctx: Ctx,
  card: AnyCard,
  abilityId: AbilityId | undefined,
  none: string,
  judge: (action: EventAction) => string | null,
): string | null {
  const actions = eventActions(ctx, card).filter((action) => abilityId === undefined || action.abilityId === abilityId);
  const faults = actions.map(judge);
  return faults.includes(null) ? null : (faults[0] ?? none);
}

/**
 * The Action abilities of an event an effect could trigger by playing it now, in printed order: more than one is the
 * player's choice, asked by the effect before any payment (`executePlayFromHand`). Empty for any other card.
 */
export function eventActionsForEffectPlay(
  ctx: Ctx,
  playerId: PlayerId,
  id: InstanceId,
  /** The effect's cost reduction when it pays for the card; null when it ignores the cost. */
  paying: number | null,
  from: PlayFromZone = "hand",
  timing: ActionTiming = "turn",
): readonly AbilityId[] {
  return eventActions(ctx, mustCardOf(ctx.state, id))
    .map((action) => action.abilityId)
    .filter(
      (abilityId) =>
        (paying === null
          ? playIgnoringCostFault(ctx, playerId, id, from, abilityId, timing)
          : playWithPaymentFault(ctx, playerId, id, paying, from, abilityId, timing)) === null,
    );
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
  /** The event's Action ability to judge; absent, the play is legal when any of them is (`eventActionsForEffectPlay`). */
  abilityId?: AbilityId,
  timing: ActionTiming = "turn",
): string | null {
  const restriction = playFromEffectRestrictionFault(ctx, playerId, id, from);
  if (restriction) return restriction;
  const card = mustCardOf(ctx.state, id);
  // Played from the top of the deck through this effect, the permission's reduction and the effect's both apply
  // (docs/phase7-wave8.md §4.1 Q27 = A).
  const reduction = extraReduction + (deckTopPlayFrom(ctx.state, ctx.deps, playerId, id, from)?.costReduction ?? 0);
  if (card.type !== "event") return paidPlayFault(ctx, playerId, id, reduction, undefined);
  return anyEventAction(
    ctx,
    card,
    abilityId,
    "an event with no action ability",
    (action) =>
      eventActionEffectFault(ctx, action, id, playerId, timing) ??
      paidPlayFault(ctx, playerId, id, reduction, action.definition.cost),
  );
}

/** The cost half of `playWithPaymentFault`: the card's reduced cost plus `abilityCost`, against all the player has. */
function paidPlayFault(
  ctx: Ctx,
  playerId: PlayerId,
  id: InstanceId,
  extraReduction: number,
  abilityCost: AbilityCost | undefined,
): string | null {
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
  // One card is spent once: every option with each hand card spent plainly, then with each spent the way that
  // generates the most (its own "When you spend this card" ability, `mostFromEachHandCard`).
  const everything = paymentsFromOptionIds(usable.map((option) => option.optionId));
  const pays = (payment: readonly Payment[]): boolean => {
    const most = priceOrNull(ctx, playerId, payment, id);
    return most !== null && satisfies(most, requirement);
  };
  return pays(everything.filter((payment) => !isWhenSpentUse(payment))) ||
    pays(mostFromEachHandCard(ctx, playerId, everything, id, id))
    ? null
    : "not enough resources to pay for it";
}

/**
 * Where an upgrade played by an effect attaches: its own identity when it names no host, else the single legal host.
 * `undefined` means there is none and the card cannot be played; `null` means "not an upgrade", i.e. no host needed.
 *
 * Several legal hosts is a player choice the effect asks for separately (`executePlayFromHand`); this is the
 * no-question-to-ask case, and the shape the caller uses once that choice is answered.
 */
export function hostForEffectPlay(ctx: Ctx, playerId: PlayerId, id: InstanceId): InstanceId | null | undefined {
  if (mustCardOf(ctx.state, id).type !== "upgrade") return null;
  return upgradeHostCandidates(ctx.state, ctx.deps, id, playerId)[0] ?? undefined;
}

/** Every legal host for an upgrade an effect is about to play; empty for a card that needs none. */
export function hostChoicesForEffectPlay(ctx: Ctx, playerId: PlayerId, id: InstanceId): readonly InstanceId[] {
  const card = mustCardOf(ctx.state, id);
  if (card.type !== "upgrade" || !card.attachesTo) return [];
  return upgradeHostCandidates(ctx.state, ctx.deps, id, playerId);
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
  abilityId?: AbilityId,
  /** Where the effect plays from: from the hand, the top card of the deck adds its permission's reduction (Q27 = A). */
  from: PlayFromZone = "hand",
): ResolvedRequirement | null {
  const abilityCost = eventActionForQuery(ctx, mustCardOf(ctx.state, id), id, playerId, abilityId).action?.definition
    .cost;
  const plan = planCost(ctx.state, ctx.deps, id, playerId, abilityCost, {}, new Set([id]));
  if (isFault(plan)) return null;
  const reduction = extraReduction + (deckTopPlayFrom(ctx.state, ctx.deps, playerId, id, from)?.costReduction ?? 0);
  return playRequirement(ctx.state, playerId, id, plan.requirement, ctx.deps, attachTo, 0, reduction);
}

/**
 * Plays a card from hand for a payment the effect's own reduction has already been applied to (Team-Building
 * Exercise). Returns the play's frame, or null, having spent nothing, when the payment does not cover the reduced cost.
 * `extraBindings` are added to the play's frame (`playFromHand.via`).
 */
export function playWithPayment(
  ctx: Ctx,
  playerId: PlayerId,
  id: InstanceId,
  payment: readonly Payment[],
  attachTo: InstanceId | null,
  extraReduction: number,
  extraBindings: Bindings = {},
  /** The event's Action ability the player chose; absent, the only usable one. */
  abilityId?: AbilityId,
  /** Where the effect plays from (`deckTopPlayFrom`): the hand reaches the top of the deck under its permission. */
  from: PlayFromZone = "hand",
  /**
   * The declared types of the payment's wilds, when the caller has them (`playCard.wildAs`; docs/phase7-wave8.md
   * §3.62). Absent, the play's own frame asks its player when a card reads them and the declaration can matter.
   */
  wildAs?: readonly ResourceType[],
  /**
   * The in-play scenario area the card is played into (`RuleSpec playDestination`, docs/phase7-wave8.md §3.34), which
   * the effect's player chose; null for their own play area. A reduction that reads the destination is part of the
   * price and is used up, as for a `playCard` command with `into`.
   */
  into: string | null = null,
): FrameId | null {
  const chosen = eventActionToPlay(ctx, mustCardOf(ctx.state, id), id, playerId, abilityId);
  if (chosen && isFault(chosen)) return null;
  const ability = chosen?.definition;
  const deckTop = deckTopPlayFrom(ctx.state, ctx.deps, playerId, id, from);
  const reduction =
    extraReduction +
    (deckTop?.costReduction ?? 0) +
    Math.max(0, areaCostReductionFor(ctx.state, ctx.deps, playerId, id, into));
  const priced = pricePlay(ctx, playerId, id, ability?.cost, payment, {}, attachTo, undefined, reduction, {}, null, {
    abilityId: chosen?.abilityId ?? null,
    wildAs,
  });
  if (isFault(priced)) return null;
  const spent = commitPlay(ctx, playerId, id, payment, priced, deckTop);
  if (into !== null) consumeAreaCostReductions(ctx, playerId, id, into);
  const bindings = { ...priced.plan.bindings, ...extraBindings };
  pushPlayCardFrame(
    ctx,
    id,
    playerId,
    attachTo,
    triggeredAction(chosen),
    playFrameCost(priced, bindings),
    playerId,
    into ?? undefined,
  );
  const frameId = ctx.state.stack[0]?.frameId ?? null;
  payCost(ctx, id, playerId, ability?.cost, priced.plan);
  announceResourcesSpent(ctx, playerId, spent, id, "playCard");
  return frameId;
}

/**
 * Plays a card from hand ignoring its resource cost. RRG 1.8 "Ignore" (p. 23): "no resources are paid for that card. For
 * the purpose of card effects, that card is considered to have been played with zero resources paid for its cost." So
 * `paid.*` are all 0. It counts as played (max per round/phase, "the first ally played each round").
 */
export function playIgnoringCost(
  ctx: Ctx,
  playerId: PlayerId,
  id: InstanceId,
  from: PlayFromZone = "hand",
  extraBindings: Bindings = {},
  /** The event's Action ability the player chose; absent, the only one this effect could play. */
  abilityId?: AbilityId,
  timing: ActionTiming = "turn",
  /** The in-play scenario area the card is played into, as for `playWithPayment`; null for the player's own area. */
  into: string | null = null,
): FrameId | null {
  if (playIgnoringCostFault(ctx, playerId, id, from, abilityId, timing)) return null;
  const usable = eventActionsForEffectPlay(ctx, playerId, id, null, from, timing);
  const actionId = abilityId ?? (usable.length === 1 ? usable[0] : undefined);
  // Several usable and none named: the choice is the player's (RRG 1.8 "Event", p. 18), so nothing is played.
  if (usable.length > 0 && actionId === undefined) return null;
  const plan = planCost(ctx.state, ctx.deps, id, playerId, undefined, {}, new Set());
  if (isFault(plan)) return null;
  const vars = {
    ...plan.vars,
    "paid.physical": 0,
    "paid.mental": 0,
    "paid.energy": 0,
    "paid.wild": 0,
    "paid.total": 0,
  };
  const priced: PricedPlay = { pool: EMPTY_POOL, plan, vars };
  commitPlay(ctx, playerId, id, [], priced, deckTopPlayFrom(ctx.state, ctx.deps, playerId, id, from));
  // "The next ally played to the mission": this was that ally, though nothing was paid for the reduction to lower.
  if (into !== null) consumeAreaCostReductions(ctx, playerId, id, into);
  const card = mustCardOf(ctx.state, id);
  const attachTo = card.type === "upgrade" ? mustPlayer(ctx.state, playerId).identity.instanceId : null;
  const triggered = actionId ? { triggeredAbilityId: actionId, event: null, eventFrameId: null } : undefined;
  pushPlayCardFrame(
    ctx,
    id,
    playerId,
    attachTo,
    triggered,
    { bindings: { ...plan.bindings, ...extraBindings }, vars },
    playerId,
    into ?? undefined,
  );
  return ctx.state.stack[0]?.frameId ?? null;
}

/**
 * RRG "Action": triggered on a card you control or an encounter card, during your own turn or another player's
 * (`requireActionTiming`). This command triggers Action abilities and nothing else.
 */
export function useAbility(ctx: Ctx, command: Command & { type: "useAbility" }): EngineError | null {
  const invalid = requireActionTiming(ctx.state, command.playerId, command);
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
  // An ability that works in hand works only there, and only for the hand's owner; every other ability only in play
  // (`AbilityDefinition.activeIn`, docs/phase7-wave4.md §3.13).
  const inHand = mustPlayer(ctx.state, command.playerId).hand.includes(command.cardInstanceId);
  if ((definition.activeIn === "hand") !== inHand) {
    return engineError("no_valid_target", `${command.abilityId} is not active where that card is`, command);
  }
  // A card in a scenario deck is out of play (RRG 1.8 "In Play and Out of Play", p. 23) and no text is used from a
  // deck: the action of a card under a scenario deck's top card (docs/phase7-wave9.md §3.17) is not the top card's.
  if (Object.values(ctx.state.scenarioDecks).some((piles) => piles.deck.includes(command.cardInstanceId))) {
    return engineError("no_valid_target", `${command.abilityId} is not active on a card in a deck`, command);
  }
  // A card in the victory display is out of play (RRG 1.8 "Victory Display", p. 46): none of its actions can be used
  // there, whoever its last controller was (docs/phase7-wave7.md §3.50).
  if (ctx.state.victoryDisplay.includes(command.cardInstanceId)) {
    return engineError("no_valid_target", `${command.abilityId} is not active in the victory display`, command);
  }
  // "Players cannot trigger 'Alter-Ego Action' abilities on obligations." (`cannotTriggerActions`, §3.11).
  if (cannotTriggerAction(ctx.state, ctx.deps, command.cardInstanceId, definition.trigger.form)) {
    return engineError("no_valid_target", "that ability cannot be triggered right now", command);
  }
  // "You cannot resolve triggered abilities in your hero's printed text box" (`cannotResolveTriggeredAbilities`).
  if (triggeredAbilityForbidden(ctx.state, ctx.deps, command.cardInstanceId, definition.trigger, command.playerId)) {
    return engineError("no_valid_target", "that ability cannot be resolved right now", command);
  }
  if (actionConditionUnmet(ctx.state, ctx.deps, definition, command.cardInstanceId, command.playerId)) {
    return engineError("no_valid_target", "that ability cannot be triggered: its condition is not met", command);
  }
  const fault = abilityTargetFault(ctx.state, ctx.deps, definition, command.cardInstanceId, command.playerId);
  if (fault !== null) return engineError("no_valid_target", TARGET_FAULT_MESSAGE[fault], command);
  // "Play the ally here as if it was in your hand" (Med Lab; docs/phase7-wave6.md §3.57): nothing tucked there could be
  // played and paid for now.
  if (tuckedPlayUnavailable(ctx, definition, command.cardInstanceId, command.playerId)) {
    return engineError("no_valid_target", "no card tucked there could be played now", command);
  }
  // "Any player whose alter-ego has the [MUTANT] trait may trigger this ability" (`triggerableBy`, docs/phase7-wave6.md
  // §3.11) names who may, in place of the controller rule below; the form gate further down reads the triggering player.
  const named = inHand
    ? null
    : triggeringPlayers(ctx.state, ctx.deps, command.cardInstanceId, definition.trigger, null);
  if (named && !named.includes(command.playerId)) {
    return engineError("no_valid_target", "you may not trigger that ability", command);
  }
  const controller = controllerOf(ctx.state, command.cardInstanceId);
  if (!named && controller !== null && controller !== command.playerId) {
    return engineError("no_valid_target", "you do not control that card", command);
  }
  // An ally attached to a card under no player's control (`isCaptiveAlly`; "Attached ally is under no player's
  // control", docs/phase7-wave9.md §3.19) is not an encounter card any player may trigger: its Action is nobody's.
  if (!named && isCaptiveAlly(ctx.state, command.cardInstanceId)) {
    return engineError("no_valid_target", "no player controls that ally", command);
  }
  // An encounter card may be triggered by any player (RRG 1.8 "Action", p. 6), except one attached to a player's card:
  // RRG 1.8 "Attachment" (p. 8), "Only the player who controls the card to which that attachment is attached can
  // trigger abilities or pay costs on that attachment." One attached to an enemy or a scheme, which no player controls,
  // stays any player's. Text that names who may trigger it (`triggerableBy`) replaces this as it does the rule above.
  if (!named && controller === null && instance.attachedTo !== null) {
    const hostController = controllerOf(ctx.state, instance.attachedTo);
    if (hostController !== null && hostController !== command.playerId) {
      return engineError("no_valid_target", "only the player it is attached to can use that card", command);
    }
  }
  // An obligation is controlled by nobody, but RRG 1.8 "Obligation" (p. 30): "Only the player with the obligation in
  // their play area can trigger abilities or pay costs on that obligation" (MC10 p. 17 says the same of its Alter-Ego
  // Action), however it got there.
  if (!named && mustCardOf(ctx.state, command.cardInstanceId).type === "obligation") {
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
  // An ability's resources are paid for the card whose ability it is unless its cost picks a card to pay for, so a
  // resource "for your 'Optic Blast' ability" (`generatesFor`, Ruby Quartz Visor 33003) sees that card and binds
  // `paidFor` (docs/phase7-wave6.md §3.30).
  const payingFor = plan.payingFor ?? command.cardInstanceId;
  const pool = priceOf(ctx, command.playerId, command.payment, null, payingFor);
  if (isFault(pool)) return engineError(pool.code, pool.message, command);
  if (!satisfies(pool, plan.requirement)) {
    return engineError(
      "insufficient_resources",
      `need ${requirementTotal(plan.requirement)}, paid ${poolTotal(pool)}`,
      command,
    );
  }
  const vars = resourceVars(pool, plan.cost ?? definition.cost, plan.requirement, command.costSelection?.resources);
  if (isFault(vars)) return engineError(vars.code, vars.message, command);

  // Read before paying: paying may exhaust or discard the source.
  const sources = {
    ...paymentSourceVars(ctx, command.playerId, command.payment),
    ...paidCardVars(
      ctx,
      command.playerId,
      command.payment,
      payingFor,
      pool,
      plan.requirement,
      plan.cost ?? definition.cost,
      vars,
    ),
  };
  // The types the ability reads of its own payment, each wild as its player declares it (docs/phase7-wave8.md §3.62).
  const settled = settleAbilityPaidTypes(
    ctx,
    definition,
    payingFor,
    pool,
    { ...plan.vars, ...vars, ...sources },
    plan.requirement,
    plan.cost ?? definition.cost,
    command.wildAs,
  );
  if (isFault(settled)) return engineError(settled.code, settled.message, command);
  const bindings = withSelfHost(ctx.state, command.cardInstanceId, plan.bindings);
  const spent = payPayment(ctx, command.playerId, command.payment, payingFor);
  pushActionAbility(
    ctx,
    command.cardInstanceId,
    command.abilityId,
    command.playerId,
    bindings,
    settled.vars,
    settled.types?.undeclared,
  );
  logAbilityWildTypes(ctx, command.playerId, command.cardInstanceId, command.abilityId, settled.types);
  payCost(ctx, command.cardInstanceId, command.playerId, definition.cost, plan);
  const unpayable = thwartCostUnpayableAfterPaying(ctx, definition, command);
  if (unpayable) return unpayable;
  announceResourcesSpent(ctx, command.playerId, spent, command.cardInstanceId, "ability");
  return null;
}

function usableCharacter(ctx: Ctx, playerId: PlayerId, characterId: InstanceId, command: Command): EngineError | null {
  const player = mustPlayer(ctx.state, playerId);
  const instance = getInstance(ctx.state, characterId);
  if (!instance) return engineError("unknown_instance", `no instance ${characterId}`, command);
  const isIdentity = player.identity.instanceId === characterId;
  const isOwnAlly = player.playArea.includes(characterId) && isAlly(ctx.state, characterId);
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
  /** Receives what the payment spent, for the caller to announce once the power is on the stack. */
  spentOut: SpentPayment[],
  by: BasicPowerBy = OWN_BASIC_POWER,
): EngineError | null {
  const cost = basicPowerCost(ctx.state, ctx.deps, characterId, power);
  if (!cost || by.assumeCostPaid === true) return null;
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
  spentOut.push(payPayment(ctx, command.playerId, payment));
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
 *
 * `column`: the stat the damage is printed under, when it is not the power's own (a thwart made with ATK).
 */
export function pushConsequentialDamage(
  ctx: Ctx,
  characterId: InstanceId,
  kind: "attack" | "thwart",
  column: "attack" | "thwart" = kind,
): ReportTarget | null {
  const amount = consequentialAmount(ctx, characterId, kind, column);
  if (amount === null || amount <= 0) return null;
  const frameId = pushEvent(ctx, consequentialDamageEvent(characterId, amount, kind));
  return { frameId, prefix: kind };
}

/**
 * The consequential damage `characterId` takes after it attacks or thwarts: its printed value plus the standing
 * modifiers on it, never below 0. Null for a character that takes no consequential damage at all (a hero, an ally
 * treated as a minion).
 *
 * `column` is the stat the printed value is read under. RRG 1.8 "Assault" (p. 8): "If the thwarting character is an
 * ally, it takes the consequential damage listed under its ATK instead of its THW after the thwart." It is still
 * damage from thwarting, so the standing modifiers read are the thwart's ("after it thwarts"), not the attack's.
 */
function consequentialAmount(
  ctx: Ctx,
  characterId: InstanceId,
  kind: "attack" | "thwart",
  column: "attack" | "thwart" = kind,
): number | null {
  const card = cardOf(ctx.state, characterId);
  const treated = getInstance(ctx.state, characterId)?.treatedAs;
  // A minion treated as an ally "takes 1 consequential damage after it thwarts or attacks" (§3.29 of wave 4); an ally
  // treated as a minion takes none.
  if (treated) {
    if (treated.kind !== "ally") return null;
  } else if (card?.type !== "ally") return null;
  const printed =
    treated?.kind === "ally"
      ? treated.consequential
      : card?.type === "ally"
        ? column === "attack"
          ? card.consequentialDamage.attack
          : card.consequentialDamage.thwart
        : 0;
  // "Takes +1 consequential damage after it attacks" (Enraged): a modifier on the printed value.
  return Math.max(
    0,
    printed +
      statBonus(ctx.state, ctx.deps, characterId, kind === "attack" ? "consequentialAttack" : "consequentialThwart"),
  );
}

const consequentialDamageEvent = (
  characterId: InstanceId,
  amount: number,
  kind: "attack" | "thwart",
): TriggerEvent => ({
  kind: "dealDamage",
  targetInstanceId: characterId,
  amount,
  sourceInstanceId: characterId,
  fromAttack: false,
  consequential: true,
  consequentialFrom: kind,
});

/**
 * "Havok takes +1 consequential damage for this attack" (Havok, `storm` 36014) when his consequential damage is 0: the
 * one-shot `modifyConsequentialDamage` has no pending damage event to change, because `pushConsequentialDamage` pushes
 * none at 0. This creates it, as if it had been pushed with the power: directly beneath the character's attack or
 * thwart event(s) still in progress, so it resolves after them (RRG 1.8 "Consequential Damage", p. 13), and those
 * events report their results into it (`attack.`/`thwart.`, as `pushConsequentialDamage` wires them). Its amount is
 * the character's consequential value (standing modifiers included) plus `delta`.
 *
 * Returns the amount created, or null when nothing was (no attack or thwart of this character in progress, a
 * character that takes no consequential damage, or a total of 0 or less). docs/phase7-wave6.md §3.31.
 */
export function insertConsequentialDamage(
  ctx: Ctx,
  characterId: InstanceId,
  delta: number,
): { readonly from: number; readonly to: number } | null {
  const stack = ctx.state.stack;
  const powerIndexes = stack.flatMap((frame, index) =>
    frame.kind === "event" &&
    !frame.cancelled &&
    (frame.stage === "interrupts" || frame.stage === "apply") &&
    ((frame.event.kind === "attack" && frame.event.attackerInstanceId === characterId) ||
      (frame.event.kind === "thwart" && frame.event.thwarterInstanceId === characterId))
      ? [index]
      : [],
  );
  if (powerIndexes.length === 0) return null;
  const first = stack[powerIndexes[0]!]!;
  const kind = first.kind === "event" && first.event.kind === "thwart" ? "thwart" : "attack";
  // A thwart made with ATK reads the value under ATK (RRG 1.8 "Assault", p. 8), as `basicThwartWith` does.
  const withAtk = first.kind === "event" && first.event.kind === "thwart" && first.event.useAtk === true;
  const from = consequentialAmount(ctx, characterId, kind, withAtk ? "attack" : kind);
  if (from === null) return null;
  const to = Math.max(0, from + delta);
  if (to <= 0) return null;
  const frame = eventFrame(ctx, consequentialDamageEvent(characterId, to, kind));
  const report: ReportTarget = { frameId: frame.frameId, prefix: kind };
  const at = Math.max(...powerIndexes) + 1;
  const current = ctx.state.stack;
  ctx.state = {
    ...ctx.state,
    stack: [
      ...current
        .slice(0, at)
        .map((f, index) =>
          powerIndexes.includes(index) && f.kind === "event" && f.reportTo === null ? { ...f, reportTo: report } : f,
        ),
      frame,
      ...current.slice(at),
    ],
  };
  emit(ctx, { type: "framePushed", frameId: frame.frameId, frame: frame.kind, description: describeFrame(frame) });
  return { from, to };
}

/**
 * How a basic attack or thwart comes to be made. Absent, it is the player's own command on their turn.
 *
 * `instructed` (docs/phase7-wave8.md §3.64, `EffectSpec basicPowerBy`): a card's effect has the player make it ("that
 * player makes a basic attack or thwart with a character they control", Cell Phone 47019). It is the ordinary basic
 * power in every respect but whose turn it is: the effect resolves in any action window, so the player's own turn is
 * not asked for (RRG 1.8 "Action", p. 6). Everything else is checked and paid as usual.
 *
 * `assumeCostPaid`: the power's own additional cost (`basicPowerCosts`) is taken as paid. Only for asking whether a
 * power could be made, on a scratch context; the caller checks the cost's affordability itself.
 */
export interface BasicPowerBy {
  readonly instructed?: boolean;
  readonly assumeCostPaid?: boolean;
}
const OWN_BASIC_POWER: BasicPowerBy = {};

/**
 * A basic power whose extra cost spent cards announces them on top of everything the power pushed, so "after you spend
 * this card" resolves before the power does (docs/phase7-wave2.md §12) — also when a stun or confusion cancels the
 * power, since its costs are still paid (RRG 1.8 "Stun, Stunned", p. 41; "Confuse, Confused", p. 13).
 */
function withSpentAnnounced<C extends Command & { type: "basicAttack" | "basicThwart" }>(
  run: (ctx: Ctx, command: C, spent: SpentPayment[], by: BasicPowerBy) => EngineError | null,
  characterOf: (command: C) => InstanceId,
): (ctx: Ctx, command: C, by?: BasicPowerBy) => EngineError | null {
  return (ctx, command, by = OWN_BASIC_POWER) => {
    const spent: SpentPayment[] = [];
    const error = run(ctx, command, spent, by);
    if (!error)
      announceResourcesSpent(
        ctx,
        command.playerId,
        spent.reduce(joinSpent, NOTHING_SPENT),
        characterOf(command),
        "ability",
      );
    return error;
  };
}

export const basicAttack = withSpentAnnounced(basicAttackPaying, (command) => command.attackerInstanceId);
export const basicThwart = withSpentAnnounced(basicThwartPaying, (command) => command.thwarterInstanceId);
/**
 * A basic thwart whose additional thwart cost was just paid (docs/phase7-wave5.md §4.1 Q27, `thwart-cost.ts`
 * `executeSettleBasicThwartCost`): checked again against the game as it now is, then its own costs are paid and it is
 * initiated as usual, its thwart events marked as paid for.
 */
export const commitPrepaidBasicThwart = withSpentAnnounced(
  (ctx: Ctx, command: Command & { type: "basicThwart" }, spent: SpentPayment[], by: BasicPowerBy) =>
    basicThwartWith(ctx, command, spent, true, by),
  (command) => command.thwarterInstanceId,
);

function basicAttackPaying(
  ctx: Ctx,
  command: Command & { type: "basicAttack" },
  spent: SpentPayment[],
  by: BasicPowerBy,
): EngineError | null {
  const invalid = by.instructed === true ? null : requireActivePlayer(ctx.state, command.playerId, command);
  if (invalid) return invalid;
  const unusable = usableCharacter(ctx, command.playerId, command.attackerInstanceId, command);
  if (unusable) return unusable;

  const shares = dividedShares(
    ctx,
    command,
    command.attackerInstanceId,
    command.targetInstanceId,
    "attack",
    "atk",
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
    // An enemy in a closed in-play scenario area (the mission area, docs/phase7-wave8.md §3.33) is out of reach of a
    // basic attack: MC45 pp. 5–6 deal damage there only from a mission attempt's pool. See `inClosedScenarioPlayArea`.
    if (inClosedScenarioPlayArea(ctx.state, targetInstanceId)) {
      return engineError("no_valid_target", "that enemy is in an area basic attacks cannot reach", command);
    }
    // The Once and Future Kang insert: "Players cannot attack or defend enemies in other game areas" (§3.1).
    if (!sameGameArea(areaOfPlayer(ctx.state, command.playerId), areaOfCard(ctx.state, targetInstanceId))) {
      return engineError("no_valid_target", "that enemy is in another game area", command);
    }
    if (!canAttack(ctx.state, command.attackerInstanceId, targetInstanceId, ctx.deps)) {
      return engineError("no_valid_target", "a guard minion blocks attacks against the villain", command);
    }
    // RRG 1.8 "Target" (p. 43): "A target that 'cannot take damage' is not a valid target for an ability or game
    // function whose only effect on that target is to deal it damage." Ruling Mar 19, 2026 (2): that "applies equally
    // to basic powers", whatever the attacker's own abilities would do after the attack. Asked of the attacker, the
    // source of a basic attack's damage, so a rule scoped by source ("from player cards", "can only take damage
    // from …") is read as the damage itself would read it, and with the attack it would be ("unless the attacker … has
    // the [X] trait, or the attack has ranged", docs/phase7-wave7.md §3.30): a basic attack is made by no card.
    const attack = {
      attackerInstanceId: command.attackerInstanceId,
      cardInstanceId: null,
      keywords: attackKeywordsOf(ctx.state, ctx.deps, { attackerInstanceId: command.attackerInstanceId, basic: true }),
    };
    if (cannotTakeDamage(ctx.state, ctx.deps, targetInstanceId, [command.attackerInstanceId], attack)) {
      return engineError("no_valid_target", "that enemy cannot take damage from this attack", command);
    }
  }

  if (characterProfile(ctx.state, command.attackerInstanceId, ctx.deps)?.missing.includes("atk")) {
    return engineError("no_valid_target", "a character with a printed '—' ATK cannot attack", command);
  }
  const unpaid = payBasicPowerCost(ctx, command, command.attackerInstanceId, "attack", spent, by);
  if (unpaid) return unpaid;
  exhaustCard(ctx, command.attackerInstanceId);
  if (statusActive(ctx.state, command.attackerInstanceId, "stunned", ctx.deps)) {
    // RRG "Stun": the attack is cancelled but its costs (exhausting) are still paid.
    announceStatusDiscarded(ctx, discardStatusCards(ctx, command.attackerInstanceId, "stunned", "cancelledAttack"));
    return null;
  }
  const attackerProfile = characterProfile(ctx.state, command.attackerInstanceId, ctx.deps);
  if (!attackerProfile) return engineError("unknown_instance", "attacker has no stats", command);
  if (attackerProfile.missing.includes("atk")) {
    return engineError("no_valid_target", "a character with a printed '—' ATK cannot attack", command);
  }
  announceBasicPower(ctx, command.attackerInstanceId, "attack", command.playerId);
  const consequential = pushConsequentialDamage(ctx, command.attackerInstanceId, "attack");
  const attackFrames = !command.divide
    ? [
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
        ),
      ]
    : // "Wasp is considered to attack each target affected by her divided basic attack" (FAQ "Wasp (#1C)"): one attack
      // per target, in the order given, so each retaliate resolves in the order of her choice.
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
  // "For its next basic thwart or attack" (§3.39): a waiting bonus starts applying with this attack.
  startNextBasicPowerEffects(ctx, command.attackerInstanceId, "attack", attackFrames);
  announceBasicPowerUsing(ctx, command.attackerInstanceId, "attack", command.playerId);
  return null;
}

function basicThwartPaying(
  ctx: Ctx,
  command: Command & { type: "basicThwart" },
  spent: SpentPayment[],
  by: BasicPowerBy,
): EngineError | null {
  return basicThwartWith(ctx, command, spent, false, by);
}

/** `thwartCostPaid`: the schemes' additional thwart cost was already paid (`commitPrepaidBasicThwart`). */
function basicThwartWith(
  ctx: Ctx,
  command: Command & { type: "basicThwart" },
  spent: SpentPayment[],
  thwartCostPaid: boolean,
  by: BasicPowerBy,
): EngineError | null {
  const invalid = by.instructed === true ? null : requireActivePlayer(ctx.state, command.playerId, command);
  if (invalid) return invalid;
  const unusable = usableCharacter(ctx, command.playerId, command.thwarterInstanceId, command);
  if (unusable) return unusable;
  if (cannotThwart(ctx.state, ctx.deps, command.playerId, undefined, command.thwarterInstanceId)) {
    return engineError("no_valid_target", "you cannot thwart", command);
  }

  // RRG 1.8 "Assault" (p. 8): "When a character makes a basic thwart against a scheme with the assault keyword, that
  // character uses its ATK instead of its THW." A divided basic thwart is one basic thwart, so any scheme of it with
  // assault makes the whole thwart use ATK: its shares total ATK (docs/phase7-wave7.md §3.3, §4.1 Q3).
  const assault = (command.divide?.map((share) => share.targetInstanceId) ?? [command.schemeInstanceId]).some(
    (schemeId) => hasKeyword(ctx.state, schemeId, "assault", ctx.deps),
  );
  const shares = dividedShares(
    ctx,
    command,
    command.thwarterInstanceId,
    command.schemeInstanceId,
    "thwart",
    assault ? "atk" : "thw",
    command.divide,
  );
  if ("code" in shares) return shares;
  // RRG 1.8 "Confuse, Confused" (p. 13): "A confused character can attempt to thwart or use a thwart ability even if it
  // has no valid target for a thwart." So crisis and patrol do not refuse a confused character's basic thwart against
  // the main scheme: the attempt removes the confused status card and no threat (below).
  const confused = statusActive(ctx.state, command.thwarterInstanceId, "confused", ctx.deps);
  for (const { targetInstanceId: schemeId } of shares) {
    const schemeCard = cardOf(ctx.state, schemeId);
    const isMainScheme = mainSchemeStateOf(ctx.state, schemeId) !== undefined;
    const isSideScheme =
      (schemeCard?.type === "side_scheme" || schemeCard?.type === "player_side_scheme") &&
      ctx.state.villainArea.includes(schemeId);
    if (!isMainScheme && !isSideScheme) {
      return engineError("no_valid_target", "target is not a scheme in play", command);
    }
    // A `cannotThwart` rule scoped to some schemes ("cannot thwart side schemes", Life-Size Decoy): refused before any
    // cost, like the unscoped rule above, and for a confused thwarter too, as that rule is.
    if (cannotThwart(ctx.state, ctx.deps, command.playerId, schemeId, command.thwarterInstanceId)) {
      return engineError("no_valid_target", "you cannot thwart that scheme", command);
    }
    // "Your hero's basic thwart power (THW) can only remove threat from the scheme with the most threat."
    // (`RuleSpec basicThwartTargets`, docs/phase7-wave5.md §3.22.)
    if (!basicThwartTargetAllowed(ctx.state, ctx.deps, command.thwarterInstanceId, schemeId)) {
      return engineError("no_valid_target", "this character's basic thwart cannot target that scheme", command);
    }
    // "they cannot target any game elements in the other game areas" (The Once and Future Kang insert; §3.1).
    const thwarterArea = areaOfPlayer(ctx.state, command.playerId);
    if (!sameGameArea(thwarterArea, areaOfCard(ctx.state, schemeId))) {
      return engineError("no_valid_target", "that scheme is in another game area", command);
    }
    // RRG "Crisis Icon": while any crisis icon is in play, player cards cannot remove threat from the main scheme. For a
    // divided thwart this holds "even if the card [...] is removed from play during her basic thwart's resolution" (FAQ
    // "Wasp (#1C)"), which checking every share now gives.
    // With a glider-style focus only that main scheme is protected (docs/phase7-wave5.md §3.3).
    const protectedScheme = isProtectedMainScheme(ctx.state, ctx.deps, schemeId);
    if (
      protectedScheme &&
      !confused &&
      iconsInPlay(ctx.state, ctx.deps, "crisis", thwarterArea) > 0 &&
      !characterIgnores(ctx.state, ctx.deps, command.thwarterInstanceId, "crisis", true)
    ) {
      return engineError("no_valid_target", "a crisis icon blocks thwarting the main scheme", command);
    }
    // RRG 1.8 "Patrol" (p. 32): the engaged player "cannot use cards they control to thwart the main scheme" — checked
    // per share, as the crisis icon is (FAQ "Wasp (#1C)", p. 61, names both). docs/phase7-wave3.md §3.5.
    if (
      protectedScheme &&
      !confused &&
      patrolledBy(ctx.state, ctx.deps, command.playerId) &&
      !characterIgnores(ctx.state, ctx.deps, command.thwarterInstanceId, "patrol", true)
    ) {
      return engineError(
        "no_valid_target",
        "a minion with patrol engaged with you blocks thwarting the main scheme",
        command,
      );
    }
    // "Characters other than [X] cannot remove threat from [this scheme]" (`RuleSpec threatCannotBeRemoved.exceptBy`,
    // docs/phase7-wave7.md §3.51): a scheme this character cannot remove threat from is not a legal target of its
    // basic thwart (docs/phase7-wave5.md §4.1 Q18; RRG 1.8 "Thwart", p. 44: a basic thwart needs "a scheme with at
    // least one threat for the character to remove"), checked per share like the crisis icon, so a divided thwart
    // cannot include it. A confused character may still attempt it (RRG 1.8 "Confuse, Confused", p. 13).
    if (!confused && characterCannotRemoveThreat(ctx.state, ctx.deps, schemeId, command.thwarterInstanceId)) {
      return engineError("no_valid_target", "this character cannot remove threat from that scheme", command);
    }
  }

  // The Red House's optional "they may use their ATK instead of their THW" is `thwartWithAtk` (docs/phase7-wave2.md
  // §3.11), for an undivided thwart only; assault (above) needs no flag.
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
  const scheme = mustInstance(ctx.state, command.schemeInstanceId);
  if (scheme.threat < 1 && !confused) {
    return engineError("no_valid_target", "scheme has no threat to remove", command);
  }
  // docs/phase7-wave5.md §4.1 Q18, Q27, Q29 (RRG 1.8 "Cost", p. 13; "Initiating Abilities", p. 24, steps 3 and 5):
  // an additional cost to thwart these schemes is paid together with this thwart's own costs. It must be affordable,
  // in total across a divided thwart's schemes, from what paying the own costs would leave (else the schemes are not
  // legal targets); then it is asked for *first*, and the own costs are paid only once it has been
  // (`commitPrepaidBasicThwart`), so declining it leaves the thwarter unexhausted and nothing thwarted.
  // §4.1 Q40 (RRG 1.8 "Confuse, Confused", p. 13: "Costs associated with the thwart attempt, including exhausting the
  // character, must still be paid"): a confused thwarter is asked for it too, and must be able to pay it (Q18); once it
  // is paid, the confused status card replaces the thwart below.
  if (!thwartCostPaid) {
    const schemeIds = shares.map((share) => share.targetInstanceId);
    const cost = thwartCostTotal(ctx.state, ctx.deps, schemeIds);
    if (cost) {
      const afterOwnCosts = createCtx(ctx.state, ctx.deps);
      const ownUnpaid = payBasicPowerCost(afterOwnCosts, command, command.thwarterInstanceId, "thwart", [], by);
      if (ownUnpaid) return ownUnpaid;
      exhaustCard(afterOwnCosts, command.thwarterInstanceId);
      if (!thwartCostsPayable(afterOwnCosts.state, ctx.deps, command.playerId, schemeIds)) {
        return engineError("no_valid_target", "you cannot pay the additional cost to thwart that scheme", command);
      }
      askBasicThwartCost(ctx, command, schemeIds, cost, by.instructed === true);
      return null;
    }
  }
  const unpaid = payBasicPowerCost(ctx, command, command.thwarterInstanceId, "thwart", spent, by);
  if (unpaid) return unpaid;

  exhaustCard(ctx, command.thwarterInstanceId);
  if (confused) {
    // RRG "Confuse": the thwart is cancelled but its costs are still paid (with any additional cost, §4.1 Q40). It is
    // not considered to have thwarted, so an ally takes no consequential damage (RRG 1.8 "Ally", p. 7).
    announceStatusDiscarded(
      ctx,
      discardStatusCards(ctx, command.thwarterInstanceId, "confused", "cancelledSchemeOrThwart"),
    );
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
  announceBasicPower(ctx, command.thwarterInstanceId, "thwart", command.playerId, thwartStat);
  const consequential = pushConsequentialDamage(
    ctx,
    command.thwarterInstanceId,
    "thwart",
    useAtk ? "attack" : "thwart",
  );
  const framesBefore = new Set(ctx.state.stack.map((frame) => frame.frameId));
  const thwartFrames = !command.divide
    ? [
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
        ),
      ]
    : // "simultaneously remove threat from each scheme that Wasp chooses" (FAQ "Wasp (#1C)"): one thwart per scheme.
      pushEvents(
        ctx,
        shares.map(({ targetInstanceId, amount }) => ({
          kind: "thwart" as const,
          thwarterInstanceId: command.thwarterInstanceId,
          schemeInstanceId: targetInstanceId,
          playerId: command.playerId,
          basic: true,
          amount,
          dividedAmong: shares.map((share) => share.targetInstanceId),
          ...(useAtk ? { useAtk: true as const } : {}),
        })),
        consequential,
      );
  // "For its next basic thwart or attack" (§3.39): a waiting bonus starts applying with this thwart.
  startNextBasicPowerEffects(ctx, command.thwarterInstanceId, "thwart", thwartFrames);
  // docs/phase7-wave5.md §4.1 Q27: its additional cost is paid already; the thwart does not ask for it again.
  if (thwartCostPaid) {
    for (const frame of ctx.state.stack) {
      if (framesBefore.has(frame.frameId) || frame.kind !== "event" || frame.event.kind !== "thwart") continue;
      updateFrame(ctx, frame.frameId, (f) => (f.kind === "event" ? { ...f, thwartCostPaid: true } : f));
    }
  }
  announceBasicPowerUsing(ctx, command.thwarterInstanceId, "thwart", command.playerId, thwartStat);
  return null;
}

/**
 * The targets of a basic power: the one target, or a divided power's shares (docs/phase7-wave2.md §3.7). A division
 * needs the character's `divideBasicPower` rule, distinct targets starting with the command's own, whole shares of at
 * least 1, and shares that total the power's current value: the character's `stat`, which is ATK for a thwart made
 * with ATK.
 */
function dividedShares(
  ctx: Ctx,
  command: Command,
  characterId: InstanceId,
  firstTarget: InstanceId,
  power: "attack" | "thwart",
  stat: "atk" | "thw",
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
  const value = dividedBasicPowerValue(ctx.state, ctx.deps, command.playerId, characterId, power, stat, targets);
  const total = divide.reduce((sum, share) => sum + share.amount, 0);
  if (total !== value) return engineError("no_valid_target", `the shares must total ${value}`, command);
  return divide;
}

/**
 * What `characterId` has to divide when it divides its basic `power` among `targets`: its `stat` as it reads during
 * that use, which is what the shares of the division must total (`dividedShares`). Read on a scratch copy of the game,
 * so nothing here changes it.
 *
 * - **A bonus waiting on this power counts** ("for its next basic thwart or attack", "+1 THW and +1 ATK for this
 *   use"; `LastingDuration nextBasicPower`): the power's own event frames start it (`startNextBasicPowerEffects`),
 *   which is after a division's fixed shares are set, so it is read as started here.
 * - **A thwart's stat is read while that thwart is being made**: "+1 THW while making a basic thwart against this
 *   scheme" counts when the scheme is one of the division's (card text; RRG 1.8 "Modifiers", p. 29: a value is
 *   recalculated with every active modifier; "Assault", p. 8, and docs/phase7-wave7.md §4.1 Q3: a divided basic
 *   thwart is one basic thwart). The scratch copy has the thwart on its stack, as the undivided thwart has when it
 *   reads its own THW.
 * - **An attack's stat is read while that attack is being made**, for the same reason: "+1 ATK while making a basic
 *   attack" counts toward what is divided, as it counts for the undivided attack, which reads its ATK with its own
 *   event on the stack (RRG 1.8 FAQ "Wasp (#1C)", p. 61: the divided attack is her basic attack). The scratch copy has
 *   the attack on the division's first target on its stack, the first attack the command pushes. A bonus that reads
 *   which enemy is attacked (`attackInProgress.target`) is therefore read against that first target alone; no
 *   official source says how such a bonus divides, and an attack event names one target where a thwart's names every
 *   scheme (`dividedAmong`).
 */
export function dividedBasicPowerValue(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  characterId: InstanceId,
  power: "attack" | "thwart",
  stat: "atk" | "thw",
  targets: readonly InstanceId[],
): number {
  const reading = createCtx(state, deps);
  reading.state = {
    ...reading.state,
    lastingEffects: reading.state.lastingEffects.map((effect) =>
      effect.duration.kind === "nextBasicPower" &&
      effect.duration.characterIds.includes(characterId) &&
      effect.duration.powers.includes(power)
        ? { ...effect, duration: { kind: "endOfPhase" as const } }
        : effect,
    ),
  };
  const [firstTarget] = targets;
  if (power === "thwart" && firstTarget !== undefined) {
    pushEvent(reading, {
      kind: "thwart",
      thwarterInstanceId: characterId,
      schemeInstanceId: firstTarget,
      playerId,
      basic: true,
      dividedAmong: targets,
      ...(stat === "atk" ? { useAtk: true as const } : {}),
    });
  }
  if (power === "attack" && firstTarget !== undefined) {
    pushEvent(reading, {
      kind: "attack",
      attackerInstanceId: characterId,
      targetInstanceId: firstTarget,
      playerId,
      basic: true,
    });
  }
  return characterProfile(reading.state, characterId, deps)?.[stat] ?? 0;
}

export function basicRecover(ctx: Ctx, command: Command & { type: "basicRecover" }): EngineError | null {
  const invalid = requireActivePlayer(ctx.state, command.playerId, command);
  if (invalid) return invalid;
  const player = mustPlayer(ctx.state, command.playerId);
  if (player.identity.form !== "alterEgo") {
    return engineError("wrong_form", "recovery is an alter-ego power", command);
  }
  // "Attached identity cannot … recover" (Wrapped in Metal; `RuleSpec cannotRecover`, docs/phase7-wave6.md §3.14). RRG
  // 1.8 "'Cannot'" (p. 11) is absolute, so the basic recovery is refused outright, before exhausting anything.
  if (cannotRecover(ctx.state, ctx.deps, command.playerId)) {
    return engineError("no_valid_target", "you cannot recover", command);
  }
  const identity = mustInstance(ctx.state, player.identity.instanceId);
  if (identity.exhausted) return engineError("already_exhausted", "identity is exhausted", command);
  if (identity.damage === 0) {
    return engineError("no_valid_target", "an identity with no damage cannot recover", command);
  }
  // A basic recovery is the identity's own power, so its source is the identity, a player card: "cannot be healed (by
  // player card effects)" on the identity stops it, and like an identity with no damage (RRG 1.8 "Recover", p. 36) it
  // cannot recover at all rather than exhaust to heal nothing (docs/phase7-wave6.md §3.12).
  if (cannotBeHealed(ctx.state, ctx.deps, player.identity.instanceId, player.identity.instanceId)) {
    return engineError("no_valid_target", "this identity cannot be healed", command);
  }
  const profile = characterProfile(ctx.state, player.identity.instanceId, ctx.deps);
  if (!profile) return engineError("unknown_instance", "identity has no stats", command);
  exhaustCard(ctx, player.identity.instanceId);
  // The healing is an event of its own (docs/phase7-wave6.md §3.40), beneath its `basicPowerUsing` and above its
  // `basicPowerUsed`, so "discard this card instead of healing damage" (Death Factor) replaces only the healing: the
  // identity is still exhausted and has still made a basic recovery (§4.1 Q20). Unheard, it heals at once as before.
  const identityId = player.identity.instanceId;
  const recovery: TriggerEvent = { kind: "basicRecovery", characterInstanceId: identityId, playerId: command.playerId };
  const using: TriggerEvent = { ...recovery, kind: "basicPowerUsing", power: "recover", stat: "rec" };
  if (!heard(ctx.state, ctx.deps, recovery) && !heard(ctx.state, ctx.deps, using)) {
    healDamage(ctx, identityId, profile.rec, identityId);
    announceBasicPower(ctx, identityId, "recover", command.playerId);
    return null;
  }
  announceBasicPower(ctx, identityId, "recover", command.playerId);
  pushEvent(ctx, recovery);
  announceBasicPowerUsing(ctx, identityId, "recover", command.playerId);
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
  power: BasicPowerName,
  playerId: PlayerId,
  stat: StatName = BASIC_POWER_STAT[power],
): void {
  const event: TriggerEvent = { kind: "basicPowerUsed", characterInstanceId: characterId, power, stat, playerId };
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
  power: BasicPowerName,
  playerId: PlayerId,
  stat: StatName = BASIC_POWER_STAT[power],
): void {
  const event: TriggerEvent = { kind: "basicPowerUsing", characterInstanceId: characterId, power, stat, playerId };
  if (heard(ctx.state, ctx.deps, event)) pushEvent(ctx, event);
}

/**
 * A substitution made while a basic power is being used ("uses their THW instead of their ATK", "use its ATK instead
 * of its DEF") rewrites the stat on that use's announcements still on the stack, so whatever answers them later reads
 * the stat actually powering the use (docs/phase7-wave8.md §4.1 Q54). The nearest announcement of each kind is this
 * use's (the top of the stack first; `characterId` null is whoever is using `power`): a basic power made inside another's window has resolved or sits above it.
 */
export function setBasicPowerStat(
  ctx: Ctx,
  characterId: InstanceId | null,
  power: BasicPowerName,
  stat: StatName,
): void {
  for (const kind of ["basicPowerUsing", "basicPowerUsed"] as const) {
    const frame = ctx.state.stack.find(
      (f) =>
        f.kind === "event" &&
        f.event.kind === kind &&
        (characterId === null || f.event.characterInstanceId === characterId) &&
        f.event.power === power,
    );
    if (frame?.kind !== "event" || frame.event.kind !== kind || frame.event.stat === stat) continue;
    setFrame(ctx, { ...frame, event: { ...frame.event, stat } });
  }
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

/**
 * The sum a `discardFromHand` cost's `combined` threshold measures over these cards (`DiscardCombined`): each card's
 * printed resource cost, read off its card data wherever it is. An X cost is stored as 0 and a card with no printed
 * cost (a resource) adds 0.
 */
export function discardCombinedTotal(state: GameState, ids: readonly InstanceId[], combined: DiscardCombined): number {
  return ids.reduce((sum, id) => sum + discardCombinedValue(state, id, combined), 0);
}

/**
 * The cards a "discard N cards from your hand →" cost (`AbilityCost.discardFromHand`) could be paid with, in hand
 * order: every card `planCost` would accept as a pick. The paying player's hand, or every hand for an alliance card
 * (`paidAsGroup`); never the source card itself, a card the cost's `filter` leaves out, or one that "cannot be chosen
 * to be discarded".
 */
export function handDiscardCandidates(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  cost: AbilityCost | undefined,
): readonly InstanceId[] {
  const discard = cost?.discardFromHand;
  if (!discard) return [];
  const context: EffectContext = { selfInstanceId: sourceId, controllerId: playerId, event: null, bindings: {}, deps };
  const hands = paidAsGroup(state, deps, sourceId)
    ? [playerId, ...playerOrder(state).flatMap((p) => (p.playerId === playerId ? [] : [p.playerId]))]
    : [playerId];
  return hands
    .flatMap((id) => getPlayer(state, id)?.hand ?? [])
    .filter(
      (id) =>
        id !== sourceId &&
        (!discard.filter || matchesQuery(state, id, discard.filter, context)) &&
        !cannotChooseToDiscard(state, deps, id),
    );
}

/**
 * Default picks for a hand-discard cost, so an interrupt or response with one can be judged payable in a timing window
 * (`costPayable`), as `defaultInPlayPicks` does for cards in play: the first `min` candidates, or for a `combined`
 * threshold the largest shares until it is reached. Undefined when the cost has no such component. With too few
 * candidates the picks fall short and `planCost` reports why the cost can't be paid.
 */
export function defaultHandDiscardPicks(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  cost: AbilityCost | undefined,
): readonly InstanceId[] | undefined {
  const discard = cost?.discardFromHand;
  if (!discard) return undefined;
  const candidates = handDiscardCandidates(state, deps, sourceId, playerId, cost);
  const combined = discard.combined;
  if (!combined) return candidates.slice(0, discard.min);
  const largest = [...candidates].sort(
    (a, b) => discardCombinedValue(state, b, combined) - discardCombinedValue(state, a, combined),
  );
  const picks: InstanceId[] = [];
  let total = 0;
  for (const id of largest) {
    if (total >= combined.atLeast && picks.length >= discard.min) break;
    picks.push(id);
    total += discardCombinedValue(state, id, combined);
  }
  return picks;
}

/** One card's share of `discardCombinedTotal`. */
export function discardCombinedValue(state: GameState, id: InstanceId, combined: DiscardCombined): number {
  switch (combined.measure) {
    case "printedCost":
      return printedCostOf(state, cardOf(state, id));
  }
}
