/**
 * Whether a player could pay a "spend resources" effect (`EffectSpec` `spendResources`) right now, priced exactly as
 * the spend itself prices the payment the player would pick: their `paymentOptions` (hand cards and resource
 * abilities), priced by `priceOrNull`, judged by `spendPays`. There is no second cost model here; this module only
 * searches the payments the spend's own choice would offer.
 *
 * Read by the `canPayResources` predicate (`Predicate`), which gates a "Choose one" option on whether its spend could
 * be paid (Director's Directions, `mojo` 39033; docs/phase7-wave6.md §3.69, pending default Q51).
 *
 * `chosenSizePayments` is the same kind of search for a resource **cost** whose size the payer chooses ("spend up to 3
 * resources →", docs/phase7-wave8.md §3.62): the payments that fit its range, for `legalActions` and a timing window
 * to tell whether the ability can be offered.
 */
import { paymentOptions, paymentsFromOptionIds, priceOrNull } from "./actions.js";
import type { EngineDeps } from "./abilities.js";
import { createCtx } from "./ctx.js";
import type { Payment } from "./commands.js";
import type { InstanceId, PlayerId } from "./ids.js";
import {
  combineRequirements,
  distinctTypeCount,
  poolTotal,
  requirementTotal,
  satisfies,
  type ResolvedRequirement,
  type ResourcePool,
  type ResourceRequirement,
} from "./resources.js";
import type { GameState } from "./state.js";

/**
 * Whether a priced payment pays a spend: it covers `requirement` and holds at least `distinctTypes` resource types
 * (`distinctTypeCount`: each wild is any one type not otherwise present, RRG 1.8 "Wild Resource", p. 48). The rule
 * `executeSpendResources` applies to the payment the player picks.
 */
export function spendPays(pool: ResourcePool, requirement: ResolvedRequirement, distinctTypes: number): boolean {
  return satisfies(pool, requirement) && distinctTypeCount(pool) >= distinctTypes;
}

/** Most payments of each size tried once the whole set of payment options cannot be priced together (a cap). */
const MAX_SUBSETS = 2000;

/**
 * Whether `playerId` could pay `resources` (with `distinctTypes`, as `spendResources` asks) from the payment options a
 * spend would offer them now.
 *
 * - **Everything at once first.** Overpaying is legal (RRG 1.8 "Cost", p. 13), and covering a requirement or holding
 *   more types never gets harder with more resources, so when every option can be priced together that payment
 *   answers the question.
 * - **Otherwise the small payments.** Some options cannot be spent together (two picks of one resource ability's
 *   cost, one card paying two costs: `priceOf`'s faults). A payment that pays and has no spare option holds at most
 *   one option per resource required (each option pays at least one), so every set of up to that many options is
 *   priced, the smallest first.
 */
export function canPaySpend(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  resources: ResourceRequirement,
  distinctTypes = 0,
): boolean {
  const ctx = createCtx(state, deps);
  const requirement = combineRequirements(resources, 0);
  const needed = Math.max(requirementTotal(requirement), distinctTypes);
  const price = (ids: readonly string[]): ResourcePool | null =>
    priceOrNull(ctx, playerId, paymentsFromOptionIds(ids), null, null);
  const pays = (ids: readonly string[]): boolean => {
    const pool = price(ids);
    return pool !== null && spendPays(pool, requirement, distinctTypes);
  };
  if (needed === 0) return true;
  const options = paymentOptions(ctx, playerId, null).map((option) => option.optionId);
  if (options.length === 0) return false;
  const whole = price(options);
  if (whole !== null) return spendPays(whole, requirement, distinctTypes);
  for (let size = 1; size <= Math.min(needed, options.length); size++) {
    let tried = 0;
    for (const ids of subsets(options, size)) {
      if (pays(ids)) return true;
      if (++tried >= MAX_SUBSETS) break;
    }
  }
  return false;
}

/**
 * The payments that pay a chosen-size resource cost (`AbilityCost.resources { choose }`; docs/phase7-wave8.md §3.62)
 * without overpaying it: each set of `sources` that generates from `min` to `max` resources in all, the fewest sources
 * first and, within a size, in the order given. Every source generates at least one resource, so no such payment
 * holds more than `max` of them.
 *
 * `overpay` (owner decision, 2026-10-08, §4.1 row 78; RRG 1.8 "Cost", p. 13: a cost may be overpaid): a set that
 * generates more than `max` is a payment too. Sets of more than `max` sources are still left out: each could drop a
 * source and still pay, so none is needed to tell that the cost can be paid or to suggest a payment. Exact sets come
 * first within each size only by the order given; the caller that wants an exact one asks without `overpay`.
 *
 * Each source is priced alone to rule sets out by their sum, and a set that fits is priced whole (`priceOrNull`), which
 * is what the engine will do with it: sources that cannot be spent together (`priceOf`'s faults) are not a payment,
 * and a resource multiplied while paying for `payingFor` counts as multiplied. Lazy, and capped at `MAX_SUBSETS` sets
 * of each size.
 */
export function* chosenSizePayments(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  sources: readonly Payment[],
  range: { readonly min: number; readonly max: number },
  payingFor: InstanceId | null,
  overpay = false,
): Generator<readonly Payment[]> {
  const ctx = createCtx(state, deps);
  const fits = (sum: number): boolean => sum >= range.min && (overpay || sum <= range.max);
  const total = (payment: readonly Payment[]): number | null => {
    const pool = priceOrNull(ctx, playerId, payment, null, payingFor);
    return pool ? poolTotal(pool) : null;
  };
  const priced = sources.flatMap((source) => {
    const alone = total([source]);
    return alone !== null && alone > 0 && (overpay || alone <= range.max) ? [{ source, alone }] : [];
  });
  for (let size = 1; size <= Math.min(range.max, priced.length); size++) {
    let tried = 0;
    for (const set of subsets(priced, size)) {
      if (++tried > MAX_SUBSETS) break;
      const sum = set.reduce((n, entry) => n + entry.alone, 0);
      if (!fits(sum)) continue;
      const payment = set.map((entry) => entry.source);
      const whole = total(payment);
      if (whole !== null && fits(whole)) yield payment;
    }
  }
}

/** Every way to choose `size` of `items`, in order, lazily. */
function* subsets<T>(items: readonly T[], size: number, from = 0): Generator<readonly T[]> {
  if (size === 0) {
    yield [];
    return;
  }
  for (let i = from; i <= items.length - size; i++) {
    for (const rest of subsets(items, size - 1, i + 1)) yield [items[i]!, ...rest];
  }
}
