import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Modular set `shield_ops` (Registration side) (Synthezoid Smackdown, MC57; docs/phase7-synthezoid.md section 8.3).
 * Scaffold: an empty registry and every ref skipped until the scripting task for this module lands.
 *
 * Cards (4):
 * - 57013 S.H.I.E.L.D. Operator (minion)
 * - 57014 Strategic Overwatch (treachery)
 * - 57015 Rapid Response (treachery)
 * - 57016 Homeland Security (side_scheme)
 */
export const SYNTHEZOID_MODULAR_SHIELD_OPS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const SYNTHEZOID_MODULAR_SHIELD_OPS_SKIPPED: Readonly<Record<string, string>> = {
  "57013.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/shield-ops)",
  "57014.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/shield-ops)",
  "57014.boost": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/shield-ops)",
  "57015.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/shield-ops)",
  "57016.homeland-security-constant": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/shield-ops)",
};
