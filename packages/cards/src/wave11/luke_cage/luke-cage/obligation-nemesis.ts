import type { AbilityRegistry } from "@mc/engine";

/**
 * Wave 11 scripting module `luke_cage/luke-cage/obligation-nemesis` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (6):
 * - 62028 Internal Injury (obligation)
 * - 62029 Cottonmouth (minion)
 * - 62030 Venomous Whispers (side_scheme)
 * - 62031 Augmented Jaws (attachment)
 * - 62032 Asp (minion)
 * - 62033 Sidewinder (minion)
 *
 * Scaffold (HS0): the registry is empty and every ref is in `LUKE_CAGE_LUKE_CAGE_OBLIGATION_NEMESIS_SKIPPED`. The
 * scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `obligation-nemesis.test.ts`.
 */
export const LUKE_CAGE_LUKE_CAGE_OBLIGATION_NEMESIS: AbilityRegistry = {};

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const LUKE_CAGE_LUKE_CAGE_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {
  "62028.obligation": "wave 11 scripting in progress: luke_cage/luke-cage/obligation-nemesis",
  "62028.internal-injury-forced-response": "wave 11 scripting in progress: luke_cage/luke-cage/obligation-nemesis",
  "62028.internal-injury-response": "wave 11 scripting in progress: luke_cage/luke-cage/obligation-nemesis",
  "62029.cottonmouth-forced-response": "wave 11 scripting in progress: luke_cage/luke-cage/obligation-nemesis",
  "62029.boost": "wave 11 scripting in progress: luke_cage/luke-cage/obligation-nemesis",
  "62030.venomous-whispers-constant": "wave 11 scripting in progress: luke_cage/luke-cage/obligation-nemesis",
  "62030.when-defeated": "wave 11 scripting in progress: luke_cage/luke-cage/obligation-nemesis",
  "62030.boost": "wave 11 scripting in progress: luke_cage/luke-cage/obligation-nemesis",
  "62031.augmented-jaws-forced-interrupt": "wave 11 scripting in progress: luke_cage/luke-cage/obligation-nemesis",
  "62031.augmented-jaws-action": "wave 11 scripting in progress: luke_cage/luke-cage/obligation-nemesis",
  "62032.asp-forced-response": "wave 11 scripting in progress: luke_cage/luke-cage/obligation-nemesis",
  "62032.boost": "wave 11 scripting in progress: luke_cage/luke-cage/obligation-nemesis",
  "62033.sidewinder-forced-interrupt": "wave 11 scripting in progress: luke_cage/luke-cage/obligation-nemesis",
};
