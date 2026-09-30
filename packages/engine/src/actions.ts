import { abilityId as asAbilityId, requirementResources, type AbilityId, type AnyCard } from "@mc/content";
import {
  DEFAULT_DEPS,
  type AbilityCost,
  type AbilityDefinition,
  type AbilityTriggerSpec,
  type CostModifierSpec,
  type EngineDeps,
  type ResourceGeneration,
  type ResourceMultiplierSpec,
} from "./abilities.js";
import type { ChoiceOption } from "./choices.js";
import type { BasicPowerShare, Command, CostChoices, CostSelection, Payment, ResourceAbilityUse } from "./commands.js";
import { createCtx, emit, moveCard, updateFrame, updateInstance, type Ctx } from "./ctx.js";
import {
  consumeCostReductions,
  costReductionFor,
  dealEncounterCardTo,
  discardFromDeckAsCost,
  discardFromHand,
  discardFromPlay,
  discardRandomFromHand,
  exhaustCard,
  giveStatus,
  healDamage,
  permanentStopsLeaving,
  removeCounters,
  setForm,
} from "./effects.js";
import { engineError, type EngineError, type EngineErrorCode } from "./errors.js";
import { finishTurn } from "./flow.js";
import { statBonus } from "./modifiers.js";
import {
  canDivideBasicPower,
  cannotChangeForm,
  cannotChooseToDiscard,
  cannotLeavePlay,
  cannotPlayCard,
  cannotThwart,
  cannotTriggerAction,
  triggeredAbilityForbidden,
  iconsInPlay,
  mayThwartWithAtk,
  patrolledBy,
  restrictedLimitFor,
} from "./rules.js";
import {
  inPlayPicksOf,
  type DamageCostPick,
  type DiscardCombined,
  type InPlayCostMode,
  type InPlayCostPick,
} from "./abilities.js";
import type { TargetRef, ValueSpec } from "./spec.js";
import type { TriggerEvent } from "./trigger-events.js";
import { instanceId as asInstanceId, type InstanceId, type PlayerId } from "./ids.js";
import { hasKeyword, statusActive, statusCapacity } from "./keywords.js";
import {
  canTakeCostDamage,
  costDamageEffects,
  indirectDamageCapacity,
  pickedCostDamageEffects,
} from "./cost-damage.js";
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
  pushEffects,
  pushEvent,
  pushEvents,
  pushEventsSharingResponses,
  pushPlayCardFrame,
  recordAbilityUse,
} from "./resolve/index.js";
import { limitReached } from "./resolve/ability.js";
import { abilityLacksValidTarget } from "./resolve/target-validity.js";
import { moveCardsTo } from "./resolve/cards.js";
import { addFrameSlots } from "./resolve/frames.js";
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
  basicThwartTargetAllowed,
  canAttack,
  cardsInPlay,
  categoriesOf,
  characterIgnores,
  controllerOf,
  evaluate,
  isAlly,
  matchesQuery,
  printedAbilityRefs,
  printedResourcesOf,
  resolveRef,
  resolveValue,
  restrictedCardsOf,
  traitsOf,
  type EffectContext,
  isProtectedMainScheme,
  withSelfHost,
} from "./select.js";
import type { Bindings, ReportTarget, Vars } from "./stack.js";
import type { GameState } from "./state.js";
import { anyThwartCost, askBasicThwartCost, thwartCostsPayable, thwartCostTotal } from "./thwart-cost.js";
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
  const pool =
    instead?.kind === "constant" && instead.handGenerates !== undefined
      ? generatedResources(state, instead.handGenerates, null, { deps, sourceId: cardInstanceId, playerId })
      : printedResourcesOf(state, cardInstanceId, deps);
  if (!payingFor) return pool;
  const context: EffectContext = {
    selfInstanceId: cardInstanceId,
    controllerId: playerId,
    event: null,
    bindings: {},
    deps,
  };
  const own = printedConstants(state, deps, cardInstanceId).find((trigger) => {
    const multiplier = trigger.resourceMultiplier;
    return (
      multiplier && "whilePayingFor" in multiplier && matchesQuery(state, payingFor, multiplier.whilePayingFor, context)
    );
  })?.resourceMultiplier;
  return paidForMultiplied(state, deps, payingFor, own ? multiplyPool(pool, own) : pool);
}

/** A pool with a `ResourceMultiplierSpec` applied: every type, or only its `resource`. */
function multiplyPool(pool: ResourcePool, multiplier: ResourceMultiplierSpec): ResourcePool {
  const { factor, resource } = multiplier;
  return resource ? { ...pool, [resource]: pool[resource] * factor } : scalePool(pool, factor);
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
): ResourcePool {
  if (!payingFor) return pool;
  return printedConstants(state, deps, payingFor).reduce((scaled, trigger) => {
    const multiplier = trigger.resourceMultiplier;
    return multiplier && "forThisCard" in multiplier ? multiplyPool(scaled, multiplier) : scaled;
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
  },
): ResourcePool {
  if (generation === undefined) return poolOf({ wild: 1 });
  if (typeof generation === "number") return poolOf({ wild: generation });
  if ("kind" in generation) {
    if (generation.kind === "topCardOfDiscard") {
      // Pepper Potts: "equal in quantity and type to the resources on the top card of the discard pile" (FFG ruling).
      const top = discardTop ? cardOf(state, discardTop) : undefined;
      return top ? printedResources(top) : EMPTY_POOL;
    }
    if (!from) return EMPTY_POOL;
    const context: EffectContext = {
      selfInstanceId: from.sourceId,
      controllerId: from.playerId,
      event: null,
      bindings: from.bindings ?? {},
      deps: from.deps,
    };
    const matching = cardsInPlay(state).filter((id) =>
      matchesQuery(state, id, generation.kind === "perCard" ? generation.per : generation.cards, context),
    );
    if (generation.kind === "perCard") {
      const n = Math.min(matching.length, generation.max ?? Infinity);
      return poolOf({ [generation.resource]: n });
    }
    return matching.reduce((pool, id) => {
      const card = cardOf(state, id);
      return card ? addPools(pool, printedResources(card)) : pool;
    }, EMPTY_POOL);
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
  if (!activeAbilityRefs(state, instanceId, deps).some((ref) => ref.id === abilityId)) {
    return { code: "no_valid_target", message: `${abilityId} is not active on ${instanceId}` };
  }
  if (triggeredAbilityForbidden(state, deps, instanceId, definition.trigger)) {
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
  return planCost(state, deps, use.instanceId, spender, cost, use.costChoices ?? {}, new Set());
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
  const pickKeys = new Set(["exhaustCards", "returnToHand", "discardCards"]);
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
    // A forced pick (exactly `min` candidates) pays itself; fewer can't pay, which the fault check reports.
    if (candidates.length <= pick.min) continue;
    choosing = true;
    const most = Math.min(pick.max ?? candidates.length, candidates.length);
    const options: (readonly InstanceId[])[] = [];
    for (let size = pick.min; size <= most && options.length < MAX_PICK_OPTIONS; size++) {
      options.push(...combinations(candidates, size));
    }
    sets = sets.flatMap((set) => options.map((ids) => ({ ...set, [pick.slot]: ids }))).slice(0, MAX_PICK_OPTIONS);
  }
  return choosing ? sets : [undefined];
}

/**
 * The option id of one use of a resource ability: "ability:<id>:<abilityId>", then ":<n>" for the n-th use of a
 * `repeatable` one (docs/phase7-wave5.md §3.25), then "@<slot>=<id>,<id>;…" for the cards its cost picks. Parsed back
 * by `paymentsFromOptionIds`.
 */
export function resourceAbilityOptionId(use: ResourceAbilityUse, n = 1): string {
  const base = `ability:${use.instanceId}:${use.abilityId}${n > 1 ? `:${n}` : ""}`;
  const choices = Object.entries(use.costChoices ?? {});
  return choices.length === 0 ? base : `${base}@${choices.map(([slot, ids]) => `${slot}=${ids.join(",")}`).join(";")}`;
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
    if (!("ability" in entry)) continue;
    const { instanceId, abilityId } = entry.ability;
    const spender = resourceSpender(ctx.state, ctx.deps, instanceId, abilityId, playerId);
    const generated = resourceAbilityGenerates(
      ctx.state,
      ctx.deps,
      entry.ability,
      spender,
      mustPlayer(ctx.state, spender).discard[0] ?? null,
    );
    const key = `paid.ability.${abilityId}`;
    vars[key] = (vars[key] ?? 0) + poolTotal(generated);
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
  if (!counters || counters.upTo || !onlyCounters) {
    return { code: "insufficient_resources", message: `${abilityId} can only be used once per payment` };
  }
  const repeated: AbilityCost = { spendCounters: { ...counters, amount: counters.amount * uses } };
  const plan = planCost(state, deps, instanceId, spender, repeated, {}, new Set());
  return isFault(plan) ? { code: plan.code, message: `${abilityId} cannot be used ${uses} times` } : null;
}

/** Most uses the payment options offer for one `repeatable` resource ability (a safety cap, not a rule). */
const MAX_REPEAT_OPTIONS = 20;

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
          message: `${mustCardOf(ctx.state, entry.fromHand).name} can only be spent in ${spendableIn} form`,
        };
      }
      pool = addPools(pool, handCardResources(ctx.state, ctx.deps, entry.fromHand, ownerId, payingFor));
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
      const spender = resourceSpender(ctx.state, ctx.deps, id, ref.id, playerId);
      // A cost that picks cards in play: one option per legal pick, so each shows what it generates (Sync Ratio).
      const pickChoices = resourcePickChoices(ctx.state, ctx.deps, id, ref.id, spender);
      if (pickChoices.some((choices) => choices !== undefined)) {
        for (const choices of pickChoices) {
          if (!choices) continue;
          if (resourceAbilityFault(ctx.state, ctx.deps, id, ref.id, playerId, payingFor, group, choices)) continue;
          const picked = Object.values(choices).flatMap((ids) => ids.map((pick) => mustCardOf(ctx.state, pick).name));
          options.push({
            optionId: resourceAbilityOptionId({ instanceId: id, abilityId: ref.id, costChoices: choices }),
            label: `${mustCardOf(ctx.state, id).name} (${picked.join(", ")})`,
            ref: { kind: "ability", instanceId: id, abilityId: ref.id },
          });
        }
        continue;
      }
      if (resourceAbilityFault(ctx.state, ctx.deps, id, ref.id, playerId, payingFor, group)) continue;
      options.push({
        optionId: `ability:${id}:${ref.id}`,
        label: mustCardOf(ctx.state, id).name,
        ref: { kind: "ability", instanceId: id, abilityId: ref.id },
      });
      // A `repeatable` ability (docs/phase7-wave5.md §3.25): one more option per further use its cost can pay for.
      if (!trigger.repeatable) continue;
      for (let n = 2; n <= MAX_REPEAT_OPTIONS; n++) {
        if (repeatUsesFault(ctx.state, ctx.deps, id, ref.id, spender, n)) break;
        options.push({
          optionId: `ability:${id}:${ref.id}:${n}`,
          label: mustCardOf(ctx.state, id).name,
          ref: { kind: "ability", instanceId: id, abilityId: ref.id },
        });
      }
    }
  }
  return options;
}

/**
 * Option ids name payment entries: "hand:<id>", "ability:<id>:<abilityId>", "ability:<id>:<abilityId>:<n>" for the
 * n-th use of a `repeatable` resource ability (docs/phase7-wave5.md §3.25), which is the same entry again, and a
 * "@<slot>=<id>,<id>;…" suffix for the cards a resource ability's own cost picks (`resourceAbilityOptionId`).
 */
export function paymentsFromOptionIds(optionIds: readonly string[]): readonly Payment[] {
  const payments: Payment[] = [];
  for (const optionId of optionIds) {
    const at = optionId.indexOf("@");
    const head = at < 0 ? optionId : optionId.slice(0, at);
    const [kind, first, second] = head.split(":");
    if (kind === "hand" && first) payments.push({ fromHand: asInstanceId(first) });
    if (kind === "ability" && first && second) {
      const costChoices = at < 0 ? undefined : pickChoicesFromSuffix(optionId.slice(at + 1));
      payments.push({
        ability: {
          instanceId: asInstanceId(first),
          abilityId: asAbilityId(second),
          ...(costChoices ? { costChoices } : {}),
        },
      });
    }
  }
  return payments;
}

/** "<slot>=<id>,<id>;<slot>=<id>" back into `CostChoices`. */
function pickChoicesFromSuffix(suffix: string): CostChoices | undefined {
  const choices: Record<string, readonly InstanceId[]> = {};
  for (const part of suffix.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
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
      discardFromHand(ctx, zone?.kind === "hand" ? zone.playerId : playerId, entry.fromHand);
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
    );
    const plan = resourceCostPlan(ctx.state, ctx.deps, entry.ability, spender);
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
    // A counter spent as if it were a resource pays but generates nothing (docs/phase7-wave5.md §4.1 Q5; RRG 1.8 p. 13).
    const spentAsIf = definition.trigger.kind === "resource" && definition.trigger.spentAsIfResource === true;
    if (!spentAsIf) generatedBy = addGenerated(generatedBy, spender, poolTotal(generated));
    if (definition.effects.length > 0) used.push({ instanceId, abilityId, spender });
  }
  return { cards: spent, resourceAbilities: used, generated: generatedBy };
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
const handCardsIn = (payment: readonly Payment[]): ReadonlySet<InstanceId> =>
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
  const context: EffectContext = { selfInstanceId: sourceId, controllerId: playerId, event, bindings: {}, deps };
  return Math.max(0, resolveValue(state, spec, context, deps));
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
    const count = deckDiscardCount(state, deps, sourceId, playerId, cost.discardFromDeck);
    const supply = player.deck.length > 0 ? player.deck.length : player.discard.length;
    if (supply < count) {
      return { code: "card_not_in_zone", message: `discard the top ${count} card(s) of your deck` };
    }
  }
  if (cost.exhaustIdentity && identity.exhausted) {
    return { code: "already_exhausted", message: "your identity is already exhausted" };
  }
  // A heal cost can only be paid if there is that much damage to heal (RRG "Cost": costs are paid in full).
  if (cost.healIdentity !== undefined && identity.damage < cost.healIdentity) {
    return { code: "insufficient_resources", message: "not enough damage to heal as a cost" };
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
 * Whether the cost's `giveStatus` / `giveBoostCards` components can be paid in full (RRG 1.8 "Cost", p. 13): someone in
 * play to give them to, every recipient able to hold another status card of that type (RRG 1.8 "Status Cards", p. 41),
 * and enough encounter cards, counting the discard pile the deck is reshuffled from when it empties ("Encounter Deck",
 * p. 17). Null when payable.
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
    const full = recipients.find(
      (id) => mustInstance(state, id).statuses[status] >= statusCapacity(state, id, status, deps),
    );
    if (full) return { code: "no_valid_target", message: `${full} cannot be given another ${status} status card` };
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
  mode: InPlayCostMode,
  pick: InPlayCostPick,
): readonly InstanceId[] {
  return eligibleForInPlayPick(state, deps, sourceId, playerId, pick).filter((id) =>
    canPayInPlayPick(state, deps, sourceId, id, mode, pick),
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
  const instance = mustInstance(state, id);
  if (mode === "exhaust") return !instance.exhausted;
  if (mode === "damage") return canTakeCostDamage(state, deps, id, sourceId, (pick as DamageCostPick).amount);
  if (cannotLeavePlay(state, deps, id)) return false;
  if (permanentStopsLeaving(state, deps, id, getInstance(state, sourceId)?.cardId)) return false;
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
      : mode === "discard"
        ? "discard"
        : mode === "damage"
          ? "deal damage to"
          : "return to hand";
  const eligible = eligibleForInPlayPick(state, deps, sourceId, playerId, pick);
  const candidates = eligible.filter((id) => canPayInPlayPick(state, deps, sourceId, id, mode, pick));
  const whyNot = (id: InstanceId): PriceFault =>
    !eligible.includes(id)
      ? { code: "no_valid_target", message: `${id} is not a card in play you control that can pay ${pick.slot}` }
      : mode === "exhaust"
        ? { code: "already_exhausted", message: `${id} is already exhausted` }
        : mode === "damage"
          ? { code: "no_valid_target", message: `${id} cannot take all of this cost's damage` }
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
  // The frame this cost pays for, which callers push just before paying (read before any payment pushes its own).
  const top = ctx.state.stack[0];
  const paidFor = (top?.kind === "ability" || top?.kind === "playCard") && top.instanceId === sourceId ? top : null;
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
  if (cost.discardFromDeck !== undefined) {
    const count = deckDiscardCount(ctx.state, ctx.deps, sourceId, playerId, cost.discardFromDeck);
    const discarded = count > 0 ? discardFromDeckAsCost(ctx, playerId, count) : [];
    // "… add each SP//dr card discarded this way to your hand" (`discardFromDeckSlot`): bound on the frame being paid for.
    if (cost.discardFromDeckSlot !== undefined)
      addFrameSlots(ctx, paidFor?.frameId, { [cost.discardFromDeckSlot]: discarded });
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
  // "Give the villain a tough status card and 1 facedown boost card →" (`giveStatus`, `giveBoostCards`), checked
  // payable by `planCost`.
  if (cost.giveStatus) {
    for (const id of givenCostRecipients(ctx.state, ctx.deps, sourceId, playerId, cost.giveStatus.to))
      giveStatus(ctx, id, cost.giveStatus.status);
  }
  if (cost.giveBoostCards) {
    for (const id of givenCostRecipients(ctx.state, ctx.deps, sourceId, playerId, cost.giveBoostCards.to))
      for (let i = 0; i < cost.giveBoostCards.count; i++) dealBoostCard(ctx, id, true);
  }
  // "Take 3 indirect damage →" (`indirectDamage`, `cost-damage.ts`): assigned and dealt above the ability's own frame,
  // which the caller has just pushed, so it resolves first; if not all of it is taken, that frame's effects don't.
  if (cost.indirectDamage) {
    pushEffects(ctx, {
      effects: costDamageEffects(cost.indirectDamage, paidFor),
      selfInstanceId: sourceId,
      controllerId: playerId,
    });
  }
  // A cost is part of its card's ability, so the Permanent keyword's same-set exception reads that card (§4.1 Q46).
  const source = getInstance(ctx.state, sourceId)?.cardId;
  if (cost.discardSelf && getInstance(ctx.state, sourceId)) discardFromPlay(ctx, sourceId, source);
  for (const { mode, pick } of inPlayPicksOf(cost)) {
    const ids = plan.bindings[pick.slot] ?? [];
    if (mode === "exhaust") {
      for (const id of ids) exhaustCard(ctx, id);
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
    } else if (mode === "discard") {
      for (const id of ids) if (getInstance(ctx.state, id)) discardFromPlay(ctx, id, source);
    } else {
      moveCardsTo(ctx, ids, "hand", undefined, source);
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
  return {
    pool,
    plan,
    vars: {
      ...plan.vars,
      ...vars,
      ...paymentSourceVars(ctx, playerId, payment),
      ...(printedX ? { x: xValue } : {}),
    },
  };
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
): SpentPayment {
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
  // RRG 1.8 "Target" (pp. 42–43): no valid target, no play (the main scheme, for a "(thwart)" while patrolled; §3.5).
  if (
    card.type === "event" &&
    abilityLacksValidTarget(ctx.state, ctx.deps, ability, command.cardInstanceId, command.playerId)
  ) {
    return engineError("no_valid_target", "this event has no valid target", command);
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
    if (abilityLacksValidTarget(ctx.state, ctx.deps, ability, id, playerId)) return "it has no valid target";
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
    if (abilityLacksValidTarget(ctx.state, ctx.deps, ability, id, playerId)) return "it has no valid target";
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
  // An ability that works in hand works only there, and only for the hand's owner; every other ability only in play
  // (`AbilityDefinition.activeIn`, docs/phase7-wave4.md §3.13).
  const inHand = mustPlayer(ctx.state, command.playerId).hand.includes(command.cardInstanceId);
  if ((definition.activeIn === "hand") !== inHand) {
    return engineError("no_valid_target", `${command.abilityId} is not active where that card is`, command);
  }
  // "Players cannot trigger 'Alter-Ego Action' abilities on obligations." (`cannotTriggerActions`, §3.11).
  if (cannotTriggerAction(ctx.state, ctx.deps, command.cardInstanceId, definition.trigger.form)) {
    return engineError("no_valid_target", "that ability cannot be triggered right now", command);
  }
  // "You cannot resolve triggered abilities in your hero's printed text box" (`cannotResolveTriggeredAbilities`).
  if (triggeredAbilityForbidden(ctx.state, ctx.deps, command.cardInstanceId, definition.trigger)) {
    return engineError("no_valid_target", "that ability cannot be resolved right now", command);
  }
  if (actionConditionUnmet(ctx.state, ctx.deps, definition, command.cardInstanceId, command.playerId)) {
    return engineError("no_valid_target", "that ability cannot be triggered: its condition is not met", command);
  }
  if (abilityLacksValidTarget(ctx.state, ctx.deps, definition, command.cardInstanceId, command.playerId)) {
    return engineError("no_valid_target", "that ability has no valid target", command);
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

  // Read before paying: paying may exhaust or discard the source.
  const sources = paymentSourceVars(ctx, command.playerId, command.payment);
  const bindings = withSelfHost(ctx.state, command.cardInstanceId, plan.bindings);
  const spent = payPayment(ctx, command.playerId, command.payment, plan.payingFor);
  pushActionAbility(ctx, command.cardInstanceId, command.abilityId, command.playerId, bindings, {
    ...plan.vars,
    ...vars,
    ...sources,
  });
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
 */
export function pushConsequentialDamage(
  ctx: Ctx,
  characterId: InstanceId,
  kind: "attack" | "thwart",
): ReportTarget | null {
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
        ? kind === "attack"
          ? card.consequentialDamage.attack
          : card.consequentialDamage.thwart
        : 0;
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
  run: (ctx: Ctx, command: C, spent: SpentPayment[]) => EngineError | null,
  characterOf: (command: C) => InstanceId,
): (ctx: Ctx, command: C) => EngineError | null {
  return (ctx, command) => {
    const spent: SpentPayment[] = [];
    const error = run(ctx, command, spent);
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
  (ctx: Ctx, command: Command & { type: "basicThwart" }, spent: SpentPayment[]) =>
    basicThwartWith(ctx, command, spent, true),
  (command) => command.thwarterInstanceId,
);

function basicAttackPaying(
  ctx: Ctx,
  command: Command & { type: "basicAttack" },
  spent: SpentPayment[],
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
  spent: SpentPayment[],
): EngineError | null {
  return basicThwartWith(ctx, command, spent, false);
}

/** `thwartCostPaid`: the schemes' additional thwart cost was already paid (`commitPrepaidBasicThwart`). */
function basicThwartWith(
  ctx: Ctx,
  command: Command & { type: "basicThwart" },
  spent: SpentPayment[],
  thwartCostPaid: boolean,
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
    if (cannotThwart(ctx.state, ctx.deps, command.playerId, schemeId)) {
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
      const ownUnpaid = payBasicPowerCost(afterOwnCosts, command, command.thwarterInstanceId, "thwart", []);
      if (ownUnpaid) return ownUnpaid;
      exhaustCard(afterOwnCosts, command.thwarterInstanceId);
      if (!thwartCostsPayable(afterOwnCosts.state, ctx.deps, command.playerId, schemeIds)) {
        return engineError("no_valid_target", "you cannot pay the additional cost to thwart that scheme", command);
      }
      askBasicThwartCost(ctx, command, schemeIds, cost);
      return null;
    }
  }
  const unpaid = payBasicPowerCost(ctx, command, command.thwarterInstanceId, "thwart", spent);
  if (unpaid) return unpaid;

  exhaustCard(ctx, command.thwarterInstanceId);
  if (confused) {
    // RRG "Confuse": the thwart is cancelled but its costs are still paid (with any additional cost, §4.1 Q40). It is
    // not considered to have thwarted, so an ally takes no consequential damage (RRG 1.8 "Ally", p. 7).
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
  const framesBefore = new Set(ctx.state.stack.map((frame) => frame.frameId));
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
  // docs/phase7-wave5.md §4.1 Q27: its additional cost is paid already; the thwart does not ask for it again.
  if (thwartCostPaid) {
    for (const frame of ctx.state.stack) {
      if (framesBefore.has(frame.frameId) || frame.kind !== "event" || frame.event.kind !== "thwart") continue;
      updateFrame(ctx, frame.frameId, (f) => (f.kind === "event" ? { ...f, thwartCostPaid: true } : f));
    }
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

/**
 * The sum a `discardFromHand` cost's `combined` threshold measures over these cards (`DiscardCombined`): each card's
 * printed resource cost, read off its card data wherever it is. An X cost is stored as 0 and a card with no printed
 * cost (a resource) adds 0.
 */
export function discardCombinedTotal(state: GameState, ids: readonly InstanceId[], combined: DiscardCombined): number {
  return ids.reduce((sum, id) => sum + discardCombinedValue(state, id, combined), 0);
}

/** One card's share of `discardCombinedTotal`. */
export function discardCombinedValue(state: GameState, id: InstanceId, combined: DiscardCombined): number {
  switch (combined.measure) {
    case "printedCost": {
      const card = cardOf(state, id);
      return card && "cost" in card && typeof card.cost === "number" ? card.cost : 0;
    }
  }
}
