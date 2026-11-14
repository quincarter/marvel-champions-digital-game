import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 11 scripting module `iron_fist/leadership` (docs/phase7-elektra-iron-fist.md). Scaffold: a registry holding only the reprint aliases
 * (an empty one when there are none) with every other ref skipped, so scripting it is editing this file and its test.
 *
 * Cards (2):
 * - 64031 Zen-Like Calm (event)
 * - 64032 Sensei (upgrade)
 */
export const IRON_FIST_LEADERSHIP: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const IRON_FIST_LEADERSHIP_SKIPPED: Readonly<Record<string, string>> = {
  "64031.zen-like-calm-action": "not scripted yet: Zen-Like Calm action",
  "64032.sensei-constant": "not scripted yet: Sensei constant",
};
