/**
 * "Remove up to 3 threat from here → this attack deals 1 additional damage for each threat removed this way" as an
 * ability cost (`AbilityCost.removeThreat`; docs/phase7-wave9.md §3.7 (b)): the card the threat comes off, the amounts
 * the payer may pick from, and the steps that pay it.
 *
 * RRG 1.8 "Cost" (p. 13): a cost is paid in full or not at all, and one that cannot be paid stops the ability being
 * initiated; (p. 14) "A cost requiring 'any number' or 'up to' some number of game elements requires a minimum of one
 * such game element." So a printed "up to N" is `min` 1, and a card holding less threat than `min` cannot pay. The
 * choice is made as the cost is paid, as the chosen deck discard's is (`deck-discard-choice-cost.ts`).
 *
 * The removal is an ordinary `removeThreat` event sourced to the paying card, so the rules of what holds the threat
 * are the ones that apply: tokens taken off a card that is not a scheme (§3.7 (a)), or a removal from a scheme with
 * everything that follows from it (a side scheme left with none is defeated). A scheme its payer's card could not
 * remove threat from (a crisis icon, a "threat cannot be removed" rule) cannot pay.
 */

import type { EngineDeps, RemoveThreatCost } from "./abilities.js";
import { COST_NOT_PAID_VAR } from "./cost-damage.js";
import { type Ctx, emit, setFrame } from "./ctx.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { getInstance } from "./query.js";
import { threatRemovalBlocked } from "./resolve/event.js";
import { addFrameVars, type Frame, pushEvents } from "./resolve/frames.js";
import { cardsInPlay, type EffectContext, resolveRef } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { Bindings } from "./stack.js";
import type { GameState } from "./state.js";

/** The plan vars holding the range the cost's amount is picked from (`removeThreatCostPlan`). */
export const REMOVE_THREAT_MIN_VAR = "cost.removeThreat.min";
export const REMOVE_THREAT_MAX_VAR = "cost.removeThreat.max";
/** The var the amount of threat the cost removed is read from by the text after the arrow. */
export const REMOVE_THREAT_VAR = "cost.removeThreat";
/** The plan slot naming the card the threat comes off, bound when the cost is determined. */
export const REMOVE_THREAT_FROM_SLOT = "cost.removeThreat.from";

/** The card a `removeThreat` cost takes threat from and the amounts it offers its payer. */
export interface RemoveThreatCostPlan {
  readonly fromId: InstanceId;
  readonly min: number;
  readonly max: number;
}

/**
 * What a `removeThreat` cost on `sourceId` asks of `playerId` right now, or the reason it cannot be paid.
 *
 * `from` is read with the cost's earlier picks bound; the first card in play it names holds the threat. A fixed
 * `amount` is a range of one number. A chosen one runs from the card's `min` (never below 0) to the smaller of its
 * `max` and the threat on the card.
 */
export function removeThreatCostPlan(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  cost: RemoveThreatCost,
  bindings: Bindings,
  vars: Readonly<Record<string, number>>,
): RemoveThreatCostPlan | { readonly fault: string } {
  const context: EffectContext = {
    selfInstanceId: sourceId,
    controllerId: playerId,
    event: null,
    bindings,
    vars,
    deps,
  };
  const inPlay = cardsInPlay(state);
  const [fromId] = resolveRef(state, cost.from, context).filter((id) => inPlay.includes(id));
  if (!fromId) return { fault: "no card in play to remove this cost's threat from" };
  const held = getInstance(state, fromId)?.threat ?? 0;
  const fixed = typeof cost.amount === "number";
  const min = Math.max(0, typeof cost.amount === "number" ? cost.amount : cost.amount.choose.min);
  const max = Math.min(held, typeof cost.amount === "number" ? cost.amount : cost.amount.choose.max);
  if (max < min) return { fault: `not enough threat there to remove ${fixed ? min : `at least ${min}`}` };
  // Removing none asks nothing of the card; any more must be threat the payer's card can remove from it.
  const blocked =
    max > 0 &&
    threatRemovalBlocked(state, deps, fromId, sourceId, false, false, null, null, false, false, playerId) !== null;
  if (blocked && min > 0) return { fault: "threat cannot be removed from that card" };
  return { fromId, min, max: blocked ? 0 : max };
}

/**
 * The steps `payCost` pushes for the cost, above `paidFor`: the payer's `chooseNumber` choice from the planned range
 * (a range of one number is not asked), the removal of that much threat from `fromId`, then the settling.
 */
export function removeThreatCostEffects(
  plan: RemoveThreatCostPlan,
  paidFor: Frame<"ability"> | Frame<"playCard"> | null,
): EffectSpec[] {
  const chosen = "costRemoveThreatChoice";
  const bind = "costRemoveThreat";
  const step = {
    kind: "payRemoveThreatCost" as const,
    from: plan.fromId,
    chosen,
    bind,
    paidFor: paidFor?.frameId ?? null,
  };
  return [
    {
      kind: "chooseNumber",
      player: { kind: "controller" },
      min: { kind: "const", value: plan.min },
      max: { kind: "const", value: plan.max },
      bind: chosen,
    },
    { ...step, stage: "remove" } as const,
    { ...step, stage: "settle" } as const,
  ];
}

/**
 * The `payRemoveThreatCost` step. `remove` raises the removal of the chosen amount (none for 0: no event, so nothing
 * answers it). `settle`, once that has resolved, gives the frame being paid for the amount actually removed as var
 * `cost.removeThreat`; less than chosen (the removal was cancelled or stopped) means the cost was not paid, and that
 * frame's effects do not resolve.
 */
export function executePayRemoveThreatCost(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "payRemoveThreatCost" }>,
): void {
  setFrame(ctx, { ...frame, cursor: frame.cursor + 1 });
  const chosen = frame.vars[`${effect.chosen}.amount`] ?? 0;
  if (effect.stage === "remove") {
    if (chosen <= 0) return;
    pushEvents(
      ctx,
      [
        {
          kind: "removeThreat",
          schemeInstanceId: effect.from,
          amount: chosen,
          sourceInstanceId: frame.selfInstanceId,
          playerId: frame.controllerId,
        },
      ],
      { frameId: frame.frameId, prefix: effect.bind },
    );
    return;
  }
  const removed = frame.vars[`${effect.bind}.amount`] ?? 0;
  addFrameVars(ctx, effect.paidFor, { [REMOVE_THREAT_VAR]: removed });
  const paid = (frame.vars[`${effect.chosen}.made`] ?? 0) === 1 && removed >= chosen;
  emit(ctx, {
    type: "threatCostSettled",
    instanceId: frame.selfInstanceId,
    playerId: frame.controllerId,
    fromInstanceId: effect.from,
    chosen,
    removed,
    paid,
  });
  if (!paid) addFrameVars(ctx, effect.paidFor, { [COST_NOT_PAID_VAR]: 1 });
}
