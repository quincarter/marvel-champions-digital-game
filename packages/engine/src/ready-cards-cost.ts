/**
 * "Ready your sidekick →" as an ability cost (`AbilityCost.readyCards`; docs/phase7-wave8.md §3.54): which cards can
 * pay it, what readying them adds to the payment, and the steps that pay it.
 *
 * RRG 1.8 "Ready" (p. 36): "If a player is instructed to ready an exhausted card, the card is returned to its ready
 * state", and an additional cost to ready may be declined, in which case "the card does not ready". "Cost" (p. 13): a
 * cost is paid in full or not at all. "Cost Arrow Icon" (p. 14): the text before the arrow "must be paid and/or
 * resolved in full before the text after the cost arrow icon can be resolved".
 */

import type { EngineDeps } from "./abilities.js";
import { COST_NOT_PAID_VAR } from "./cost-damage.js";
import { type Ctx, emit, setFrame } from "./ctx.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { getInstance } from "./query.js";
import { addFrameVars, type Frame } from "./resolve/frames.js";
import { combineRequirements, type ResolvedRequirement } from "./resources.js";
import { cannotReady, readyCostFor } from "./rules.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";

/**
 * Whether readying `id` could pay a ready cost of `sourceId`'s ability: it is exhausted (owner decision
 * docs/phase7-wave8.md §4.1 Q29 = A: readying a ready card changes nothing, so it pays nothing) and no rule says it
 * cannot ready, or cannot be readied by that card (RRG 1.8 "'Cannot'", p. 11).
 */
export function canPayReadyCost(state: GameState, deps: EngineDeps, id: InstanceId, sourceId: InstanceId): boolean {
  const instance = getInstance(state, id);
  return instance !== undefined && instance.exhausted && !cannotReady(state, deps, id, sourceId);
}

/**
 * The cost's resource requirement with every additional cost to ready the picked cards added (`RuleSpec readyCost`):
 * the payer cannot decline it and still pay a cost that is the ready itself, so it is owed in the same payment.
 */
export function withReadyCosts(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  ids: readonly InstanceId[],
  requirement: ResolvedRequirement,
): ResolvedRequirement {
  let total = requirement;
  for (const id of ids) {
    const extra = readyCostFor(state, deps, id, playerId);
    if (extra) total = combineRequirements(total, extra);
  }
  return total;
}

/**
 * The steps `payCost` pushes for the cost, above `paidFor`, with the picked cards bound in `slot`: each is readied as
 * any card is (a "would ready" replacement and "after you ready" responses apply; the additional cost to ready is in
 * the payment already, so it is not asked again), then the cost is settled.
 */
export function readyCardsCostEffects(
  slot: string,
  paidFor: Frame<"ability"> | Frame<"playCard"> | null,
): EffectSpec[] {
  return [
    { kind: "ready", target: { kind: "slot", slot }, readyCostPaid: true },
    { kind: "settleReadyCardsCost", slot, paidFor: paidFor?.frameId ?? null },
  ];
}

/**
 * The `settleReadyCardsCost` step: every picked card is ready, the cost is paid; otherwise (a replacement took a
 * ready, a card left play as it readied) the frame it paid for is marked (`COST_NOT_PAID_VAR`) so the ability's
 * effects do not resolve. Whatever else of the cost was paid stays paid.
 */
export function executeSettleReadyCardsCost(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "settleReadyCardsCost" }>,
): void {
  setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
  const picked = frame.bindings[effect.slot] ?? [];
  const readied = picked.filter((id) => getInstance(ctx.state, id)?.exhausted === false);
  const paid = readied.length === picked.length;
  emit(ctx, {
    type: "readyCardsCostSettled",
    instanceId: frame.selfInstanceId,
    playerId: frame.controllerId,
    instanceIds: picked,
    readied: readied.length,
    paid,
  });
  if (!paid) addFrameVars(ctx, effect.paidFor, { [COST_NOT_PAID_VAR]: 1 });
}
