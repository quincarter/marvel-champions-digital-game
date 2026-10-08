/**
 * Paying an additional cost to change form (`RuleSpec formChangeCost`, docs/phase7-wave8.md §3.63): "As an additional
 * cost to change to hero form during your turn, you must spend 2 resources of the same type."
 *
 * RRG 1.8 "Cost" (p. 14): "A player must pay all additional costs simultaneously with the cost that is being added to,
 * even if multiple cards or abilities are adding separate additional costs. [...] if they cannot pay for all of the
 * costs at once, then they do not pay any of the costs and the effect associated with the costs does not occur."
 *
 * There is no second cost model here. Each cost is an `AbilityCost`, checked by `planCost`, priced by `priceOf`, judged
 * by `resourceVars` (where "of the same type" and a chosen size are read off the payment) and paid by `payPayment` and
 * `payCost`: the steps `useAbility` takes for an ability's cost. Both ways a player changes form go through
 * `planFormChangeCosts`: the `changeForm` command, which carries the payment, and a `changeForm` effect of a player
 * card, which asks for it (`executeChangeForm`).
 *
 * - The payment is the changing player's alone and pays for no card (`payingFor` null): no alliance, no other
 *   player's hand, and no resource generated "for" a kind of card (`generatesFor`).
 * - Overpaying is legal (RRG 1.8 "Cost", p. 13), so [energy][energy][mental] pays "2 resources of the same type".
 * - **Several costs at once** are planned one by one and paid from one payment that must cover their total. Each
 *   cost's own shape ("of the same type") is judged against that total, not jointly with another cost's shape, and
 *   the costs share the command's `costChoices`: exact while at most one of the costs constrains the payment's shape
 *   or picks cards, which is every pairing the card pool prints.
 */

import type { AbilityCost, EngineDeps } from "./abilities.js";
import {
  announceResourcesSpent,
  type CostPlan,
  isPriceFault as isFault,
  payCost,
  paymentOptions,
  paymentsFromOptionIds,
  payPayment,
  planCost,
  priceOf,
  type PriceFault,
  resourceVars,
  type SpentPayment,
} from "./actions.js";
import type { CostChoices, Payment } from "./commands.js";
import { type Ctx, createCtx, emit } from "./ctx.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { chosenSizePayments } from "./payable.js";
import { cardOf } from "./query.js";
import { combineRequirements, poolTotal, requirementTotal, satisfies, type ResolvedRequirement } from "./resources.js";
import type { FormChangeCost } from "./rules.js";
import type { Form, GameState } from "./state.js";

/** Every additional cost of one change of form, checked against one payment; nothing is paid yet. */
export interface FormChangeCostPlan {
  readonly costs: readonly FormChangeCost[];
  /** One per cost, in the same order. */
  readonly plans: readonly CostPlan[];
  /** The resources the payment must cover: every cost's requirement added together. */
  readonly requirement: ResolvedRequirement;
}

/** The cards the costs are printed on, in order, each once. */
export const formChangeCostSources = (costs: readonly FormChangeCost[]): readonly InstanceId[] => [
  ...new Set(costs.map((entry) => entry.sourceInstanceId)),
];

/**
 * Checks every cost against `payment`: each cost's own components (`planCost`), then the payment against the total
 * and against each cost's shape (`resourceVars`). The first fault found is returned and nothing is paid.
 */
export function planFormChangeCosts(
  ctx: Ctx,
  playerId: PlayerId,
  costs: readonly FormChangeCost[],
  payment: readonly Payment[],
  costChoices: CostChoices,
): FormChangeCostPlan | PriceFault {
  const reserved = new Set(payment.flatMap((entry) => ("fromHand" in entry ? [entry.fromHand] : [])));
  const plans: CostPlan[] = [];
  let requirement: ResolvedRequirement = combineRequirements(0, 0);
  for (const { sourceInstanceId, cost } of costs) {
    const plan = planCost(ctx.state, ctx.deps, sourceInstanceId, playerId, cost, costChoices, reserved);
    if (isFault(plan)) return plan;
    plans.push(plan);
    requirement = combineRequirements(requirement, plan.requirement);
  }
  const pool = priceOf(ctx, playerId, payment, null, null);
  if (isFault(pool)) return pool;
  if (!satisfies(pool, requirement)) {
    return {
      code: "insufficient_resources",
      message: `need ${requirementTotal(requirement)}, paid ${poolTotal(pool)}`,
    };
  }
  for (const [index, plan] of plans.entries()) {
    const vars = resourceVars(pool, plan.cost ?? (costs[index]?.cost as AbilityCost), requirement);
    if (isFault(vars)) return vars;
  }
  return { costs, plans, requirement };
}

/**
 * Spends a checked payment and logs the cost as paid. The caller then changes the form and calls
 * `settleFormChangeCosts`, so the log reads cost, then change.
 */
export function payFormChangeCosts(
  ctx: Ctx,
  playerId: PlayerId,
  plan: FormChangeCostPlan,
  to: Form,
  payment: readonly Payment[],
): SpentPayment {
  const spent = payPayment(ctx, playerId, payment, null);
  emit(ctx, {
    type: "formChangeCostSettled",
    playerId,
    to,
    sourceInstanceIds: formChangeCostSources(plan.costs),
    outcome: "paid",
  });
  return spent;
}

/**
 * The rest of a paid cost: each cost's non-resource components (`payCost`), then the payment's "after you spend this
 * card" announcements. Called once whatever the cost pays for is on the stack (the `formChanged` event of the
 * command), so all of it sits above that and resolves first.
 */
export function settleFormChangeCosts(
  ctx: Ctx,
  playerId: PlayerId,
  plan: FormChangeCostPlan,
  spent: SpentPayment,
): void {
  for (const [index, entry] of plan.costs.entries()) {
    const planned = plan.plans[index];
    if (planned) payCost(ctx, entry.sourceInstanceId, playerId, entry.cost, planned);
  }
  announceResourcesSpent(ctx, playerId, spent, null, "effect");
}

/** A cost in a few words, for the refusal: "2 resources of the same type". */
function describeCost(cost: AbilityCost): string {
  const fixed = typeof cost.resources === "object" && "choose" in cost.resources ? undefined : cost.resources;
  const total = requirementTotal(combineRequirements(fixed, 0));
  if (total === 0) return "an additional cost";
  return `${total} resource${total === 1 ? "" : "s"}${cost.sameResourceType ? " of the same type" : ""}`;
}

/** The refusal of an unpaid change: the cards that add the cost, what each asks, and the engine's own fault. */
export function formChangeCostMessage(
  state: GameState,
  costs: readonly FormChangeCost[],
  to: Form,
  fault: string,
): string {
  const parts = costs.map(
    ({ sourceInstanceId, cost }) =>
      `${cardOf(state, sourceInstanceId)?.name ?? sourceInstanceId} (${describeCost(cost)})`,
  );
  const form = to === "hero" ? "hero" : "alter-ego";
  return `changing to ${form} form has an additional cost: ${parts.join(", ")}: ${fault}`;
}

/** Most exact-size payments tried by `canPayFormChangeCosts` (a cap, not a rule). */
const MAX_EXACT_PAYMENTS = 200;

/**
 * Whether `playerId` could pay these costs right now with some payment a `changeForm` effect's prompt would offer
 * them. Everything they hold is tried first (overpaying is legal, RRG 1.8 "Cost", p. 13), then their hand cards alone
 * (a resource ability can conflict with another), then each payment that generates exactly the total, for a cost
 * that cannot be overpaid.
 *
 * Costs are planned with no picks, so a cost that picks cards ("discard 1 card from your hand") reads as unpayable
 * here: the effect's prompt is a payment and cannot ask for a pick yet (see `executeChangeForm`).
 */
export function canPayFormChangeCosts(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  costs: readonly FormChangeCost[],
): boolean {
  const ctx = createCtx(state, deps);
  const pays = (payment: readonly Payment[]): boolean =>
    !isFault(planFormChangeCosts(ctx, playerId, costs, payment, {}));
  if (pays([])) return true;
  const all = paymentsFromOptionIds(paymentOptions(ctx, playerId, null).map((option) => option.optionId));
  if (all.length === 0) return false;
  const hand = all.filter((payment) => "fromHand" in payment);
  if (pays(all) || (hand.length > 0 && hand.length < all.length && pays(hand))) return true;
  let total = 0;
  for (const { sourceInstanceId, cost } of costs) {
    const plan = planCost(state, deps, sourceInstanceId, playerId, cost, {}, new Set());
    // A fault of the cost itself (a pick not made, a card already exhausted) is not one a payment can fix.
    if (isFault(plan)) return false;
    total += requirementTotal(plan.requirement);
  }
  if (total === 0) return false;
  let tried = 0;
  for (const payment of chosenSizePayments(state, deps, playerId, all, { min: total, max: total }, null)) {
    if (pays(payment)) return true;
    if (++tried >= MAX_EXACT_PAYMENTS) break;
  }
  return false;
}
