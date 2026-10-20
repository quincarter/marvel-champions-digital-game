import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Shadowland (deadly contraptions; docs/phase7-shadowland.md). The pack is mid-transcription (40 of 70 cards), so this module is a scaffold.
 *
 * Cards (6):
 * - 65046 Nervous Jitters (attachment)
 * - 65047 Iron Monk (minion)
 * - 65048 Hall of Punishment (side_scheme)
 * - 65049 Path of a Thousand Cuts (side_scheme)
 * - 65050 Blinding Powder (treachery)
 * - 65051 Caltrops (treachery)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const SHADOWLAND_DEADLY_CONTRAPTIONS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SHADOWLAND_DEADLY_CONTRAPTIONS_SKIPPED: Readonly<Record<string, string>> = {
  "65046.nervous-jitters-forced-interrupt": "Shadowland transcription/scripting in progress",
  "65047.iron-monk-constant": "Shadowland transcription/scripting in progress",
  "65048.hall-of-punishment-forced-interrupt": "Shadowland transcription/scripting in progress",
  "65048.boost": "Shadowland transcription/scripting in progress",
  "65049.path-of-a-thousand-cuts-forced-interrupt": "Shadowland transcription/scripting in progress",
  "65049.boost": "Shadowland transcription/scripting in progress",
  "65050.when-revealed": "Shadowland transcription/scripting in progress",
  "65051.when-revealed": "Shadowland transcription/scripting in progress",
};
