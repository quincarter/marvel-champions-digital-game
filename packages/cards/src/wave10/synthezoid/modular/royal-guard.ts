import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Modular set `royal_guard` (Resistance side) (Synthezoid Smackdown, MC57; docs/phase7-synthezoid.md section 8.3).
 * Scaffold: an empty registry and every ref skipped until the scripting task for this module lands.
 *
 * Cards (5):
 * - 57069 Janus (minion)
 * - 57070 Amir (minion)
 * - 57071 Atlanteans (treachery)
 * - 57072 Blood Debt (obligation)
 * - 57073 The Royal Guard (side_scheme)
 */
export const SYNTHEZOID_MODULAR_ROYAL_GUARD: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const SYNTHEZOID_MODULAR_ROYAL_GUARD_SKIPPED: Readonly<Record<string, string>> = {
  "57069.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/royal-guard)",
  "57070.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/royal-guard)",
  "57071.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/royal-guard)",
  "57072.blood-debt-constant": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/royal-guard)",
  "57072.blood-debt-action": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/royal-guard)",
  "57073.when-defeated": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/royal-guard)",
};
