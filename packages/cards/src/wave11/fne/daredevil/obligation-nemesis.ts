import type { AbilityRegistry } from "@mc/engine";

/**
 * Wave 11 scripting module `fne/daredevil/obligation-nemesis` (docs/phase7-wave11.md §8.4).
 *
 * Cards (5):
 * - 60032 Sensory Overload (obligation)
 * - 60033 Bullseye (minion)
 * - 60034 Deadliest Man Alive (side_scheme)
 * - 60035 Stolen Sai (attachment)
 * - 60036 Eye on the Target (treachery)
 *
 * Scaffold: the registry is empty and every other ref is in `FNE_DAREDEVIL_OBLIGATION_NEMESIS_SKIPPED`. The scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `obligation-nemesis.test.ts`.
 */
export const FNE_DAREDEVIL_OBLIGATION_NEMESIS: AbilityRegistry = {};

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const FNE_DAREDEVIL_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {
  "60032.obligation": "wave 11 scripting in progress: fne/daredevil/obligation-nemesis",
  "60032.sensory-overload-forced-response": "wave 11 scripting in progress: fne/daredevil/obligation-nemesis",
  "60032.sensory-overload-response": "wave 11 scripting in progress: fne/daredevil/obligation-nemesis",
  "60033.when-revealed": "wave 11 scripting in progress: fne/daredevil/obligation-nemesis",
  "60034.deadliest-man-alive-forced-interrupt": "wave 11 scripting in progress: fne/daredevil/obligation-nemesis",
  "60035.stolen-sai-constant": "wave 11 scripting in progress: fne/daredevil/obligation-nemesis",
  "60035.stolen-sai-action": "wave 11 scripting in progress: fne/daredevil/obligation-nemesis",
  "60035.boost": "wave 11 scripting in progress: fne/daredevil/obligation-nemesis",
  "60036.when-revealed": "wave 11 scripting in progress: fne/daredevil/obligation-nemesis",
};
