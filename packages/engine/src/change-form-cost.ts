/**
 * "Change to hero form and discard this card →" as an ability cost (`AbilityCost.changeForm`, Entrapment 61024).
 *
 * RRG 1.8 "Cost" (pp. 13–14): a cost is paid in full or not at all, and "a player must pay all additional costs
 * simultaneously with the cost that is being added to […] if they cannot pay for all of the costs at once, then they
 * do not pay any of the costs". "Form, Change Form" (p. 21): an identity changes between hero and alter-ego form. So:
 *
 * - the cost is payable only from the other form, and not while a `cannotChangeForm` rule stops the change
 *   ("You cannot change to hero form", Claustrophobia);
 * - an additional cost to change form (`RuleSpec formChangeCost`: Work-Life Balance 61030 "discard 1 card from your
 *   hand", Jubilee's obligation "spend 2 resources of the same type") is **folded into** the cost before it is planned
 *   (`foldChangeFormCost`), so the one plan checks and the one payment pays everything, and every reader of the cost's
 *   picks (the window's hand-discard question, `legalActions`' default picks) sees the folded cost;
 * - `payCost` changes the form (`payChangeFormCost`) without the once-per-round change, its `formChanged` event above
 *   the frame paid for, so "after you change form" responses resolve before the ability's effects.
 *
 * Only parts of an additional cost that the paying player pays from their own cards fold (`FOLDABLE`); a part naming
 * the cost's own card ("exhaust this card") would name the wrong card once folded, and two parts of one kind (two
 * hand discards, two "of the same type" payments) are not merged. Either makes the cost unpayable, with a message
 * that says why: no card in the pool prints such a pairing.
 */

import type { AbilityCost, EngineDeps } from "./abilities.js";
import { type Ctx, emit } from "./ctx.js";
import { changeIdentityForm } from "./effects.js";
import type { EngineErrorCode } from "./errors.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { getPlayer } from "./query.js";
import type { ResourceRequirement } from "./resources.js";
import { pushEvent } from "./resolve/frames.js";
import { cannotChangeForm, formChangeCostsFor, type FormChangeCost } from "./rules.js";
import type { GameState } from "./state.js";

interface Fault {
  readonly code: EngineErrorCode;
  readonly message: string;
}

/** The parts of an additional cost to change form that fold into a `changeForm` cost. */
const FOLDABLE: ReadonlySet<keyof AbilityCost> = new Set<keyof AbilityCost>([
  "resources",
  "sameResourceType",
  "distinctResourceTypes",
  "printedResourcesOnly",
  "discardFromHand",
  "discardRandomFromHand",
  "discardFromDeck",
  "exhaustIdentity",
  "healIdentity",
  "damageSelf",
  "indirectDamage",
]);

/**
 * Whether `paidBy` hands a folded part to another player (`CostSelection.paidBy`, a cost any player may help pay). An
 * additional cost to change form is the changing player's ("discard 1 card from **your** hand", Work-Life Balance
 * 61030; RRG 1.8 "Cost", p. 13), whoever may help with the ability's own cost, so a part it added is never delegated.
 */
export const delegatesFoldedPart = (
  cost: AbilityCost,
  paidBy: Readonly<Record<string, PlayerId | undefined>>,
  playerId: PlayerId,
): boolean => (cost.changeFormFolded ?? []).some((key) => paidBy[key] !== undefined && paidBy[key] !== playerId);

/** The parts that shape the whole payment: folded in only when the ability's own cost spends no resources. */
const PAYMENT_SHAPE: readonly (keyof AbilityCost)[] = [
  "sameResourceType",
  "distinctResourceTypes",
  "printedResourcesOnly",
];
/** The parts by which an ability's own cost spends resources. */
const SPENDS: readonly (keyof AbilityCost)[] = ["resources", "resourcesX", "resourcesEqualTo"];
const has = (cost: AbilityCost, keys: readonly (keyof AbilityCost)[]): boolean =>
  keys.some((key) => cost[key] !== undefined);

/** Fixed resources added together; a size the payer chooses (`ResourcesChoice`) does not add. */
type Resources = NonNullable<AbilityCost["resources"]>;
function addResources(a: AbilityCost["resources"], b: Resources): Resources | null {
  if (a === undefined) return b;
  if ((typeof a === "object" && "choose" in a) || (typeof b === "object" && "choose" in b)) return null;
  const asRequirement = (r: number | ResourceRequirement): ResourceRequirement =>
    typeof r === "number" ? { generic: r } : r;
  if (typeof a === "number" && typeof b === "number") return a + b;
  const x = asRequirement(a as number | ResourceRequirement);
  const y = asRequirement(b as number | ResourceRequirement);
  const sum: Record<string, number> = {};
  for (const key of ["generic", "physical", "mental", "energy", "wild"] as const) {
    const total = (x[key] ?? 0) + (y[key] ?? 0);
    if (total > 0) sum[key] = total;
  }
  return sum as ResourceRequirement;
}

/** The additional costs a `changeForm` cost of `playerId` carries right now (`RuleSpec formChangeCost`). */
export const changeFormExtras = (
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  cost: AbilityCost,
): readonly FormChangeCost[] =>
  cost.changeForm === undefined ? [] : formChangeCostsFor(state, deps, playerId, cost.changeForm);

/**
 * The cost to plan and pay: `cost` itself when it changes no form, else `cost` with every additional cost to change
 * to that form folded in, or the fault that makes it unpayable now (already in that form, a rule forbids the change,
 * an additional cost that does not fold).
 */
export function foldChangeFormCost(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  cost: AbilityCost,
): AbilityCost | Fault {
  const to = cost.changeForm;
  if (to === undefined) return cost;
  const identity = getPlayer(state, playerId)?.identity;
  if (!identity) return { code: "unknown_player", message: `${playerId} is not at this table` };
  const form = to === "hero" ? "hero" : "alter-ego";
  if (identity.form === to) return { code: "no_valid_target", message: `you are already in ${form} form` };
  if (cannotChangeForm(state, deps, playerId, undefined, sourceId)) {
    return { code: "no_valid_target", message: "you cannot change form, so this cost cannot be paid" };
  }
  // Folded already (`changeFormFolded` marks the result): read the checks above again, add nothing twice.
  if (cost.changeFormFolded !== undefined) return cost;
  let folded: AbilityCost = cost;
  const added: (keyof AbilityCost)[] = [];
  for (const { cost: extra } of changeFormExtras(state, deps, playerId, cost)) {
    // "Of the same type", "different", "printed" judge the whole payment, so they cannot join a cost that already
    // spends resources (it would hold the ability's own resources to them), nor resources join a cost shaped so. Read
    // against the cost as folded so far, so a second additional cost meets the first one's parts too.
    if ((has(extra, PAYMENT_SHAPE) && has(folded, SPENDS)) || (has(folded, PAYMENT_SHAPE) && has(extra, SPENDS))) {
      return {
        code: "no_valid_target",
        message: "an additional cost to change form that shapes the payment cannot join a cost that spends resources",
      };
    }
    for (const key of Object.keys(extra) as (keyof AbilityCost)[]) {
      if (extra[key] === undefined) continue;
      if (!FOLDABLE.has(key)) {
        return { code: "no_valid_target", message: `an additional cost to change form (${key}) cannot be paid here` };
      }
      if (key === "resources") {
        const resources = extra.resources === undefined ? null : addResources(folded.resources, extra.resources);
        if (resources === null) {
          return { code: "no_valid_target", message: "a chosen number of resources cannot be added to this cost" };
        }
        folded = { ...folded, resources };
        added.push(key);
        continue;
      }
      if (folded[key] !== undefined) {
        return { code: "no_valid_target", message: `two ${key} parts of one cost cannot be paid together` };
      }
      folded = { ...folded, [key]: extra[key] };
      added.push(key);
    }
  }
  return { ...folded, changeFormFolded: added };
}

/** `foldChangeFormCost` for a reader of a cost's picks: the folded cost, or the cost as written when it is unpayable. */
export function costWithChangeForm(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  cost: AbilityCost | undefined,
): AbilityCost | undefined {
  if (cost?.changeForm === undefined) return cost;
  const folded = foldChangeFormCost(state, deps, sourceId, playerId, cost);
  return "code" in folded ? cost : folded;
}

/**
 * Pays the form change of a planned `changeForm` cost: logs any additional cost as paid (its parts are paid by
 * `payCost` with the rest of the folded cost), then changes the identity's form, not as the once-per-round change,
 * and pushes the change's event above the frame being paid for.
 */
export function payChangeFormCost(ctx: Ctx, playerId: PlayerId, to: "hero" | "alterEgo"): void {
  const extras = formChangeCostsFor(ctx.state, ctx.deps, playerId, to);
  if (extras.length > 0) {
    emit(ctx, {
      type: "formChangeCostSettled",
      playerId,
      to,
      sourceInstanceIds: [...new Set(extras.map((extra) => extra.sourceInstanceId))],
      outcome: "paid",
    });
  }
  // A three-sided identity goes to its first hero face (no card in the pool prints this cost for one).
  const changed = changeIdentityForm(ctx, playerId, to, false, 0);
  if (changed) pushEvent(ctx, changed);
}
