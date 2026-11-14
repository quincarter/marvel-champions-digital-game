import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 11 scripting module `elektra/leadership` (docs/phase7-elektra-iron-fist.md). Scaffold: a registry holding only the reprint aliases
 * (an empty one when there are none) with every other ref skipped, so scripting it is editing this file and its test.
 *
 * Cards (1):
 * - 63038 Moondragon (ally)
 */
export const ELEKTRA_LEADERSHIP: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const ELEKTRA_LEADERSHIP_SKIPPED: Readonly<Record<string, string>> = {
  "63038.moondragon-interrupt": "not scripted yet: Moondragon interrupt",
};
