import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 11 scripting module `iron_fist/iron-fist/support-upgrades-allies` (docs/phase7-elektra-iron-fist.md). Scaffold: an empty registry with every ref
 * skipped, so scripting it is editing this file and its test.
 *
 * Cards (5):
 * - 64006 Lei Kung (support)
 * - 64007 Book of the Iron Fist (upgrade)
 * - 64008 Channel the Iron Fist (upgrade)
 * - 64010 Feel the Flow (upgrade)
 * - 64012 Redirect Chi (upgrade)
 */
export const IRON_FIST_IRON_FIST_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const IRON_FIST_IRON_FIST_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {
  "64006.lei-kung-action": "not scripted yet: Lei Kung action",
  "64007.book-of-the-iron-fist-action": "not scripted yet: Book of the Iron Fist action",
  "64008.channel-the-iron-fist-interrupt": "not scripted yet: Channel the Iron Fist interrupt",
  "64010.feel-the-flow-action": "not scripted yet: Feel the Flow action",
  "64012.redirect-chi-resource": "not scripted yet: Redirect Chi resource ability",
};
