import type { AbilityRegistry } from "@mc/engine";

/**
 * Wave 11 scripting module `fne/daredevil/support-upgrades-allies` (docs/phase7-wave11.md §8.4).
 *
 * Cards (8):
 * - 60007 Elektra (ally)
 * - 60012 Focus the Senses (player_side_scheme)
 * - 60013 Foggy Nelson (support)
 * - 60014 Karen Page (support)
 * - 60015 Nelson and Murdock (support)
 * - 60016 Sister Maggie (support)
 * - 60017 Daredevil's Billy Club (upgrade)
 * - 60018 The Man Without Fear (upgrade)
 *
 * Scaffold: the registry is empty and every other ref is in `FNE_DAREDEVIL_SUPPORT_UPGRADES_ALLIES_SKIPPED`. The
 * scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `support-upgrades-allies.test.ts`.
 */
export const FNE_DAREDEVIL_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = {};

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const FNE_DAREDEVIL_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {
  "60007.elektra-forced-interrupt": "wave 11 scripting in progress: fne/daredevil/support-upgrades-allies",
  "60012.focus-the-senses-constant": "wave 11 scripting in progress: fne/daredevil/support-upgrades-allies",
  "60012.when-defeated": "wave 11 scripting in progress: fne/daredevil/support-upgrades-allies",
  "60013.foggy-nelson-action": "wave 11 scripting in progress: fne/daredevil/support-upgrades-allies",
  "60014.karen-page-action": "wave 11 scripting in progress: fne/daredevil/support-upgrades-allies",
  "60015.nelson-and-murdock-response": "wave 11 scripting in progress: fne/daredevil/support-upgrades-allies",
  "60016.sister-maggie-constant": "wave 11 scripting in progress: fne/daredevil/support-upgrades-allies",
  "60016.sister-maggie-response": "wave 11 scripting in progress: fne/daredevil/support-upgrades-allies",
  "60017.daredevils-billy-club-constant": "wave 11 scripting in progress: fne/daredevil/support-upgrades-allies",
  "60017.daredevils-billy-club-action": "wave 11 scripting in progress: fne/daredevil/support-upgrades-allies",
  "60018.the-man-without-fear-action": "wave 11 scripting in progress: fne/daredevil/support-upgrades-allies",
};
