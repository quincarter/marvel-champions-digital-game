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
 * - **at initiation** (`abilityLacksValidTarget`): an ability whose leading `chooseTarget` has candidates but no valid
 *   one cannot be initiated (RRG 1.8 "Initiating Abilities", p. 24, step 2), so `playCard`/`useAbility` refuse it with
 *   `no_valid_target`, `legalActions` does not offer it, and a window does not offer an optional interrupt/response;
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
import { statusActive } from "../keywords.js";
import { areaOfPlayer, getPlayer } from "../query.js";
import { cannotTakeDamage, iconsInPlay, patrolledBy } from "../rules.js";
import { activeRules, type EffectContext, resolveRef, selectTargets } from "../select.js";
import type { EffectSpec, TargetRef } from "../spec.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
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

type JudgedEffect = Extract<EffectSpec, { kind: "thwart" | "removeThreat" | "dealDamage" }>;

const isJudged = (effect: EffectSpec): effect is JudgedEffect =>
  effect.kind === "thwart" || effect.kind === "removeThreat" || effect.kind === "dealDamage";

/** Whether this judged effect can affect `id`, the same check its event makes as it applies. */
function judgedCanAffect(
  state: GameState,
  deps: EngineDeps,
  effect: JudgedEffect,
  id: InstanceId,
  context: EffectContext,
): boolean {
  if (effect.kind === "dealDamage") return canDealDamageTo(state, deps, id, context.selfInstanceId);
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
 * with `playerId`, a crisis icon in their game area, or a `threatCannotBeRemoved` or `cannotTakeDamage` rule. The
 * common case (none of them) answers without reading the ability's effects, which the offer paths (`legalActions`,
 * every trigger window) ask about constantly, and which keeps a card-test trace's "its effects were read" signal
 * meaning "it resolved" (`@mc/cards` `testing/trace.ts`).
 */
function targetsCanBeInvalid(state: GameState, deps: EngineDeps, playerId: PlayerId | null): boolean {
  if (playerId !== null && patrolledBy(state, deps, playerId) !== null) return true;
  if (iconsInPlay(state, deps, "crisis", playerId === null ? null : areaOfPlayer(state, playerId)) > 0) return true;
  return (
    activeRules(state, deps, "threatCannotBeRemoved").length > 0 ||
    activeRules(state, deps, "cannotTakeDamage").length > 0
  );
}

/**
 * Whether this ability cannot be initiated for want of a valid target (RRG 1.8 "Target", p. 42: an ability that
 * requires a target "can only be initiated if it has at least one valid target"). Read from the `chooseTarget`s that
 * open the ability's effects, where every printed "(thwart): Remove N threat from a scheme" chooses its target. A
 * mandatory choice with candidates, none of them valid, blocks it. A choice with no candidates at all is left to
 * resolve as before (nothing is chosen), and a printed "may" (`optional`) never blocks.
 */
export function abilityLacksValidTarget(
  state: GameState,
  deps: EngineDeps,
  definition: AbilityDefinition | undefined,
  sourceId: InstanceId,
  playerId: PlayerId | null,
  event: TriggerEvent | null = null,
): boolean {
  if (!definition || !targetsCanBeInvalid(state, deps, playerId)) return false;
  // RRG 1.8 "Confuse, Confused" (p. 13): "A confused character can attempt to thwart or use a thwart ability even if it
  // has no valid target for a thwart." The attempt discards the confused card (`labelCancels`, `resolve/ability.ts`).
  if (definition.label?.includes("thwart") && playerId !== null) {
    const identity = getPlayer(state, playerId)?.identity.instanceId;
    if (identity && statusActive(state, identity, "confused", deps)) return false;
  }
  const context: EffectContext = { selfInstanceId: sourceId, controllerId: playerId, event, bindings: {}, deps };
  const effects = definition.effects;
  for (let index = 0; index < effects.length; index++) {
    const effect = effects[index];
    if (effect?.kind !== "chooseTarget") break;
    if (effect.optional) continue;
    const candidates = selectTargets(state, effect.query, context);
    if (candidates.length === 0) continue;
    const rest = effects.slice(index + 1);
    if (!candidates.some((id) => slotTargetValid(state, deps, rest, effect.slot, id, context))) return true;
  }
  return fixedTargetsAllInvalid(state, deps, effects, context);
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
    if (!isJudged(effect) || effect.target.kind === "slot") return false;
    const targets = resolveRef(state, effect.target, context);
    if (targets.some((id) => judgedCanAffect(state, deps, effect, id, context))) return false;
    if (targets.length > 0) named = true;
  }
  return named;
}
