import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Shadowland (dark protege; docs/phase7-shadowland.md). The pack is mid-transcription (40 of 70 cards), so this module is a scaffold.
 *
 * Cards (10):
 * - 65012a Archpriestess (villain)
 * - 65013a Daredevil (villain)
 * - 65014a Elektra (villain)
 * - 65015a Gorgon (villain)
 * - 65016a Lady Bullseye (villain)
 * - 65017a White Tiger (villain)
 * - 65018 Art of the Kill (attachment)
 * - 65019 Krahllak's Blessing (attachment)
 * - 65026 Darkness Within (treachery)
 * - 65027 Embraced by Darkness (treachery)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const SHADOWLAND_DARK_PROTEGE: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SHADOWLAND_DARK_PROTEGE_SKIPPED: Readonly<Record<string, string>> = {
  "65012a.archpriestess-forced-response": "Shadowland transcription/scripting in progress",
  "65013a.daredevil-forced-response": "Shadowland transcription/scripting in progress",
  "65014a.elektra-forced-interrupt": "Shadowland transcription/scripting in progress",
  "65015a.gorgon-forced-interrupt": "Shadowland transcription/scripting in progress",
  "65016a.lady-bullseye-forced-response": "Shadowland transcription/scripting in progress",
  "65017a.white-tiger-forced-response": "Shadowland transcription/scripting in progress",
  "65018.art-of-the-kill-forced-interrupt": "Shadowland transcription/scripting in progress",
  "65018.art-of-the-kill-action": "Shadowland transcription/scripting in progress",
  "65019.krahllaks-blessing-forced-interrupt": "Shadowland transcription/scripting in progress",
  "65026.when-revealed": "Shadowland transcription/scripting in progress",
  "65026.boost": "Shadowland transcription/scripting in progress",
  "65027.when-revealed": "Shadowland transcription/scripting in progress",
  "65027.boost": "Shadowland transcription/scripting in progress",
};
