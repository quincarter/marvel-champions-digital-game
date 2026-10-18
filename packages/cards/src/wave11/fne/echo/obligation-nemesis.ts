import type { AbilityRegistry } from "@mc/engine";

/**
 * Wave 11 scripting module `fne/echo/obligation-nemesis` (docs/phase7-wave11.md §8.4).
 *
 * Cards (5):
 * - 60060 Raised by the Kingpin (obligation)
 * - 60061 Kingpin (minion)
 * - 60062 Master Manipulator (side_scheme)
 * - 60063 Kingpin's Henchman (minion)
 * - 60064 Pawn of the Kingpin (treachery)
 *
 * Scaffold: the registry is empty and every other ref is in `FNE_ECHO_OBLIGATION_NEMESIS_SKIPPED`. The scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `obligation-nemesis.test.ts`.
 */
export const FNE_ECHO_OBLIGATION_NEMESIS: AbilityRegistry = {};

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const FNE_ECHO_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {
  "60060.obligation": "wave 11 scripting in progress: fne/echo/obligation-nemesis",
  "60060.when-revealed": "wave 11 scripting in progress: fne/echo/obligation-nemesis",
  "60060.raised-by-the-kingpin-response": "wave 11 scripting in progress: fne/echo/obligation-nemesis",
  "60061.kingpin-forced-interrupt": "wave 11 scripting in progress: fne/echo/obligation-nemesis",
  "60062.master-manipulator-constant": "wave 11 scripting in progress: fne/echo/obligation-nemesis",
  "60062.when-revealed": "wave 11 scripting in progress: fne/echo/obligation-nemesis",
  "60062.boost": "wave 11 scripting in progress: fne/echo/obligation-nemesis",
  "60063.kingpins-henchman-constant": "wave 11 scripting in progress: fne/echo/obligation-nemesis",
  "60064.when-revealed-alter-ego": "wave 11 scripting in progress: fne/echo/obligation-nemesis",
  "60064.when-revealed-hero": "wave 11 scripting in progress: fne/echo/obligation-nemesis",
};
