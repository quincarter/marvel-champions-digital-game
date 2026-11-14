import type { AbilityRegistry } from "@mc/engine";
import { after, attackAnEnemy, defineAbilities, query, response } from "../../dsl/index.js";

/**
 * Wave 11 scripting module `iron_fist/aggression` (docs/phase7-elektra-iron-fist.md).
 *
 * Cards (1):
 * - 64030 Death by a Thousand Cuts (upgrade)
 *
 * **64030.death-by-a-thousand-cuts-response**: "Response (attack): After you play a card (including this one)": `youPlayedCard`
 * for any card (Move in Shadow's shape, fne 60027); the damage is an attack by your identity (RRG 1.8 "Labeled
 * Ability", p. 26), so guard, retaliate and "after you attack" apply. Discount and Temporary are data.
 */
export const IRON_FIST_AGGRESSION: AbilityRegistry = defineAbilities({
  "64030.death-by-a-thousand-cuts-response": response(
    after.youPlayedCard(query([])),
    { label: "attack" },
    attackAnEnemy(1),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const IRON_FIST_AGGRESSION_SKIPPED: Readonly<Record<string, string>> = {};
