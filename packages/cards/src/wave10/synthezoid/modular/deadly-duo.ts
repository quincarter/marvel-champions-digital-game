import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Modular set `deadly_duo` (Registration side) (Synthezoid Smackdown, MC57; docs/phase7-synthezoid.md section 8.3).
 * Scaffold: an empty registry and every ref skipped until the scripting task for this module lands.
 *
 * Cards (5):
 * - 57027 Jester (minion)
 * - 57028 Jack O'Lantern (minion)
 * - 57029 Mad Jack's Platform (attachment)
 * - 57030 Jester's Yo-Yo (treachery)
 * - 57031 Deadly Duo (side_scheme)
 */
export const SYNTHEZOID_MODULAR_DEADLY_DUO: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const SYNTHEZOID_MODULAR_DEADLY_DUO_SKIPPED: Readonly<Record<string, string>> = {
  "57027.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/deadly-duo)",
  "57028.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/deadly-duo)",
  "57029.mad-jacks-platform-constant": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/deadly-duo)",
  "57029.mad-jacks-platform-constant-2": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/deadly-duo)",
  "57029.boost": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/deadly-duo)",
  "57030.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/deadly-duo)",
  "57030.boost": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/deadly-duo)",
  "57031.when-defeated": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/deadly-duo)",
};
