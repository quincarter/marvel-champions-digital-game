import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 11 scripting module `iron_fist/iron-fist/support-upgrades-allies` (docs/phase7-elektra-iron-fist.md). Scaffold: a registry holding only the reprint aliases
 * (an empty one when there are none) with every other ref skipped, so scripting it is editing this file and its test.
 *
 * Cards (7):
 * - 64006 Lei Kung (support)
 * - 64007 Book of the Iron Fist (upgrade)
 * - 64008 Channel the Iron Fist (upgrade)
 * - 64009 Embody the Dragon (upgrade)
 * - 64010 Feel the Flow (upgrade)
 * - 64011 Keep 'Em Coming (upgrade)
 * - 64012 Redirect Chi (upgrade)
 */
export const IRON_FIST_IRON_FIST_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const IRON_FIST_IRON_FIST_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {
  "64006.lei-kung-action": "not scripted yet: Lei Kung action",
  "64007.book-of-the-iron-fist-action": "not scripted yet: Book of the Iron Fist action",
  "64008.channel-the-iron-fist-interrupt": "not scripted yet: Channel the Iron Fist interrupt",
  "64009.embody-the-dragon-constant": "not scripted yet: Embody the Dragon constant",
  "64009.embody-the-dragon-action": "not scripted yet: Embody the Dragon action",
  "64010.feel-the-flow-action": "not scripted yet: Feel the Flow action",
  "64011.keep-em-coming-action": "not scripted yet: Keep 'Em Coming action",
  "64012.redirect-chi-resource": "not scripted yet: Redirect Chi resource ability",
};
