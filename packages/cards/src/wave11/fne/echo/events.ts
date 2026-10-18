import type { AbilityRegistry } from "@mc/engine";

/**
 * Wave 11 scripting module `fne/echo/events` (docs/phase7-wave11.md §8.4).
 *
 * Cards (4):
 * - 60040a Photographic Reflexes (event)
 * - 60040b Photographic Reflexes (event)
 * - 60040c Photographic Reflexes (event)
 * - 60041 Study the Tape (event)
 *
 * Scaffold: the registry is empty and every other ref is in `FNE_ECHO_EVENTS_SKIPPED`. The scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `events.test.ts`.
 */
export const FNE_ECHO_EVENTS: AbilityRegistry = {};

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const FNE_ECHO_EVENTS_SKIPPED: Readonly<Record<string, string>> = {
  "60040a.photographic-reflexes-constant": "wave 11 scripting in progress: fne/echo/events",
  "60040b.photographic-reflexes-constant": "wave 11 scripting in progress: fne/echo/events",
  "60040c.photographic-reflexes-constant": "wave 11 scripting in progress: fne/echo/events",
  "60041.study-the-tape-action": "wave 11 scripting in progress: fne/echo/events",
};
