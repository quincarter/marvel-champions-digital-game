import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 11 scripting module `elektra/basic` (docs/phase7-elektra-iron-fist.md). Scaffold: an empty registry with every ref
 * skipped, so scripting it is editing this file and its test.
 *
 * Cards (2):
 * - 63023 Hunting Shadows (event)
 * - 63027 Dance with the Devil (upgrade)
 */
export const ELEKTRA_BASIC: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const ELEKTRA_BASIC_SKIPPED: Readonly<Record<string, string>> = {
  "63023.hunting-shadows-action": "not scripted yet: Hunting Shadows top-8 encounter deck search",
  "63027.dance-with-the-devil-action": "not scripted yet: Dance with the Devil attack action",
  "63027.dance-with-the-devil-constant": "not scripted yet: Dance with the Devil Team-Up and amplify",
};
