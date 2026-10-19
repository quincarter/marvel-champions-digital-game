import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Modular set `moon_knight_modular` (Resistance side) (Synthezoid Smackdown, MC57; docs/phase7-synthezoid.md section 8.3).
 * Scaffold: an empty registry and every ref skipped until the scripting task for this module lands.
 *
 * Cards (4):
 * - 57065 Moon Knight (minion)
 * - 57066 Crescent Dart (attachment)
 * - 57067 Fist of Khonshu (treachery)
 * - 57068 Khonshu's Avatar (side_scheme)
 */
export const SYNTHEZOID_MODULAR_MOON_KNIGHT: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const SYNTHEZOID_MODULAR_MOON_KNIGHT_SKIPPED: Readonly<Record<string, string>> = {
  "57065.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/moon-knight)",
  "57066.crescent-dart-forced-interrupt":
    "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/moon-knight)",
  "57067.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/moon-knight)",
  "57067.boost": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/moon-knight)",
  "57068.when-defeated": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/moon-knight)",
};
