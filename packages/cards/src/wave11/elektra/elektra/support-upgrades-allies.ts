import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 11 scripting module `elektra/elektra/support-upgrades-allies` (docs/phase7-elektra-iron-fist.md). Scaffold: a registry holding only the reprint aliases
 * (an empty one when there are none) with every other ref skipped, so scripting it is editing this file and its test.
 *
 * Cards (6):
 * - 63005 Daredevil (ally)
 * - 63010 Resurrection Altar (support)
 * - 63011 White Tiger (support)
 * - 63012 Elektra's Sai (upgrade)
 * - 63013 History with the Hand (upgrade)
 * - 63014 Stealth Mastery (upgrade)
 */
export const ELEKTRA_ELEKTRA_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const ELEKTRA_ELEKTRA_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {
  "63005.daredevil-response": "not scripted yet: Daredevil's response after he uses a basic power",
  "63010.resurrection-altar-interrupt": "not scripted yet: Resurrection Altar interrupt",
  "63011.white-tiger-response": "not scripted yet: White Tiger response",
  "63012.elektras-sai-action": "not scripted yet: Elektra's Sai action and its next-event cost reduction",
  "63013.history-with-the-hand-constant": "not scripted yet: History with the Hand hand-size bonus",
  "63013.history-with-the-hand-forced-response": "not scripted yet: History with the Hand discard on form change",
  "63014.stealth-mastery-forced-interrupt": "not scripted yet: Stealth Mastery forced interrupt",
};
