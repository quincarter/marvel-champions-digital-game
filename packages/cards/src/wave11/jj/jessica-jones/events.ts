import type { AbilityRegistry } from "@mc/engine";

/**
 * Wave 11 scripting module `jj/jessica-jones/events` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (4):
 * - 61004 "Big Mistake" (event)
 * - 61005 Breakthrough (event)
 * - 61006 Snooping Around (event)
 * - 61007 Piecing It All Together (player_side_scheme)
 *
 * Scaffold (HS0): the registry is empty and every ref is in `JJ_JESSICA_JONES_EVENTS_SKIPPED`. The scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `events.test.ts`.
 */
export const JJ_JESSICA_JONES_EVENTS: AbilityRegistry = {};

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const JJ_JESSICA_JONES_EVENTS_SKIPPED: Readonly<Record<string, string>> = {
  "61004.big-mistake-action": "wave 11 scripting in progress: jj/jessica-jones/events",
  "61005.breakthrough-response": "wave 11 scripting in progress: jj/jessica-jones/events",
  "61006.snooping-around-action": "wave 11 scripting in progress: jj/jessica-jones/events",
  "61007.piecing-it-all-together-constant": "wave 11 scripting in progress: jj/jessica-jones/events",
  "61007.when-defeated": "wave 11 scripting in progress: jj/jessica-jones/events",
};
