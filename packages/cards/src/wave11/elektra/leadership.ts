import type { AbilityRegistry } from "@mc/engine";
import {
  chooseNumber,
  defineAbilities,
  interrupt,
  modifyBasicPower,
  modifyConsequentialDamage,
  on,
  varOf,
} from "../../dsl/index.js";

/**
 * Wave 11 scripting module `elektra/leadership` (docs/phase7-elektra-iron-fist.md).
 *
 * Cards (1):
 * - 63038 Moondragon (ally)
 *
 * **63038 Moondragon**: an optional interrupt to her own basic power (`on.basicPowerUsing("self")`, not the hero's):
 * the player chooses 1 to 3, and X is added to that power and to the consequential damage she takes for this use.
 */
export const ELEKTRA_LEADERSHIP: AbilityRegistry = defineAbilities({
  "63038.moondragon-interrupt": interrupt(
    on.basicPowerUsing("self"),
    chooseNumber("x", 3, { min: 1 }),
    modifyBasicPower(varOf("x.amount")),
    modifyConsequentialDamage(varOf("x.amount")),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const ELEKTRA_LEADERSHIP_SKIPPED: Readonly<Record<string, string>> = {};
