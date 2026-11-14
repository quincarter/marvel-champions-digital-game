import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";
import { FNE_ASPECT_BASIC_BASIC } from "../fne/aspect-basic/basic.js";

/**
 * Wave 11 scripting module `elektra/basic` (docs/phase7-elektra-iron-fist.md). Scaffold: a registry holding only the reprint aliases
 * (an empty one when there are none) with every other ref skipped, so scripting it is editing this file and its test.
 *
 * Cards (3):
 * - 63022 Stone (ally)
 * - 63023 Hunting Shadows (event)
 * - 63027 Dance with the Devil (upgrade)
 *
 * Reprints, aliased to the original card's script: 63027.
 */
export const ELEKTRA_BASIC: AbilityRegistry = defineAbilities({
  "63027.dance-with-the-devil-action": FNE_ASPECT_BASIC_BASIC["60031.dance-with-the-devil-action"]!,
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const ELEKTRA_BASIC_SKIPPED: Readonly<Record<string, string>> = {
  "63022.stone-response": "not scripted yet: Stone response",
  "63023.hunting-shadows-action": "not scripted yet: Hunting Shadows top-8 encounter deck search",
};
