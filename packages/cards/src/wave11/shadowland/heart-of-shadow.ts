import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Shadowland (heart of shadow; docs/phase7-shadowland.md). The pack is mid-transcription (40 of 70 cards), so this module is a scaffold.
 *
 * Cards (7):
 * - 65057 Krahllak (villain)
 * - 65064 Mark of the Wicked (attachment)
 * - 65065 Pull of Power (attachment)
 * - 65067 Hellbride (minion)
 * - 65069 Snakeroot Elders (minion)
 * - 65070 Veil of Nightmares (side_scheme)
 * - 65071 Submit or Suffer (treachery)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const SHADOWLAND_HEART_OF_SHADOW: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SHADOWLAND_HEART_OF_SHADOW_SKIPPED: Readonly<Record<string, string>> = {
  "65057.krahllak-interrupt": "Shadowland transcription/scripting in progress",
  "65064.when-revealed": "Shadowland transcription/scripting in progress",
  "65064.mark-of-the-wicked-forced-response": "Shadowland transcription/scripting in progress",
  "65065.when-revealed": "Shadowland transcription/scripting in progress",
  "65065.pull-of-power-forced-response": "Shadowland transcription/scripting in progress",
  "65067.when-defeated": "Shadowland transcription/scripting in progress",
  "65067.hellbride-action": "Shadowland transcription/scripting in progress",
  "65069.snakeroot-elders-constant": "Shadowland transcription/scripting in progress",
  "65069.when-revealed": "Shadowland transcription/scripting in progress",
  "65070.veil-of-nightmares-action": "Shadowland transcription/scripting in progress",
  "65071.when-revealed": "Shadowland transcription/scripting in progress",
  "65071.boost": "Shadowland transcription/scripting in progress",
};
