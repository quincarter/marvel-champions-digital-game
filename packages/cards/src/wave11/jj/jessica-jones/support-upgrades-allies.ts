import type { AbilityRegistry } from "@mc/engine";

/**
 * Wave 11 scripting module `jj/jessica-jones/support-upgrades-allies` (docs/phase7-wave11-hero-packs.md H8.4).
 *
 * Cards (8):
 * - 61003 Luke Cage (ally)
 * - 61008 Calling in Favors (support)
 * - 61009 4K Digital Camcorder (upgrade)
 * - 61010 Circumstantial Evidence (upgrade)
 * - 61011 Leather Jacket (upgrade)
 * - 61012 "Now I'm Ticked Off!" (upgrade)
 * - 61013 Reluctant Flier (upgrade)
 * - 61014 Stakeout (upgrade)
 *
 * Scaffold (HS0): the registry is empty and every ref is in `JJ_JESSICA_JONES_SUPPORT_UPGRADES_ALLIES_SKIPPED`. The
 * scripting
 * task for this module fills the registry, deletes its own `_SKIPPED` lines and names every id it registers in
 * `support-upgrades-allies.test.ts`.
 */
export const JJ_JESSICA_JONES_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = {};

/**
 * Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is
 * scripted.
 */
export const JJ_JESSICA_JONES_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {
  "61003.luke-cage-action": "wave 11 scripting in progress: jj/jessica-jones/support-upgrades-allies",
  "61008.calling-in-favors-action": "wave 11 scripting in progress: jj/jessica-jones/support-upgrades-allies",
  "61009.4k-digital-camcorder-action": "wave 11 scripting in progress: jj/jessica-jones/support-upgrades-allies",
  "61010.circumstantial-evidence-response": "wave 11 scripting in progress: jj/jessica-jones/support-upgrades-allies",
  "61011.leather-jacket-constant": "wave 11 scripting in progress: jj/jessica-jones/support-upgrades-allies",
  "61011.leather-jacket-response": "wave 11 scripting in progress: jj/jessica-jones/support-upgrades-allies",
  "61012.now-im-ticked-off-forced-response": "wave 11 scripting in progress: jj/jessica-jones/support-upgrades-allies",
  "61013.reluctant-flier-interrupt": "wave 11 scripting in progress: jj/jessica-jones/support-upgrades-allies",
  "61014.stakeout-action": "wave 11 scripting in progress: jj/jessica-jones/support-upgrades-allies",
  "61014.stakeout-interrupt": "wave 11 scripting in progress: jj/jessica-jones/support-upgrades-allies",
};
