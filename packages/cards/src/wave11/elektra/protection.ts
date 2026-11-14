import type { AbilityRegistry } from "@mc/engine";
import {
  attackingEnemy,
  dealDamage,
  defineAbilities,
  discardFacedownBoostCards,
  ifThen,
  interrupt,
  modifyAttack,
  paidType,
  spendChosen,
  when,
} from "../../dsl/index.js";

/**
 * Wave 11 scripting module `elektra/protection` (docs/phase7-elektra-iron-fist.md).
 *
 * Cards (1):
 * - 63039 Moon Knight (ally)
 *
 * **63039.moon-knight-interrupt**: "When Moon Knight defends, spend up to 3 resources → if you spent at least 1: …".
 * Settled by the rules expert: each line resolves once if at least one resource of its type was spent, and every
 * qualifying line resolves (not once per resource, not a choice), as Husk 47012 reads (`spendChosen(3)` +
 * `ifThen(paidType(type), …)`, docs/phase7-wave8.md §3.62); a wild left a wild matches no line (owner Q33 = B). "Up
 * to 3" needs at least 1 (RRG 1.8 "Cost", p. 14), so "if you spent at least 1" always holds once the cost is paid.
 * [energy] prevents 2 of the attack's damage (`modifyAttack.preventDamage`, as Iron Fist 62012); [mental] discards 1
 * of the attacker's facedown boost cards before step 3 turns them up (`discardFacedownBoostCards`): with two or more,
 * Moon Knight's controller picks which, offered facedown by the order dealt, the first dealt being the pick when
 * nothing is known about them (owner decision 7, docs/phase7-elektra-iron-fist.md §5; RRG 1.8 "Choose", p. 12);
 * [physical] deals 2
 * damage to the attacker (not an attack).
 */
export const ELEKTRA_PROTECTION: AbilityRegistry = defineAbilities({
  "63039.moon-knight-interrupt": interrupt(
    when.defends({ self: true }),
    { cost: spendChosen(3), readsPaidTypes: { types: ["energy", "mental", "physical"] } },
    ifThen(paidType("energy"), modifyAttack({ preventDamage: 2 })),
    ifThen(paidType("mental"), discardFacedownBoostCards(attackingEnemy, 1, { choose: true })),
    ifThen(paidType("physical"), dealDamage(2, attackingEnemy)),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const ELEKTRA_PROTECTION_SKIPPED: Readonly<Record<string, string>> = {};
