import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Shadowland (ninja swarm; docs/phase7-shadowland.md). The pack is mid-transcription (40 of 70 cards), so this module is a scaffold.
 *
 * Cards (5):
 * - 65028 Black Mountain (minion)
 * - 65030 Bo Staff Ninja (minion)
 * - 65032 Katana Ninja (minion)
 * - 65035 Dancing Shadows (side_scheme)
 * - 65036 Countless Numbers (treachery)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const SHADOWLAND_NINJA_SWARM: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SHADOWLAND_NINJA_SWARM_SKIPPED: Readonly<Record<string, string>> = {
  "65028.black-mountain-constant": "Shadowland transcription/scripting in progress",
  "65028.boost": "Shadowland transcription/scripting in progress",
  "65030.when-defeated": "Shadowland transcription/scripting in progress",
  "65032.when-defeated": "Shadowland transcription/scripting in progress",
  "65035.dancing-shadows-constant": "Shadowland transcription/scripting in progress",
  "65035.dancing-shadows-constant-2": "Shadowland transcription/scripting in progress",
  "65035.boost": "Shadowland transcription/scripting in progress",
  "65036.when-revealed": "Shadowland transcription/scripting in progress",
  "65036.boost": "Shadowland transcription/scripting in progress",
};
