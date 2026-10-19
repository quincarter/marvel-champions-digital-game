import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * The Cops modular set (docs/phase7-wave11-scenarios.md section S6).
 *
 * Cards (4):
 * - 60182 Cop (minion)
 * - 60183 Crooked Cop (minion)
 * - 60184 Wanted (obligation)
 * - 60185 Police Cordon (side_scheme)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const FNE_MODULAR_COPS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_MODULAR_COPS_SKIPPED: Readonly<Record<string, string>> = {
  "60182.cop-forced-interrupt": "wave 11 scripting in progress: fne/modular/cops",
  "60182.when-defeated": "wave 11 scripting in progress: fne/modular/cops",
  "60183.when-defeated": "wave 11 scripting in progress: fne/modular/cops",
  "60183.boost": "wave 11 scripting in progress: fne/modular/cops",
  "60184.obligation": "wave 11 scripting in progress: fne/modular/cops",
  "60185.police-cordon-constant": "wave 11 scripting in progress: fne/modular/cops",
  "60185.when-revealed": "wave 11 scripting in progress: fne/modular/cops",
};
