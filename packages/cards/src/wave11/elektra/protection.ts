import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 11 scripting module `elektra/protection` (docs/phase7-elektra-iron-fist.md). Scaffold: a registry holding only the reprint aliases
 * (an empty one when there are none) with every other ref skipped, so scripting it is editing this file and its test.
 *
 * Cards (1):
 * - 63039 Moon Knight (ally)
 */
export const ELEKTRA_PROTECTION: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const ELEKTRA_PROTECTION_SKIPPED: Readonly<Record<string, string>> = {
  "63039.moon-knight-interrupt": "not scripted yet: Moon Knight interrupt",
};
