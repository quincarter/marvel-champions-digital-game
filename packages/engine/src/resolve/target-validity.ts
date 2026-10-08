/**
 * Target validity: RRG 1.8 "Target" (pp. 42–43). "A target is valid for an ability or game function if any part of
 * that ability can affect that target", and "If an ability or game function has multiple effects on its target, the
 * target is valid if at least one of those effects can affect the target." In particular "A target that cannot be
 * thwarted is not a valid target for a thwart-labeled ability" (so the main scheme, for a player a patrol minion is
 * engaged with; RRG 1.8 "Patrol", p. 32), and a character that cannot take damage is not a valid target for an ability
 * whose only effect on it is dealing damage (ruling, Apr 30, 2026 (1)), an attack's damage included (`attackCanDamage`;
 * ruling Mar 19, 2026 (2) for a basic attack, which `basicAttack` in `actions.ts` refuses by the same reading).
 *
 * One place judges it, read three ways (docs/phase7-wave3.md §3.5, §4 Q5):
 *
 * - **at initiation** (`abilityLacksValidTarget`): a player ability whose opening required choice has no valid
 *   candidate, and nothing else of its own to do, cannot be initiated (RRG 1.8 "Initiating Abilities", p. 24, step 2;
 *   "Choose (Game Element)", p. 12), so `playCard`/`useAbility` refuse it with `no_valid_target`, `legalActions` does
 *   not offer it, and a window does not offer an optional interrupt/response;
 * - **at the choice** (`requestTargetChoice` in `effects-frame.ts`): only valid targets are offered;
 * - **"up to" divisions** (`divisionCanAffect`), through the same per-effect checks.
 *
 * The resolution-time check stays as the backstop: a target can become invalid between the choice and the effect
 * (a patrol minion engaging in between, the analogue of ruling Apr 30, 2026 (2)), and `threatRemovalBlocked` then
 * stops the removal as it applies.
 *
 * A move of threat is judged by its source (`canMoveThreatFrom`, `moveThreatLacksSource`): RRG 1.8 "Move" (p. 30), "If
 * there is no valid source or destination for a move, the move cannot be made", and threat moved off a scheme is
 * removed from it, so a scheme its threat cannot be removed from is no source (owner ruling 2026-10-06,
 * docs/phase7-wave7.md §4.1).
 *
 * An effect that names the chosen slot and is not one of the judged kinds (`thwart`, `removeThreat`, `dealDamage`,
 * `attack`, `discardFromPlay`, `flipCard`, `defeat` aimed straight at the slot, `moveThreat` from it) is assumed able to affect
 * the target: the "multiple effects" bullet makes the target valid if any one effect can, so an effect this module
 * cannot judge never makes a target invalid. An attack that also stuns its target keeps a target that cannot take its
 * damage.
 */

import type { AbilityDefinition, EngineDeps } from "../abilities.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { ATTACK_KEYWORDS, attackKeywordsOf, hasKeyword, isPermanent, statusActive } from "../keywords.js";
import { permanentStopsLeaving } from "../effects.js";
import { areaOfPlayer, getInstance, getPlayer } from "../query.js";
import {
  cannotFlip,
  cannotLeavePlay,
  cannotTakeDamage,
  iconsInPlay,
  patrolledBy,
  schemeActivationDestination,
} from "../rules.js";
import {
  activeRules,
  canAttack,
  cardsInPlay,
  categoriesOf,
  type EffectContext,
  resolveRef,
  resolveValue,
  selectTargets,
} from "../select.js";
import type { CardSelector, EffectSpec, TargetRef } from "../spec.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { createCtx } from "../ctx.js";
import { selectCards } from "./cards.js";
import { alreadyDefeated, anyAlreadyDefeated } from "./defeat.js";
import { threatRemovalBlocked, thwartForbiddenOn } from "./event.js";
import { thwartCostPayable } from "../thwart-cost.js";
import { isAttackInstruction } from "./attack-ability.js";

/**
 * Whether this card can take damage from `source` (a `cannotTakeDamage` rule aside). `fromAttack`: the damage is an
 * attack's dealt by `source` itself (`EffectSpec dealDamage.fromAttack`), read as its event will be (`DamageAttackInfo`,
 * docs/phase7-wave7.md §3.30).
 */
export const canDealDamageTo = (
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  source: InstanceId | null,
  fromAttack = false,
): boolean =>
  !cannotTakeDamage(
    state,
    deps,
    id,
    [source],
    fromAttack
      ? {
          attackerInstanceId: source,
          cardInstanceId: null,
          keywords: source === null ? [] : ATTACK_KEYWORDS.filter((name) => hasKeyword(state, source, name, deps)),
        }
      : undefined,
  );

/** Whether threat can be removed from this scheme by an effect of `source` that is not a thwart. */
export const canRemoveThreatFrom = (
  state: GameState,
  deps: EngineDeps,
  schemeId: InstanceId,
  source: InstanceId | null,
  ignoreCrisis = false,
): boolean => threatRemovalBlocked(state, deps, schemeId, source, false, ignoreCrisis) === null;

/**
 * Whether threat can be moved off this scheme by an effect of `source`: it holds threat, and that threat can be
 * removed. RRG 1.8 "Move" (p. 30): "If threat is moved off a scheme, the moved threat is considered to be removed from
 * that scheme", and "If there is no valid source or destination for a move, the move cannot be made." So a crisis icon,
 * a `threatCannotBeRemoved` rule and a scheme with no threat each leave no source; a scheme holding less than the
 * amount named is still one (the move takes what is there). `removingPlayerId`: the player using the ability, as
 * `moveThreat` reads it when it applies (`threatRemoverOf`); absent, the source's controller.
 */
export const canMoveThreatFrom = (
  state: GameState,
  deps: EngineDeps,
  schemeId: InstanceId,
  source: InstanceId | null,
  removingPlayerId: PlayerId | null = null,
): boolean =>
  (getInstance(state, schemeId)?.threat ?? 0) > 0 &&
  threatRemovalBlocked(state, deps, schemeId, source, false, false, null, null, false, false, removingPlayerId) ===
    null;

/** Whether `value` names `slot` anywhere (a `{ kind: "slot" }` ref or an `inSlot` query). */
function refersToSlot(value: unknown, slot: string): boolean {
  if (Array.isArray(value)) return value.some((item) => refersToSlot(item, slot));
  if (value === null || typeof value !== "object") return false;
  const record = value as Readonly<Record<string, unknown>>;
  if (record.kind === "slot" && record.slot === slot) return true;
  if (record.inSlot === slot) return true;
  return Object.values(record).some((item) => refersToSlot(item, slot));
}

const isSlotRef = (ref: TargetRef, slot: string): boolean => ref.kind === "slot" && ref.slot === slot;

type JudgedEffect = Extract<
  EffectSpec,
  { kind: "thwart" | "removeThreat" | "dealDamage" | "attack" | "discardFromPlay" | "flipCard" | "defeat" }
>;

const isJudged = (effect: EffectSpec): effect is JudgedEffect =>
  effect.kind === "thwart" ||
  effect.kind === "removeThreat" ||
  effect.kind === "dealDamage" ||
  effect.kind === "attack" ||
  effect.kind === "discardFromPlay" ||
  effect.kind === "flipCard" ||
  effect.kind === "defeat";

/**
 * Whether this card can be discarded from play by an ability of `source`: no `cannotLeavePlay` (one limited to card
 * abilities counts when there is a `source`, docs/phase7-wave7.md §3.10), and not Permanent
 * unless `source` is of its own set (RRG 1.8 "Permanent", p. 32: "not valid targets for card effects that would cause
 * the permanent card to leave play", the constant ability limiting it to effects on cards not from this card's set;
 * `permanentStopsLeaving`, docs/phase7-wave5.md §4.1 Q46).
 */
export const canDiscardFromPlay = (
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  source: InstanceId | null = null,
): boolean => {
  const sourceCardId = source === null ? undefined : getInstance(state, source)?.cardId;
  return !permanentStopsLeaving(state, deps, id, sourceCardId) && !cannotLeavePlay(state, deps, id, sourceCardId);
};

/** The character an `attack` effect attacks with: its `attacker`, else the controller's identity (`apply-effect.ts`). */
const attackerOf = (
  state: GameState,
  effect: Extract<EffectSpec, { kind: "attack" }>,
  context: EffectContext,
): InstanceId | null =>
  resolveRef(state, effect.attacker ?? { kind: "identityOf", player: { kind: "controller" } }, context)[0] ?? null;

/**
 * Whether the damage of this `attack` effect can be taken by `id`. RRG 1.8 "Target" (p. 43): "A target that 'cannot
 * take damage' is not a valid target for an ability or game function whose only effect on that target is to deal it
 * damage"; an attack's effect on the character it attacks is its damage (ruling Mar 19, 2026 (2) refuses a basic
 * attack on such a target whatever the attacker's own abilities would do after it). Read as the damage will be when it
 * lands (`DamageAttackInfo`, `canTakePlayerAttack`): its sources are the attacker and the card making the attack, with
 * the keywords the attack has now, so a rule scoped by source ("the X player cannot damage …") or by the attack
 * ("unless the attack has ranged") answers the same here and there. A keyword an interrupt grants once the attack is
 * declared (`modifyAttack.keywords`) is not known yet; the basic attack's check does not know it either.
 *
 * An attacker that cannot be told yet (a slot a later choice binds) is not judged: the target counts as valid.
 */
function attackCanDamage(
  state: GameState,
  deps: EngineDeps,
  effect: Extract<EffectSpec, { kind: "attack" }>,
  id: InstanceId,
  context: EffectContext,
): boolean {
  const attacker = attackerOf(state, effect, context);
  if (attacker === null) return true;
  const via = context.selfInstanceId;
  const has = attackKeywordsOf(state, deps, {
    attackerInstanceId: attacker,
    viaInstanceId: via,
    basic: false,
    ...(effect.keywords ? { keywords: effect.keywords } : {}),
  });
  return !cannotTakeDamage(state, deps, id, [attacker, via], {
    attackerInstanceId: attacker,
    cardInstanceId: via,
    keywords: effect.overkill === true && !has.includes("overkill") ? [...has, "overkill"] : has,
  });
}

/**
 * The effects inside `value` through which an "(attack)" ability would attack the card bound to `slot`: an `attack`
 * aimed at it, and a `dealDamage` instruction aimed at it that is the attack's damage (`isAttackInstruction`). A
 * branch, an option and post-"then" text are read too.
 */
function attacksThroughSlot(value: unknown, slot: string, found: EffectSpec[] = []): EffectSpec[] {
  if (Array.isArray(value)) {
    for (const item of value) attacksThroughSlot(item, slot, found);
    return found;
  }
  if (value === null || typeof value !== "object") return found;
  const record = value as Readonly<Record<string, unknown>>;
  if ((record.kind === "attack" || record.kind === "dealDamage") && refersToSlot(record.target, slot)) {
    const effect = value as Extract<EffectSpec, { kind: "attack" | "dealDamage" }>;
    if (effect.kind === "attack" || isAttackInstruction(effect)) found.push(effect);
  }
  for (const item of Object.values(record)) attacksThroughSlot(item, slot, found);
  return found;
}

/** The identity an "(attack)" ability's damage attacks with: its controller's (RRG 1.8 "Labeled Ability", p. 26). */
const labeledAttacker = (state: GameState, context: EffectContext): InstanceId | null =>
  context.controllerId == null ? null : (getPlayer(state, context.controllerId)?.identity.instanceId ?? null);

/**
 * Whether the enemy `id` may be chosen for `slot` in an "(attack)" ability (`EffectContext.attackLabeled`), given the
 * effects that follow the choice (`rest`): when one of them attacks the chosen card (`attacksThroughSlot`), only an
 * enemy the attacking character may attack right now. RRG 1.8 "Attack (Player Ability Type)" (p. 10): "Hero and ally
 * attacks can target any enemy, unless a card ability (such as guard) is preventing that enemy from being attacked";
 * owner ruling Q49 (docs/phase7-wave8.md §4.1): guard is checked for every enemy the attack targets, as it would be
 * attacked, and a chosen-target instruction does not offer a guarded villain. Unlike `slotTargetValid` this is not
 * "valid if any effect can affect it": whatever else the ability does to the chosen enemy ("Confuse that enemy"), it
 * may not be attacked. Anything that is not an enemy, an unlabeled ability and a slot nothing attacks through are
 * always allowed.
 */
export function attackTargetAllowed(
  state: GameState,
  deps: EngineDeps,
  rest: readonly EffectSpec[],
  slot: string,
  id: InstanceId,
  context: EffectContext,
): boolean {
  if (!context.attackLabeled || !categoriesOf(state, id).includes("enemy")) return true;
  return attacksThroughSlot(rest, slot).every((effect) => {
    const attacker = effect.kind === "attack" ? attackerOf(state, effect, context) : labeledAttacker(state, context);
    return attacker === null || canAttack(state, attacker, id, deps);
  });
}

/** Whether this judged effect can affect `id`, the same check its event makes as it applies. */
function judgedCanAffect(
  state: GameState,
  deps: EngineDeps,
  effect: JudgedEffect,
  id: InstanceId,
  context: EffectContext,
): boolean {
  if (effect.kind === "dealDamage") {
    // An "(attack)" ability's damage to an enemy attacks it (owner rulings Q48 and Q49): not one it may not attack.
    if (context.attackLabeled && isAttackInstruction(effect) && categoriesOf(state, id).includes("enemy")) {
      const attacker = labeledAttacker(state, context);
      if (attacker !== null && !canAttack(state, attacker, id, deps)) return false;
    }
    return canDealDamageTo(state, deps, id, context.selfInstanceId, effect.fromAttack === true);
  }
  if (effect.kind === "attack") return attackCanDamage(state, deps, effect, id, context);
  if (effect.kind === "discardFromPlay") return canDiscardFromPlay(state, deps, id, context.selfInstanceId);
  // "You cannot flip …" (docs/phase7-wave7.md §3.64): a card a `cannotFlip` rule names is no target for a flip.
  if (effect.kind === "flipCard") return !cannotFlip(state, deps, id);
  // A card already defeated, in play only while its When Defeated abilities resolve, cannot be defeated again
  // (`alreadyDefeated`; RRG 1.8 "When Defeated Abilities", p. 48). The rules that stop a defeat as it applies
  // ("cannot be defeated", Permanent) are not judged here, as before.
  if (effect.kind === "defeat") return !alreadyDefeated(state, id);
  if (effect.kind === "removeThreat") {
    // A "(thwart)"-labeled ability's removal is a thwart by its controller's identity (`EffectContext.thwartLabeled`).
    if (context.thwartLabeled) return canThwartScheme(state, deps, id, context, { ignoreCrisis: effect.ignoreCrisis });
    return canRemoveThreatFrom(state, deps, id, context.selfInstanceId, effect.ignoreCrisis === true);
  }
  return canThwartScheme(state, deps, id, context, effect);
}

/**
 * Whether a thwart by `thwarter` (else the controller's identity) can remove threat from this scheme: the same
 * arguments `applyRemoveThreat` passes for the removal a thwart makes, so a crisis icon, patrol, a `cannotThwart` and
 * a `threatCannotBeRemoved` rule are all read. RRG 1.8 "Target" (p. 43): "A target that cannot be thwarted is not a
 * valid target for a thwart-labeled ability."
 */
export function canThwartScheme(
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  context: EffectContext,
  thwart: {
    readonly thwarter?: TargetRef | undefined;
    readonly ignoreCrisis?: boolean | undefined;
    readonly ignorePatrol?: boolean | undefined;
  } = {},
): boolean {
  const thwarter =
    resolveRef(state, thwart.thwarter ?? { kind: "identityOf", player: { kind: "controller" } }, context)[0] ?? null;
  return (
    threatRemovalBlocked(
      state,
      deps,
      id,
      thwarter,
      true,
      thwart.ignoreCrisis === true,
      context.controllerId,
      thwarter,
      thwart.ignorePatrol === true,
    ) === null &&
    // docs/phase7-wave5.md §4.1 Q18: not a target if its additional thwart cost cannot be paid (RRG 1.8 "Cost", p. 13).
    (context.controllerId === null || thwartCostPayable(state, deps, context.controllerId, id, context.selfInstanceId))
  );
}

/**
 * Whether this one effect can affect `id` bound to `slot`: true or false for a judged effect aimed at the slot, and
 * undefined for anything else (which the caller counts as able to affect it).
 */
function effectCanAffect(
  state: GameState,
  deps: EngineDeps,
  effect: EffectSpec,
  slot: string,
  id: InstanceId,
  context: EffectContext,
): boolean | undefined {
  if (effect.kind === "moveThreat") {
    // The scheme the threat leaves is the move's source; a slot it only arrives on is not judged.
    const { from, ...others } = effect;
    if (!isSlotRef(from, slot) || refersToSlot(others, slot)) return undefined;
    return canMoveThreatFrom(state, deps, id, context.selfInstanceId);
  }
  if (!isJudged(effect)) return undefined;
  const { target, ...rest } = effect;
  if (!isSlotRef(target, slot) || refersToSlot(rest, slot)) return undefined;
  return judgedCanAffect(state, deps, effect, id, context);
}

/**
 * Whether `id` is a valid target for `slot`, given the effects that follow the choice (`rest`): valid if any effect
 * naming the slot can affect it, or if nothing judged names the slot at all.
 */
export function slotTargetValid(
  state: GameState,
  deps: EngineDeps,
  rest: readonly EffectSpec[],
  slot: string,
  id: InstanceId,
  context: EffectContext,
): boolean {
  let judged = false;
  for (const effect of rest) {
    if (!refersToSlot(effect, slot)) continue;
    const can = effectCanAffect(state, deps, effect, slot, id, context);
    if (can !== false) return true;
    judged = true;
  }
  return !judged;
}

/**
 * Whether anything in play could make a judged effect unable to affect its target right now: a patrol minion engaged
 * with `playerId`, a crisis icon in their game area, a `threatCannotBeRemoved`, `cannotThwart`, `cannotTakeDamage`,
 * `cannotLeavePlay` or `cannotFlip` rule, a Permanent card in play, or a defeated card still in play for its When
 * Defeated abilities. The
 * common case (none of them) skips judging each candidate, which the offer paths (`legalActions`, every trigger
 * window) ask about constantly.
 */
function targetsCanBeInvalid(state: GameState, deps: EngineDeps, playerId: PlayerId | null): boolean {
  if (playerId !== null && patrolledBy(state, deps, playerId) !== null) return true;
  if (iconsInPlay(state, deps, "crisis", playerId === null ? null : areaOfPlayer(state, playerId)) > 0) return true;
  return (
    activeRules(state, deps, "threatCannotBeRemoved").length > 0 ||
    activeRules(state, deps, "cannotThwart").length > 0 ||
    activeRules(state, deps, "additionalThwartCost").length > 0 ||
    activeRules(state, deps, "cannotTakeDamage").length > 0 ||
    activeRules(state, deps, "cannotLeavePlay").length > 0 ||
    activeRules(state, deps, "cannotFlip").length > 0 ||
    anyAlreadyDefeated(state) ||
    cardsInPlay(state).some((id) => isPermanent(state, id, deps))
  );
}

/** The frame var a required choice that found nothing sets, read by `then` (RRG 1.8 "'Then'", p. 44). */
export { UNRESOLVED_VAR } from "./then.js";

type Choice = Extract<EffectSpec, { kind: "chooseTarget" | "chooseCards" }>;

/** Whether a card selector reads a deck: a search or a look at the top of a deck (RRG 1.8 "Target", p. 43). */
export function readsDeck(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(readsDeck);
  if (value === null || typeof value !== "object") return false;
  const record = value as Readonly<Record<string, unknown>>;
  if (record.zone === "deck") return true;
  if (Array.isArray(record.zones) && record.zones.includes("deck")) return true;
  if ((record.kind === "scenarioDeck" || record.kind === "separateDeck") && record.zones === undefined) return true;
  if (record.kind === "encounter" && record.zones === undefined) return true;
  return Object.values(record).some(readsDeck);
}

/**
 * Whether a card selector names one card by its place rather than by what it is: "the top card of your deck", a
 * player's deck alone, its top 1, with no filter and nothing random. Nothing is searched or looked through, so it is
 * not a search ("Target", p. 43) but a card the ability names, and whether there is one is open information: the deck's
 * size. RRG 1.8 "Player Deck" (p. 33): "If a player deck empties, the player shuffles their discard pile to make a new
 * deck", at once (`resetPlayerDeckIfEmpty`), so a deck is empty only while the discard pile is too ("the deck does not
 * reset until there is at least one card in the player's discard pile"), and then it has no top card. RRG 1.8 "'Swap'"
 * (p. 42): "A swap cannot be completed if there is not a component in both locations."
 */
export function namesTopCardOfDeck(selector: CardSelector): boolean {
  if (selector.kind !== "zone" || selector.filter || selector.random) return false;
  const zones = typeof selector.zone === "string" ? [selector.zone] : selector.zone;
  return zones.length === 1 && zones[0] === "deck" && selector.top?.kind === "const" && selector.top.value === 1;
}

/** Whether a `chooseCards` looks through a deck's cards for its candidates: a search, or a look at its top cards. */
const choosesAmongDeck = (from: CardSelector): boolean => readsDeck(from) && !namesTopCardOfDeck(from);

/**
 * A choice the ability cannot resolve without (RRG 1.8 "Choose (Game Element)", p. 12): a `chooseTarget` of a fixed
 * count that is neither "up to" nor a printed "may", or a `chooseCards` with a minimum of at least 1. Not a choice
 * among a deck's cards: "An ability with a search effect requires only a searchable game area in order to initiate"
 * ("Target", p. 43); "the top card of your deck" is a card named by its place, not a search (`namesTopCardOfDeck`).
 * "Any number" (`min: 0`), "up to" and "may" choices never require a target.
 */
export function isRequiredChoice(effect: EffectSpec): effect is Choice {
  if (effect.kind === "chooseTarget") {
    if (effect.optional || effect.upTo) return false;
    return effect.count === undefined || (typeof effect.count === "number" && effect.count >= 1);
  }
  return effect.kind === "chooseCards" && effect.min >= 1 && !choosesAmongDeck(effect.from);
}

/**
 * A search that must find a card for its text to fully resolve (RRG 1.8 "'Then'", p. 44): a `chooseCards` with a
 * minimum of at least 1 among a deck's cards. It never blocks initiation ("An ability with a search effect requires
 * only a searchable game area in order to initiate", RRG 1.8 "Target", p. 43), but finding nothing leaves the text
 * before a "then" not fully resolved.
 */
export function isRequiredSearch(effect: EffectSpec): boolean {
  return effect.kind === "chooseCards" && effect.min >= 1 && choosesAmongDeck(effect.from);
}

/** Whether a choice reads a value or a card the ability's cost binds (`var`, `slot`, `inSlot`, `excludeSlots`). */
function readsBindings(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(readsBindings);
  if (value === null || typeof value !== "object") return false;
  const record = value as Readonly<Record<string, unknown>>;
  if (record.kind === "var" || record.kind === "slot") return true;
  if (record.inSlot !== undefined || record.excludeSlots !== undefined) return true;
  return Object.values(record).some(readsBindings);
}

const isChoice = (effect: EffectSpec): effect is Choice =>
  effect.kind === "chooseTarget" || effect.kind === "chooseCards";

/**
 * Whether the ability has a part of its own left once the opening choices in `dead` have nothing to choose: an effect
 * that names none of those slots and is not post-"then" text (`then`). "Shuffle a Spell card from your discard pile
 * into your deck and draw 1 card" (Sanctum Sanctorum) keeps its draw with no Spell to choose (RRG 1.8 "Choose (Game
 * Element)", p. 12: the ability cannot be initiated only if there are "no valid targets for any part of the ability";
 * "Target", p. 42: a draw has a valid target while its deck holds a card).
 *
 * A choice is not a part by itself: choosing does nothing until an effect uses what was chosen, so "swap a card in
 * your hand with the top card of your deck" has one part, the swap, and it names both choices (RRG 1.8 "'Swap'",
 * p. 42: "you cannot 'swap a card in your hand with the top card of your deck' if you have no cards in hand"). An
 * effect that uses a later choice alone is still a part of its own.
 *
 * Engine reading: an effect that reads a value the choice's own effects bind (Into the Fray's excess damage) counts as
 * its own part, so such an ability still initiates and resolves to nothing, as it did before.
 */
function hasIndependentPart(effects: readonly EffectSpec[], dead: readonly string[]): boolean {
  return effects.some(
    (effect) => effect.kind !== "then" && !isChoice(effect) && !dead.some((slot) => refersToSlot(effect, slot)),
  );
}

/** The targets a choice could choose right now: its candidates, less any the rest of the ability cannot affect. */
function choiceCandidates(
  state: GameState,
  deps: EngineDeps,
  effect: Choice,
  rest: readonly EffectSpec[],
  context: EffectContext,
  judge: boolean,
): readonly InstanceId[] {
  if (effect.kind === "chooseCards") return selectCards(createCtx(state, deps), effect.from, context);
  const candidates = selectTargets(state, effect.query, context).filter((id) =>
    attackTargetAllowed(state, deps, rest, effect.slot, id, context),
  );
  return judge ? candidates.filter((id) => slotTargetValid(state, deps, rest, effect.slot, id, context)) : candidates;
}

/**
 * Why an ability cannot be initiated: `target`, no valid target for it; `moveSource`, no scheme its move of threat
 * could take the threat from (`moveThreatLacksSource`).
 */
export type TargetFault = "target" | "moveSource";

/**
 * Why this player-initiated ability cannot be initiated for want of a valid target, or null: RRG 1.8 "Target" (p. 42),
 * "If an ability or game function requires one or more targets, that ability or game function can only be initiated
 * if it has at least one valid target", and "Choose (Game Element)" (p. 12), "If a player card ability requires the
 * choosing of one or more targets, and there are no valid targets for any part of the ability, the ability cannot be
 * initiated."
 *
 * Read from the choices that open the ability's effects, where printed text chooses its targets: each required choice
 * (`isRequiredChoice`) with no valid candidate is counted, the second and later ones as the first, and the ability is
 * blocked unless some effect that uses none of them is a part of its own (`hasIndependentPart`). A candidate is valid if some effect naming it can affect it (`slotTargetValid`), so the main
 * scheme is no target for a "(thwart)" while patrolled. The resolving side of the same rule is the choice itself
 * (`requestTargetChoice`, `executeChooseCards`) and `then`.
 *
 * Only abilities a player initiates ask this (`playCard`, `useAbility`, the play-from-hand effects and optional
 * interrupts and responses): an encounter card or a forced ability resolves as far as it can.
 */
export function abilityTargetFault(
  state: GameState,
  deps: EngineDeps,
  definition: AbilityDefinition | undefined,
  sourceId: InstanceId,
  playerId: PlayerId | null,
  event: TriggerEvent | null = null,
): TargetFault | null {
  if (!definition) return null;
  // RRG 1.8 "Confuse, Confused" (p. 13): "A confused character can attempt to thwart or use a thwart ability even if it
  // has no valid target for a thwart." The attempt discards the confused card (`labelCancels`, `resolve/ability.ts`).
  if (definition.label?.includes("thwart") && playerId !== null) {
    const identity = getPlayer(state, playerId)?.identity.instanceId;
    if (identity && statusActive(state, identity, "confused", deps)) return null;
  }
  // RRG 1.8 "Stun, Stunned" (p. 41): "A stunned character can attempt to attack or use an attack ability even if it has
  // no valid target for an attack." The attempt discards the stunned card (`labelCancels`, `resolve/ability.ts`).
  if (definition.label?.includes("attack") && playerId !== null) {
    const identity = getPlayer(state, playerId)?.identity.instanceId;
    if (identity && statusActive(state, identity, "stunned", deps)) return null;
  }
  const context: EffectContext = {
    selfInstanceId: sourceId,
    controllerId: playerId,
    event,
    bindings: {},
    deps,
    ...(definition.label?.includes("thwart") && playerId !== null ? { thwartLabeled: true } : {}),
    ...(definition.label?.includes("attack") && playerId !== null ? { attackLabeled: true } : {}),
  };
  // The same rule for an unlabeled ability whose thwart effect names a confused character as thwarting (an ally's own
  // "it thwarts", "your identity thwarts"): the attempt discards the card instead (`thwart` in `apply-effect.ts`,
  // docs/phase7-wave5.md §4.1 Q48, Q50).
  if (playerId !== null && namesConfusedThwarter(state, deps, definition.effects, context)) return null;
  // And for an unlabeled ability whose attack effect names a stunned character as attacking (an ally's own "it
  // attacks"): the attempt discards the stunned card instead (`attack` in `apply-effect.ts`).
  if (playerId !== null && namesStunnedAttacker(state, deps, definition.effects, context)) return null;
  const effects = definition.effects;
  // A move's source is judged whatever is in play: a scheme with no threat is no source.
  const moves = effects.some((effect) => effect.kind === "moveThreat");
  // An "(attack)" ability's named enemy can be one its player may not attack (guard): judged whatever else is in play.
  const judge = moves || context.attackLabeled === true || targetsCanBeInvalid(state, deps, playerId);
  // The opening choices that are required and have nothing to choose. Only the choices before the ability's first
  // other effect are read: a later one chooses among what the effects before it leave (a card one of them drew or
  // discarded), which cannot be known until they resolve, so it is judged as it resolves.
  const dead: string[] = [];
  for (let index = 0; index < effects.length; index++) {
    const effect = effects[index];
    if (effect?.kind !== "chooseTarget" && effect?.kind !== "chooseCards") break;
    // A choice that reads what the cost binds (a var, a slot: Shield Toss's X) is judged only as it resolves.
    if (!isRequiredChoice(effect) || readsBindings(effect)) continue;
    const rest = effects.slice(index + 1);
    if (choiceCandidates(state, deps, effect, rest, context, judge).length === 0) dead.push(effect.slot);
  }
  // Read before the dead choices so a move with no source says so (`TARGET_FAULT_MESSAGE`).
  if (moves && moveThreatLacksSource(state, deps, effects, context)) return "moveSource";
  if (dead.length > 0 && !hasIndependentPart(effects, dead)) return "target";
  if (tuckNamesNoCard(state, deps, effects, context)) return "target";
  if (judge && attackThreatRemovalInvalid(state, deps, effects, context)) return "target";
  if (judge && context.thwartLabeled && thwartNamesNoValidScheme(state, deps, effects, context)) return "target";
  return judge && fixedTargetsAllInvalid(state, deps, effects, context) ? "target" : null;
}

/** Whether this player-initiated ability cannot be initiated for want of a valid target (`abilityTargetFault`). */
export const abilityLacksValidTarget = (
  state: GameState,
  deps: EngineDeps,
  definition: AbilityDefinition | undefined,
  sourceId: InstanceId,
  playerId: PlayerId | null,
  event: TriggerEvent | null = null,
): boolean => abilityTargetFault(state, deps, definition, sourceId, playerId, event) !== null;

/** What a refused ability is told (`EngineError.message`, `legalActions`' "Why illegal?"), per fault. */
export const TARGET_FAULT_MESSAGE: Readonly<Record<TargetFault, string>> = {
  target: "that ability has no valid target",
  moveSource: "there is no scheme this could move threat from: threat cannot be removed from it, or it has none",
};

/**
 * "That attack removes threat from the main scheme instead of dealing damage" (`modifyAttack.removesThreatFrom`,
 * Determined Defense): the scheme the ability names is its target, so the ability cannot be initiated while that
 * scheme cannot be affected. RRG 1.8 "Target" (p. 43): "A target that cannot be thwarted is not a valid target for a
 * thwart-labeled ability", and the FAQ on Wasp's Giant form (RRG 1.8, p. 61) treats an engaged patrol minion and a
 * crisis icon alike as making the main scheme no target for a thwart. So a "(thwart)" one is not offered under a
 * crisis icon, an engaged patrol minion or a `cannotThwart` rule, and an unlabeled one under a crisis icon or a
 * `threatCannotBeRemoved` rule. Whatever else the ability does (the card removing itself from the game) has no target
 * of its own and does not make the scheme valid. A scheme ref that names nothing is not judged here.
 */
function attackThreatRemovalInvalid(
  state: GameState,
  deps: EngineDeps,
  effects: readonly EffectSpec[],
  context: EffectContext,
): boolean {
  return effects.some((effect) => {
    if (effect.kind !== "modifyAttack" || !effect.removesThreatFrom) return false;
    const schemes = resolveRef(state, effect.removesThreatFrom.scheme, context);
    const asThwart = effect.removesThreatFrom.thwart === true || context.thwartLabeled === true;
    return (
      schemes.length > 0 &&
      !schemes.some((id) =>
        asThwart
          ? canThwartScheme(state, deps, id, context)
          : canRemoveThreatFrom(state, deps, id, context.selfInstanceId),
      )
    );
  });
}

/**
 * "… → move 4 threat from the main scheme to that side scheme": an ability that moves threat has the scheme the threat
 * leaves as its target, and cannot be initiated while no move it makes has a source (owner ruling 2026-10-06,
 * docs/phase7-wave7.md §4.1). RRG 1.8 "Move" (p. 30): "If there is no valid source or destination for a move, the move
 * cannot be made", the moved threat being "considered to be removed from that scheme"; "Cost" (p. 13): the cost cannot
 * be paid without a valid target, so nothing is spent. As for `attackThreatRemovalInvalid`, whatever else the ability
 * does (the card removing itself from the game, the destination entering play) does not make the source valid: those
 * are the printed cost, scripted as effects.
 *
 * Only the moves the ability always makes are read (its own effect list, not a branch, an option or post-"then" text):
 *
 * - **a named source** ("the main scheme", "that scheme"): valid if `canMoveThreatFrom` it, the first card in play the
 *   ref names being the source, as `moveThreat` applies it; a ref that names nothing right now, or reads a binding, is
 *   not judged;
 * - **a chosen source** (a required `chooseTarget` among the choices that open the ability): valid if one of the
 *   candidates is a source, and only those are offered as it resolves (`requestTargetChoice`). A later choice chooses
 *   among what the effects before it leave, so it is judged as it resolves.
 *
 * The ability cannot be initiated when at least one of its moves can be judged and none of the judged ones has a
 * source. The destination is not judged here: it is often chosen or put into play as the ability resolves.
 */
function moveThreatLacksSource(
  state: GameState,
  deps: EngineDeps,
  effects: readonly EffectSpec[],
  context: EffectContext,
): boolean {
  const verdicts: boolean[] = [];
  const inPlay = cardsInPlay(state);
  const isSource = (id: InstanceId): boolean =>
    canMoveThreatFrom(state, deps, id, context.selfInstanceId, context.controllerId);
  const firstOther = effects.findIndex((effect) => !isChoice(effect));
  const opening = effects.slice(0, firstOther === -1 ? effects.length : firstOther);
  for (const effect of effects) {
    if (effect.kind !== "moveThreat") continue;
    if (effect.from.kind === "slot") {
      const slot = effect.from.slot;
      const choice = opening.find((other) => other.kind === "chooseTarget" && other.slot === slot);
      if (choice?.kind !== "chooseTarget" || !isRequiredChoice(choice) || readsBindings(choice.query)) continue;
      verdicts.push(selectTargets(state, choice.query, context).some(isSource));
    } else if (!readsBindings(effect.from)) {
      const [named] = resolveRef(state, effect.from, context).filter((id) => inPlay.includes(id));
      if (named !== undefined) verdicts.push(isSource(named));
    }
  }
  return verdicts.length > 0 && !verdicts.some(Boolean);
}

/** Whether a "(thwart)" ability's threat removal has a scheme this player can thwart, where that can be told now. */
type ThwartVerdict = "valid" | "invalid" | "unknown";

/** The effect lists nested in this effect that resolve as part of the same resolution of the ability. */
function nestedEffects(effect: EffectSpec): readonly (readonly EffectSpec[])[] {
  switch (effect.kind) {
    case "if":
      return [effect.then, effect.otherwise ?? []];
    case "then":
    case "repeatWhile":
    case "forEachPlayer":
      return [effect.effects];
    case "chooseOne":
      return effect.options.map((option) => option.effects);
    default:
      return [];
  }
}

/** Every effect of the ability, the ones inside its branches, options and post-"then" text included. */
function flattenEffects(effects: readonly EffectSpec[]): readonly EffectSpec[] {
  return effects.flatMap((effect) => [effect, ...nestedEffects(effect).flatMap(flattenEffects)]);
}

/** Whether this value holds a threat-removing effect somewhere inside it (a container `nestedEffects` does not open). */
function holdsThreatRemoval(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(holdsThreatRemoval);
  if (value === null || typeof value !== "object") return false;
  const record = value as Readonly<Record<string, unknown>>;
  if (record.kind === "thwart" || record.kind === "removeThreat") return true;
  if (record.kind === "divide" && record.what === "threat") return true;
  return Object.values(record).some(holdsThreatRemoval);
}

/**
 * A "(thwart)" ability whose threat removal names no scheme its player can thwart cannot be initiated, whatever else
 * it does (owner decision, 2026-10-03). RRG 1.8 "Target" (p. 43): "A target that cannot be thwarted is not a valid
 * target for a thwart-labeled ability", and (p. 42) an ability that requires a target "can only be initiated if it has
 * at least one valid target"; the FAQ on Wasp's Giant form (RRG 1.8, p. 61) makes the main scheme no target for a
 * thwart under an engaged patrol minion and under a crisis icon alike. So "Hero Action (thwart): Remove 3 threat from
 * the main scheme. If this is the first card you have played this round, return this card to your hand" (Impede) is
 * not playable then: returning a card does not affect the scheme, and no cost is paid (RRG 1.8 "Cost", p. 13).
 *
 * Every threat removal the ability can make is judged (`removeThreat`, `thwart`, `divide`, `modifyAttack`'s
 * `removesThreat` / `removesThreatFrom`, inside an `if`, an option or a post-"then" alike):
 *
 * - **fixed schemes** ("the main scheme", "each side scheme"): valid if the ref names a scheme this player can thwart
 *   (`canThwartScheme`); a ref that names nothing right now is not judged;
 * - **a chosen scheme** (a `chooseTarget` slot, a division's `among`): valid if one of the candidates can be thwarted,
 *   and only those are offered as it resolves (`requestTargetChoice`, `executeDivide`).
 *
 * The ability cannot be initiated when it has at least one removal and none of them is valid. A removal that cannot be
 * told yet (a slot the cost binds, a query that reads a binding, an effect container this module does not open) counts
 * as valid, so nothing is refused on a guess. A confused identity never reaches here (`abilityLacksValidTarget`).
 */
function thwartNamesNoValidScheme(
  state: GameState,
  deps: EngineDeps,
  effects: readonly EffectSpec[],
  context: EffectContext,
): boolean {
  const all = flattenEffects(effects);
  const verdicts: ThwartVerdict[] = [];
  const among = (schemes: readonly InstanceId[], thwart: Parameters<typeof canThwartScheme>[4] = {}): ThwartVerdict =>
    schemes.some((id) => canThwartScheme(state, deps, id, context, thwart)) ? "valid" : "invalid";
  for (const effect of all) {
    if (effect.kind === "thwart" || effect.kind === "removeThreat") {
      const thwart = effect.kind === "thwart" ? effect : { ignoreCrisis: effect.ignoreCrisis };
      if (effect.kind === "thwart" && effect.thwarter && readsBindings(effect.thwarter)) verdicts.push("unknown");
      else if (effect.target.kind === "slot") {
        const slot = effect.target.slot;
        const choice = all.find((other) => other.kind === "chooseTarget" && other.slot === slot);
        if (choice?.kind !== "chooseTarget" || !isRequiredChoice(choice) || readsBindings(choice.query)) {
          verdicts.push("unknown");
        } else verdicts.push(among(selectTargets(state, choice.query, context), thwart));
      } else if (readsBindings(effect.target)) verdicts.push("unknown");
      else {
        const named = resolveRef(state, effect.target, context);
        verdicts.push(named.length === 0 ? "unknown" : among(named, thwart));
      }
    } else if (effect.kind === "divide") {
      if (effect.what !== "threat") continue;
      verdicts.push(readsBindings(effect.among) ? "unknown" : among(selectTargets(state, effect.among, context)));
    } else if (effect.kind === "modifyAttack") {
      if (effect.removesThreatFrom) {
        const named = resolveRef(state, effect.removesThreatFrom.scheme, context);
        verdicts.push(named.length === 0 ? "unknown" : among(named));
      }
      // "This activation removes threat instead of placing it": the scheme the villain's scheme would place it on.
      if (effect.removesThreat && context.event?.kind === "enemyScheme") {
        verdicts.push(among([schemeActivationDestination(state, deps, context.event.enemyInstanceId)]));
      }
      // "Reduce the amount of threat placed on the scheme by 1" (Emergency): a thwart of that scheme that removes no
      // threat (owner decision, 2026-10-03), so only what forbids thwarting it makes it invalid: an engaged patrol
      // minion or a `cannotThwart` rule, not a crisis icon (RRG 1.8 "Crisis Icon", p. 14, is about removing threat).
      // A value that cannot be read yet is taken as a reduction.
      if (effect.threatBonus && context.event?.kind === "enemyScheme" && context.controllerId !== null) {
        const reduces = readsBindings(effect.threatBonus) || resolveValue(state, effect.threatBonus, context, deps) < 0;
        const scheme = schemeActivationDestination(state, deps, context.event.enemyInstanceId);
        const thwart = {
          thwarterInstanceId: getPlayer(state, context.controllerId)?.identity.instanceId ?? null,
          playerId: context.controllerId,
        };
        if (reduces) verdicts.push(thwartForbiddenOn(state, deps, thwart, scheme) ? "invalid" : "valid");
      }
    } else if (nestedEffects(effect).length === 0 && holdsThreatRemoval(effect)) verdicts.push("unknown");
  }
  return verdicts.length > 0 && verdicts.every((verdict) => verdict === "invalid");
}

/**
 * "After an ally is defeated by consequential damage, exhaust Med Lab → place it here" (`rogue` 38028; docs/phase7-
 * wave6.md §3.57): an ability that only tucks the cards a ref names has those cards as its target. Ruling Dec 17, 2025
 * (4) #2: Med Lab "**cannot** target allies that have been removed from the game. Because Odin is removed from the game
 * via a Forced Interrupt, he is removed before Med Lab's Response can trigger, making him untargetable." So when the
 * ref names cards and `selectCards` can reach none of them, the ability cannot be initiated and no cost is paid (RRG
 * 1.8 "Cost", p. 13: "An ability's cost cannot be paid if that ability's effect requires one or more targets and there
 * is not at least one valid target"). A slot is bound only as the ability resolves, so it is not judged here.
 */
function tuckNamesNoCard(
  state: GameState,
  deps: EngineDeps,
  effects: readonly EffectSpec[],
  context: EffectContext,
): boolean {
  if (effects.length === 0) return false;
  return effects.every(
    (effect) =>
      effect.kind === "tuckCards" &&
      effect.cards.kind === "ref" &&
      effect.cards.ref.kind !== "slot" &&
      resolveRef(state, effect.cards.ref, context).length > 0 &&
      selectCards(createCtx(state, deps), effect.cards, context).length === 0,
  );
}

/**
 * Whether one of the ability's own thwart effects names a confused character as the one thwarting (its `thwarter`,
 * else the controller's identity, as the effect reads it). Only a thwarter known at initiation counts: one bound by a
 * choice the ability has not made yet (a slot) is judged as that thwart resolves.
 */
function namesConfusedThwarter(
  state: GameState,
  deps: EngineDeps,
  effects: readonly EffectSpec[],
  context: EffectContext,
): boolean {
  return effects.some(
    (effect) =>
      effect.kind === "thwart" &&
      resolveRef(state, effect.thwarter ?? { kind: "identityOf", player: { kind: "controller" } }, context).some((id) =>
        statusActive(state, id, "confused", deps),
      ),
  );
}

/**
 * Whether one of the ability's own attack effects names a stunned character as the one attacking (`attackerOf`). Only
 * an attacker known at initiation counts, as for `namesConfusedThwarter`.
 */
function namesStunnedAttacker(
  state: GameState,
  deps: EngineDeps,
  effects: readonly EffectSpec[],
  context: EffectContext,
): boolean {
  return effects.some((effect) => {
    if (effect.kind !== "attack") return false;
    const attacker = attackerOf(state, effect, context);
    return attacker !== null && statusActive(state, attacker, "stunned", deps);
  });
}

/**
 * The same question for an ability that names its targets rather than choosing them: "(thwart): Remove 1 threat from
 * the main scheme", "… from each scheme". Only when every effect is a judged one aimed at a named ref (no choice, no
 * slot, nothing else the ability does) can it be judged, and then it cannot be initiated if its refs name at least
 * one card and none of them can be affected by the effect naming it. "Each scheme" with one valid scheme still
 * initiates, and skips the invalid one as it resolves (RRG 1.8 "Target", p. 43, the crisis example).
 */
function fixedTargetsAllInvalid(
  state: GameState,
  deps: EngineDeps,
  effects: readonly EffectSpec[],
  context: EffectContext,
): boolean {
  if (effects.length === 0) return false;
  let named = false;
  for (const effect of effects) {
    // A discard is judged only as a choice's target: a card's own "discard this card" is left to resolve as before.
    if (!isJudged(effect) || effect.kind === "discardFromPlay" || effect.target.kind === "slot") return false;
    const targets = resolveRef(state, effect.target, context);
    if (targets.some((id) => judgedCanAffect(state, deps, effect, id, context))) return false;
    if (targets.length > 0) named = true;
  }
  return named;
}
