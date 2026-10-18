import type { AbilityRegistry } from "@mc/engine";

/**
 * Wave 11 scripting module `luke_cage/luke-cage/support-upgrades-allies` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (6):
 * - 62002 Jessica Jones (ally)
 * - 62007 Fogwell's Gym (support)
 * - 62008 Burstein Process (upgrade)
 * - 62009 Cruisin' for a Bruisin' (upgrade)
 * - 62010 Metal Bracer (upgrade)
 * - 62011 Power Man (upgrade)
 *
 * Scaffold (HS0): the registry is empty and every ref is in `LUKE_CAGE_LUKE_CAGE_SUPPORT_UPGRADES_ALLIES_SKIPPED`. The
 * scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `support-upgrades-allies.test.ts`.
 */
export const LUKE_CAGE_LUKE_CAGE_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = {};

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const LUKE_CAGE_LUKE_CAGE_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {
  "62002.jessica-jones-constant": "wave 11 scripting in progress: luke_cage/luke-cage/support-upgrades-allies",
  "62007.fogwells-gym-response": "wave 11 scripting in progress: luke_cage/luke-cage/support-upgrades-allies",
  "62008.burstein-process-action": "wave 11 scripting in progress: luke_cage/luke-cage/support-upgrades-allies",
  "62009.cruisin-for-a-bruisin-constant": "wave 11 scripting in progress: luke_cage/luke-cage/support-upgrades-allies",
  "62009.cruisin-for-a-bruisin-response": "wave 11 scripting in progress: luke_cage/luke-cage/support-upgrades-allies",
  "62010.metal-bracer-constant": "wave 11 scripting in progress: luke_cage/luke-cage/support-upgrades-allies",
  "62010.metal-bracer-interrupt": "wave 11 scripting in progress: luke_cage/luke-cage/support-upgrades-allies",
  "62011.power-man-response": "wave 11 scripting in progress: luke_cage/luke-cage/support-upgrades-allies",
};
