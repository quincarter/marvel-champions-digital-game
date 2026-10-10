import type { AbilityRegistry } from "@mc/engine";
import {
  anAttackableEnemy,
  attack,
  chosen,
  defineAbilities,
  heroAction,
  ifThen,
  paidWith,
  stun,
} from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `winter/winter-soldier/events` (docs/phase7-wave9.md section 8.4, 3.52). `card-groups.ts` maps
 * this module to the ids below; keep the two in step.
 *
 * Cards (3):
 * - 54004 Arm Block (event)
 * - 54005 Metal Punch (event)
 * - 54006 Electrical Discharge (event)
 *
 * **54006.electrical-discharge-action** (Hero Action, attack): deal 4 damage to an enemy; if the event was paid for using
 * at least one [energy] resource (a paid wild counts as any type, `paidWith`; an overpaid resource was not paid), stun
 * that enemy. The attack is the labeled attack (guard applies); the stun follows the damage and does nothing to an
 * enemy the attack defeated.
 *
 * **54004 Arm Block and 54005 Metal Punch** are skipped: both read "if you exhausted Cybernetic Arm to pay for this
 * event", and the engine records the payment only as resource totals by type (`paid.<type>`, `paid.cards.<type>`,
 * `paid.as.<type>`, actions.ts `paymentVars`), never which card or ability produced a resource. `paidWith("wild")`
 * would also be true for a wild icon on a discarded resource card, and an Arm exhausted earlier in the turn is
 * indistinguishable from one exhausted for this payment. See the reasons below.
 */
export const WINTER_SOLDIER_EVENTS: AbilityRegistry = defineAbilities({
  "54006.electrical-discharge-action": heroAction(
    { label: "attack" },
    anAttackableEnemy(),
    attack(4, chosen("enemy")),
    ifThen(paidWith("energy"), stun(chosen("enemy"))),
  ),
});

const ARM_PAYMENT_GAP =
  'needs a predicate or payment var for "you exhausted Cybernetic Arm (a named resource ability) to pay for this event": ' +
  "the payment vars built in packages/engine/src/actions.ts record resources by type only (paid.<type>, paid.cards.<type>, " +
  "paid.as.<type>), not the source card or ability, so no DSL predicate can tell the Arm from a wild icon or from an Arm " +
  "exhausted earlier. Fix: the engine records the source card ids of resource abilities used in a payment (for example " +
  "paid.abilityOf.<cardId>) plus a DSL predicate paidByExhausting(query); Cybernetic Arm 54002 then needs no change.";

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const WINTER_SOLDIER_EVENTS_SKIPPED: Readonly<Record<string, string>> = {
  "54004.arm-block-constant": `Arm Block (damage to the attacker is exact, the prevent-all-damage rider) ${ARM_PAYMENT_GAP}`,
  "54005.metal-punch-action": `Metal Punch (7 damage; the overkill rider) ${ARM_PAYMENT_GAP}`,
};
