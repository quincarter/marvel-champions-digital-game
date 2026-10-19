import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Modular set `taskmaster_modular` (Registration side) (Synthezoid Smackdown, MC57; docs/phase7-synthezoid.md section 8.3).
 * Scaffold: an empty registry and every ref skipped until the scripting task for this module lands.
 *
 * Cards (5):
 * - 57022 Taskmaster (minion)
 * - 57023 Taskmaster's Sword (attachment)
 * - 57024 Taskmaster's Shield (attachment)
 * - 57025 Mimicked Move (treachery)
 * - 57026 Taskmaster's Academy (side_scheme)
 */
export const SYNTHEZOID_MODULAR_TASKMASTER: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const SYNTHEZOID_MODULAR_TASKMASTER_SKIPPED: Readonly<Record<string, string>> = {
  "57022.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/taskmaster)",
  "57023.taskmasters-sword-constant": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/taskmaster)",
  "57023.taskmasters-sword-action": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/taskmaster)",
  "57024.taskmasters-shield-forced-interrupt":
    "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/taskmaster)",
  "57024.taskmasters-shield-action": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/taskmaster)",
  "57025.when-revealed": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/taskmaster)",
  "57025.boost": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/taskmaster)",
  "57026.when-defeated": "wave 11 PR: synthezoid scripting in progress (synthezoid/modular/taskmaster)",
};
