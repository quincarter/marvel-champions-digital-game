import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Modular set `scarlet_twins` (Resistance side) (Synthezoid Smackdown, MC57; docs/phase7-synthezoid.md section 8.3).
 * Scaffold: an empty registry and every ref skipped until the scripting task for this module lands.
 *
 * Cards (5):
 * - 57060 Speed (minion)
 * - 57061 Wiccan (minion)
 * - 57062 Superspeed (treachery)
 * - 57063 Spellcasting (obligation)
 * - 57064 Superpowered Siblings (side_scheme)
 */
export const SYNTHEZOID_MODULAR_SCARLET_TWINS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const SYNTHEZOID_MODULAR_SCARLET_TWINS_SKIPPED: Readonly<Record<string, string>> = {
  "57060.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/scarlet-twins)",
  "57061.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/scarlet-twins)",
  "57062.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/scarlet-twins)",
  "57062.boost": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/scarlet-twins)",
  "57063.obligation": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/scarlet-twins)",
  "57064.when-defeated": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/scarlet-twins)",
};
