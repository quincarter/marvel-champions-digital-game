import type { AbilityRegistry } from "@mc/engine";

/**
 * Wave 11 scripting module `jj/jessica-jones/obligation-nemesis` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (6):
 * - 61030 Work-Life Balance (obligation)
 * - 61031 Purple Man (minion)
 * - 61032 Indomitable Will (side_scheme)
 * - 61033a Suggestion (obligation)
 * - 61033b Suggestion (obligation)
 * - 61033c Suggestion (obligation)
 *
 * Scaffold (HS0): the registry is empty and every ref is in `JJ_JESSICA_JONES_OBLIGATION_NEMESIS_SKIPPED`. The
 * scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `obligation-nemesis.test.ts`.
 */
export const JJ_JESSICA_JONES_OBLIGATION_NEMESIS: AbilityRegistry = {};

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const JJ_JESSICA_JONES_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {
  "61030.work-life-balance-constant": "wave 11 scripting in progress: jj/jessica-jones/obligation-nemesis",
  "61030.work-life-balance-action": "wave 11 scripting in progress: jj/jessica-jones/obligation-nemesis",
  "61031.purple-man-constant": "wave 11 scripting in progress: jj/jessica-jones/obligation-nemesis",
  "61032.when-revealed": "wave 11 scripting in progress: jj/jessica-jones/obligation-nemesis",
  "61032.indomitable-will-forced-response": "wave 11 scripting in progress: jj/jessica-jones/obligation-nemesis",
  "61033a.suggestion-constant": "wave 11 scripting in progress: jj/jessica-jones/obligation-nemesis",
  "61033a.suggestion-forced-action": "wave 11 scripting in progress: jj/jessica-jones/obligation-nemesis",
  "61033b.suggestion-constant": "wave 11 scripting in progress: jj/jessica-jones/obligation-nemesis",
  "61033b.suggestion-forced-action": "wave 11 scripting in progress: jj/jessica-jones/obligation-nemesis",
  "61033c.suggestion-constant": "wave 11 scripting in progress: jj/jessica-jones/obligation-nemesis",
  "61033c.suggestion-forced-action": "wave 11 scripting in progress: jj/jessica-jones/obligation-nemesis",
};
