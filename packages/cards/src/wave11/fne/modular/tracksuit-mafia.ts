import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * The Tracksuit Mafia modular set (docs/phase7-wave11-scenarios.md section S6).
 *
 * Cards (5):
 * - 60200 Ivan Banionis (minion)
 * - 60201 The Clown (minion)
 * - 60202 Tracksuit Mafioso (minion)
 * - 60203 Tracksuit Bro (minion)
 * - 60204 Tracksuit Mafia (side_scheme)
 *
 * Scaffold: empty until the module's scripting task fills it and deletes its `_SKIPPED` lines.
 */
export const FNE_MODULAR_TRACKSUIT_MAFIA: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_MODULAR_TRACKSUIT_MAFIA_SKIPPED: Readonly<Record<string, string>> = {
  "60200.when-revealed": "wave 11 scripting in progress: fne/modular/tracksuit-mafia",
  "60200.ivan-banionis-forced-response": "wave 11 scripting in progress: fne/modular/tracksuit-mafia",
  "60201.the-clown-forced-response": "wave 11 scripting in progress: fne/modular/tracksuit-mafia",
  "60202.when-defeated": "wave 11 scripting in progress: fne/modular/tracksuit-mafia",
  "60203.when-defeated": "wave 11 scripting in progress: fne/modular/tracksuit-mafia",
  "60204.when-revealed": "wave 11 scripting in progress: fne/modular/tracksuit-mafia",
  "60204.tracksuit-mafia-forced-response": "wave 11 scripting in progress: fne/modular/tracksuit-mafia",
};
