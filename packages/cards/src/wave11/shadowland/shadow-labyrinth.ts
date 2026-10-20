import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Shadowland (shadow labyrinth; docs/phase7-shadowland.md). The pack is mid-transcription (40 of 70 cards), so this module is a scaffold.
 *
 * Cards (5):
 * - 65037 Shifting Corridors (villain)
 * - 65041 Lord Deathstrike (minion)
 * - 65042 Dead End (side_scheme)
 * - 65044 No Time to Think! (treachery)
 * - 65045 Sudden Shift (treachery)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const SHADOWLAND_SHADOW_LABYRINTH: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SHADOWLAND_SHADOW_LABYRINTH_SKIPPED: Readonly<Record<string, string>> = {
  "65037.shifting-corridors-forced-interrupt": "Shadowland transcription/scripting in progress",
  "65037.shifting-corridors-constant": "Shadowland transcription/scripting in progress",
  "65041.when-revealed": "Shadowland transcription/scripting in progress",
  "65041.boost": "Shadowland transcription/scripting in progress",
  "65042.when-revealed": "Shadowland transcription/scripting in progress",
  "65044.when-revealed": "Shadowland transcription/scripting in progress",
  "65044.boost": "Shadowland transcription/scripting in progress",
  "65045.when-revealed": "Shadowland transcription/scripting in progress",
  "65045.boost": "Shadowland transcription/scripting in progress",
};
