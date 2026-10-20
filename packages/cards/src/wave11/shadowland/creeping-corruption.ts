import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Shadowland (creeping corruption; docs/phase7-shadowland.md). The pack is mid-transcription (40 of 70 cards), so this module is a scaffold.
 *
 * Cards (1):
 * - 65072a Creeping Corruption (upgrade)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const SHADOWLAND_CREEPING_CORRUPTION: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SHADOWLAND_CREEPING_CORRUPTION_SKIPPED: Readonly<Record<string, string>> = {
  "65072a.creeping-corruption-constant": "Shadowland transcription/scripting in progress",
  "65072a.creeping-corruption-action": "Shadowland transcription/scripting in progress",
  "65072b.creeping-corruption-constant": "Shadowland transcription/scripting in progress",
  "65072b.creeping-corruption-action": "Shadowland transcription/scripting in progress",
};
