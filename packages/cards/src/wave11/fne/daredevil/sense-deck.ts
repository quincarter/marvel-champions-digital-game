import type { AbilityRegistry } from "@mc/engine";

/**
 * Wave 11 scripting module `fne/daredevil/sense-deck` (docs/phase7-wave11.md §8.4).
 *
 * Cards (5):
 * - 60002 Acute Tactility (upgrade)
 * - 60003 Enhanced Olfaction (upgrade)
 * - 60004 Heightened Hearing (upgrade)
 * - 60005 Radar Sense (upgrade)
 * - 60006 Superior Taste (upgrade)
 *
 * Scaffold: the registry is empty and every other ref is in `FNE_DAREDEVIL_SENSE_DECK_SKIPPED`. The scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `sense-deck.test.ts`.
 */
export const FNE_DAREDEVIL_SENSE_DECK: AbilityRegistry = {};

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const FNE_DAREDEVIL_SENSE_DECK_SKIPPED: Readonly<Record<string, string>> = {
  "60002.acute-tactility-interrupt": "wave 11 scripting in progress: fne/daredevil/sense-deck",
  "60003.enhanced-olfaction-interrupt": "wave 11 scripting in progress: fne/daredevil/sense-deck",
  "60004.heightened-hearing-interrupt": "wave 11 scripting in progress: fne/daredevil/sense-deck",
  "60005.radar-sense-response": "wave 11 scripting in progress: fne/daredevil/sense-deck",
  "60006.superior-taste-response": "wave 11 scripting in progress: fne/daredevil/sense-deck",
};
