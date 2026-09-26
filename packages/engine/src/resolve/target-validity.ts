/**
 * Target validity: RRG 1.8 "Target" (pp. 42–43). "A target is valid for an ability or game function if any part of
 * that ability can affect that target", and "If an ability or game function has multiple effects on its target, the
 * target is valid if at least one of those effects can affect the target." In particular "A target that cannot be
 * thwarted is not a valid target for a thwart-labeled ability" (so the main scheme, for a player a patrol minion is
 * engaged with; RRG 1.8 "Patrol", p. 32), and a character that cannot take damage is not a valid target for an ability
 * whose only effect on it is dealing damage (ruling, Apr 30, 2026 (1)).
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
 * An effect that names the chosen slot and is not one of the judged kinds (`thwart`, `removeThreat`, `dealDamage`
 * aimed straight at the slot) is assumed able to affect the target: the "multiple effects" bullet makes the target
 * valid if any one effect can, so an effect this module cannot judge never makes a target invalid.
 */

import type { AbilityDefinition, EngineDeps } from "../abilities.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { isPermanent, statusActive } from "../keywords.js";
import { areaOfPlayer, getPlayer } from "../query.js";
import { cannotLeavePlay, cannotTakeDamage, iconsInPlay, patrolledBy } from "../rules.js";
import { activeRules, cardsInPlay, type EffectContext, resolveRef, selectTargets } from "../select.js";
import type { EffectSpec, TargetRef } from "../spec.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { createCtx } from "../ctx.js";
import { selectCards } from "./cards.js";
import { threatRemovalBlocked } from "./event.js";

/** Whether this card can take damage from `source` (a `cannotTakeDamage` rule aside). */
export const canDealDamageTo = (
  state: GameState,
  deps: EngineDeps,
  id: InstanceId,
  source: InstanceId | null,
): boolean => !cannotTakeDamage(state, deps, id, [source]);

/** Whether threat can be removed from this scheme by an effect of `source` that is not a thwart. */
export const canRemoveThreatFrom = (
  state: GameState,
  deps: EngineDeps,
  schemeId: InstanceId,
  source: InstanceId | null,
  ignoreCrisis = false,
): boolean => threatRemovalBlocked(state, deps, schemeId, source, false, ignoreCrisis) === null;

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

type JudgedEffect = Extract<EffectSpec, { kind: "thwart" | "removeThreat" | "dealDamage" | "discardFromPlay" }>;

const isJudged = (effect: EffectSpec): effect is JudgedEffect =>
  effect.kind === "thwart" ||
  effect.kind === "removeThreat" ||
  effect.kind === "dealDamage" ||
  effect.kind === "discardFromPlay";

/** Whether this card can be discarded from play: not Permanent (RRG 1.8 "Permanent", p. 32) and no `cannotLeavePlay`. */
export const canDiscardFromPlay = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  !isPermanent(state, id, deps) && !cannotLeavePlay(state, deps, id);

/** Whether this judged effect can affect `id`, the same check its event makes as it applies. */
function judgedCanAffect(
  state: GameState,
  deps: EngineDeps,
  effect: JudgedEffect,
  id: InstanceId,
  context: EffectContext,
): boolean {
  if (effect.kind === "dealDamage") return canDealDamageTo(state, deps, id, context.selfInstanceId);
  if (effect.kind === "discardFromPlay") return canDiscardFromPlay(state, deps, id);
  if (effect.kind === "removeThreat") {
    return canRemoveThreatFrom(state, deps, id, context.selfInstanceId, effect.ignoreCrisis === true);
  }
  // A "(thwart)": the same arguments `applyRemoveThreat` passes for the removal this thwart makes.
  const thwarter =
    resolveRef(state, effect.thwarter ?? { kind: "identityOf", player: { kind: "controller" } }, context)[0] ?? null;
  return (
    threatRemovalBlocked(
      state,
      deps,
      id,
      thwarter,
      true,
      effect.ignoreCrisis === true,
      context.controllerId,
      thwarter,
      effect.ignorePatrol === true,
    ) === null
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
 * with `playerId`, a crisis icon in their game area, a `threatCannotBeRemoved`, `cannotTakeDamage` or `cannotLeavePlay`
 * rule, or a Permanent card in play. The
 * common case (none of them) skips judging each candidate, which the offer paths (`legalActions`, every trigger
 * window) ask about constantly.
 */
function targetsCanBeInvalid(state: GameState, deps: EngineDeps, playerId: PlayerId | null): boolean {
  if (playerId !== null && patrolledBy(state, deps, playerId) !== null) return true;
  if (iconsInPlay(state, deps, "crisis", playerId === null ? null : areaOfPlayer(state, playerId)) > 0) return true;
  return (
    activeRules(state, deps, "threatCannotBeRemoved").length > 0 ||
    activeRules(state, deps, "cannotTakeDamage").length > 0 ||
    activeRules(state, deps, "cannotLeavePlay").length > 0 ||
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
 * A choice the ability cannot resolve without (RRG 1.8 "Choose (Game Element)", p. 12): a `chooseTarget` of a fixed
 * count that is neither "up to" nor a printed "may", or a `chooseCards` with a minimum of at least 1. Not a choice
 * among a deck's cards: "An ability with a search effect requires only a searchable game area in order to initiate"
 * ("Target", p. 43). "Any number" (`min: 0`), "up to" and "may" choices never require a target.
 */
export function isRequiredChoice(effect: EffectSpec): effect is Choice {
  if (effect.kind === "chooseTarget") {
    if (effect.optional || effect.upTo) return false;
    return effect.count === undefined || (typeof effect.count === "number" && effect.count >= 1);
  }
  return effect.kind === "chooseCards" && effect.min >= 1 && !readsDeck(effect.from);
}

/**
 * A search that must find a card for its text to fully resolve (RRG 1.8 "'Then'", p. 44): a `chooseCards` with a
 * minimum of at least 1 among a deck's cards. It never blocks initiation ("An ability with a search effect requires
 * only a searchable game area in order to initiate", RRG 1.8 "Target", p. 43), but finding nothing leaves the text
 * before a "then" not fully resolved.
 */
export function isRequiredSearch(effect: EffectSpec): boolean {
  return effect.kind === "chooseCards" && effect.min >= 1 && readsDeck(effect.from);
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

/**
 * Whether some effect after a choice is a part of the ability of its own: one that does not name the chosen slot and
 * is not post-"then" text (`then`). "Shuffle a Spell card from your discard pile into your deck and draw 1 card"
 * (Sanctum Sanctorum) keeps its draw with no Spell to choose (RRG 1.8 "Choose (Game Element)", p. 12: the ability
 * cannot be initiated only if there are "no valid targets for any part of the ability"; "Target", p. 42: a draw has a
 * valid target while its deck holds a card). Engine reading: an effect that reads a value the choice's own effects
 * bind (Into the Fray's excess damage) counts as its own part, so such an ability still initiates and resolves to
 * nothing, as it did before.
 */
function hasIndependentPart(rest: readonly EffectSpec[], slot: string): boolean {
  return rest.some((effect) => effect.kind !== "then" && !refersToSlot(effect, slot));
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
  const candidates = selectTargets(state, effect.query, context);
  return judge ? candidates.filter((id) => slotTargetValid(state, deps, rest, effect.slot, id, context)) : candidates;
}

/**
 * Whether this player-initiated ability cannot be initiated for want of a valid target: RRG 1.8 "Target" (p. 42),
 * "If an ability or game function requires one or more targets, that ability or game function can only be initiated
 * if it has at least one valid target", and "Choose (Game Element)" (p. 12), "If a player card ability requires the
 * choosing of one or more targets, and there are no valid targets for any part of the ability, the ability cannot be
 * initiated."
 *
 * Read from the choices that open the ability's effects, where printed text chooses its targets: a required choice
 * (`isRequiredChoice`) with no valid candidate blocks the ability unless some later effect is a part of its own
 * (`hasIndependentPart`). A candidate is valid if some effect naming it can affect it (`slotTargetValid`), so the main
 * scheme is no target for a "(thwart)" while patrolled. The resolving side of the same rule is the choice itself
 * (`requestTargetChoice`, `executeChooseCards`) and `then`.
 *
 * Only abilities a player initiates ask this (`playCard`, `useAbility`, the play-from-hand effects and optional
 * interrupts and responses): an encounter card or a forced ability resolves as far as it can.
 */
export function abilityLacksValidTarget(
  state: GameState,
  deps: EngineDeps,
  definition: AbilityDefinition | undefined,
  sourceId: InstanceId,
  playerId: PlayerId | null,
  event: TriggerEvent | null = null,
): boolean {
  if (!definition) return false;
  // RRG 1.8 "Confuse, Confused" (p. 13): "A confused character can attempt to thwart or use a thwart ability even if it
  // has no valid target for a thwart." The attempt discards the confused card (`labelCancels`, `resolve/ability.ts`).
  if (definition.label?.includes("thwart") && playerId !== null) {
    const identity = getPlayer(state, playerId)?.identity.instanceId;
    if (identity && statusActive(state, identity, "confused", deps)) return false;
  }
  const context: EffectContext = { selfInstanceId: sourceId, controllerId: playerId, event, bindings: {}, deps };
  const judge = targetsCanBeInvalid(state, deps, playerId);
  const effects = definition.effects;
  for (let index = 0; index < effects.length; index++) {
    const effect = effects[index];
    if (effect?.kind !== "chooseTarget" && effect?.kind !== "chooseCards") break;
    // A choice that reads what the cost binds (a var, a slot: Shield Toss's X) is judged only as it resolves.
    if (!isRequiredChoice(effect) || readsBindings(effect)) continue;
    const rest = effects.slice(index + 1);
    if (choiceCandidates(state, deps, effect, rest, context, judge).length > 0) continue;
    if (!hasIndependentPart(rest, effect.slot)) return true;
  }
  return judge && fixedTargetsAllInvalid(state, deps, effects, context);
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
