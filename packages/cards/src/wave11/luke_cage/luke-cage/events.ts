import type { AbilityRegistry } from "@mc/engine";

/**
 * Wave 11 scripting module `luke_cage/luke-cage/events` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (4):
 * - 62003 Harlem's Hero (event)
 * - 62004 Knuckle Sandwich (event)
 * - 62005 "Stand with Me!" (event)
 * - 62006 "Sweet Christmas!" (event)
 *
 * Scaffold (HS0): the registry is empty and every ref is in `LUKE_CAGE_LUKE_CAGE_EVENTS_SKIPPED`. The scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `events.test.ts`.
 */
export const LUKE_CAGE_LUKE_CAGE_EVENTS: AbilityRegistry = {};

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const LUKE_CAGE_LUKE_CAGE_EVENTS_SKIPPED: Readonly<Record<string, string>> = {
  "62003.harlems-hero-action": "wave 11 scripting in progress: luke_cage/luke-cage/events",
  "62004.knuckle-sandwich-action": "wave 11 scripting in progress: luke_cage/luke-cage/events",
  "62005.stand-with-me-action": "wave 11 scripting in progress: luke_cage/luke-cage/events",
  "62006.sweet-christmas-constant": "wave 11 scripting in progress: luke_cage/luke-cage/events",
  "62006.sweet-christmas-action": "wave 11 scripting in progress: luke_cage/luke-cage/events",
};
