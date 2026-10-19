import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Modular set `thunderbolts_modular` (Registration side) (Synthezoid Smackdown, MC57; docs/phase7-synthezoid.md section 8.3).
 * Scaffold: an empty registry and every ref skipped until the scripting task for this module lands.
 *
 * Cards (5):
 * - 57017 Atlas (minion)
 * - 57018 Songbird (minion)
 * - 57019 Penance (minion)
 * - 57020 Justice Like Lightning (treachery)
 * - 57021 The Thunderbolts (side_scheme)
 */
export const SYNTHEZOID_MODULAR_THUNDERBOLTS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const SYNTHEZOID_MODULAR_THUNDERBOLTS_SKIPPED: Readonly<Record<string, string>> = {
  "57017.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/thunderbolts)",
  "57017.boost": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/thunderbolts)",
  "57018.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/thunderbolts)",
  "57018.boost": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/thunderbolts)",
  "57019.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/thunderbolts)",
  "57019.boost": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/thunderbolts)",
  "57020.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/thunderbolts)",
  "57021.the-thunderbolts-constant": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/thunderbolts)",
};
