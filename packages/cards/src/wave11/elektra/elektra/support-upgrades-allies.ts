import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 11 scripting module `elektra/elektra/support-upgrades-allies` (docs/phase7-elektra-iron-fist.md). Scaffold: an empty registry with every ref
 * skipped, so scripting it is editing this file and its test.
 *
 * Cards (3):
 * - 63005 Daredevil (ally)
 * - 63012 Elektra's Sai (upgrade)
 * - 63013 History with the Hand (upgrade)
 */
export const ELEKTRA_ELEKTRA_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const ELEKTRA_ELEKTRA_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {
  "63005.daredevil-response": "not scripted yet: Daredevil's response after he uses a basic power",
  "63012.elektras-sai-action": "not scripted yet: Elektra's Sai action and its next-event cost reduction",
  "63013.history-with-the-hand-constant": "not scripted yet: History with the Hand hand-size bonus",
  "63013.history-with-the-hand-forced-response": "not scripted yet: History with the Hand discard on form change",
  "63013.history-with-the-hand-constant-2": "not scripted yet: History with the Hand amplify icon",
};
