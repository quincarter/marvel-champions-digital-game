import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 11 scripting module `iron_fist/aggression` (docs/phase7-elektra-iron-fist.md). Scaffold: a registry holding only the reprint aliases
 * (an empty one when there are none) with every other ref skipped, so scripting it is editing this file and its test.
 *
 * Cards (1):
 * - 64030 Death by a Thousand Cuts (upgrade)
 */
export const IRON_FIST_AGGRESSION: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const IRON_FIST_AGGRESSION_SKIPPED: Readonly<Record<string, string>> = {
  "64030.death-by-a-thousand-cuts-response": "not scripted yet: Death by a Thousand Cuts response",
};
