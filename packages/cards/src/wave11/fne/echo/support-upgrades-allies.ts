import type { AbilityRegistry } from "@mc/engine";

/**
 * Wave 11 scripting module `fne/echo/support-upgrades-allies` (docs/phase7-wave11.md §8.4).
 *
 * Cards (7):
 * - 60039 Daredevil (ally)
 * - 60042 The Rez (support)
 * - 60043 American Sign Language (upgrade)
 * - 60044 Choreography (upgrade)
 * - 60045 Echo's Katana (upgrade)
 * - 60046 Improvisation (upgrade)
 * - 60047 Muscle Memory (upgrade)
 *
 * Scaffold: the registry is empty and every other ref is in `FNE_ECHO_SUPPORT_UPGRADES_ALLIES_SKIPPED`. The scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `support-upgrades-allies.test.ts`.
 */
export const FNE_ECHO_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = {};

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const FNE_ECHO_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {
  "60039.daredevil-response": "wave 11 scripting in progress: fne/echo/support-upgrades-allies",
  "60042.the-rez-action": "wave 11 scripting in progress: fne/echo/support-upgrades-allies",
  "60043.american-sign-language-resource": "wave 11 scripting in progress: fne/echo/support-upgrades-allies",
  "60044.choreography-action": "wave 11 scripting in progress: fne/echo/support-upgrades-allies",
  "60045.echos-katana-response": "wave 11 scripting in progress: fne/echo/support-upgrades-allies",
  "60046.improvisation-response": "wave 11 scripting in progress: fne/echo/support-upgrades-allies",
  "60047.muscle-memory-action": "wave 11 scripting in progress: fne/echo/support-upgrades-allies",
};
