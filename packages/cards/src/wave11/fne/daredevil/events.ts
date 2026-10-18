import type { AbilityRegistry } from "@mc/engine";

/**
 * Wave 11 scripting module `fne/daredevil/events` (docs/phase7-wave11.md §8.4).
 *
 * Cards (4):
 * - 60008 Cross-Examination (event)
 * - 60009 Deposition (event)
 * - 60010 Living Lie Detector (event)
 * - 60011 Raising Hell (event)
 *
 * Scaffold: the registry is empty and every other ref is in `FNE_DAREDEVIL_EVENTS_SKIPPED`. The scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `events.test.ts`.
 */
export const FNE_DAREDEVIL_EVENTS: AbilityRegistry = {};

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const FNE_DAREDEVIL_EVENTS_SKIPPED: Readonly<Record<string, string>> = {
  "60008.cross-examination-action": "wave 11 scripting in progress: fne/daredevil/events",
  "60009.deposition-action": "wave 11 scripting in progress: fne/daredevil/events",
  "60010.living-lie-detector-action": "wave 11 scripting in progress: fne/daredevil/events",
  "60011.raising-hell-action": "wave 11 scripting in progress: fne/daredevil/events",
};
