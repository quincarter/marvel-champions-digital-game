import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Nightcrawler signature supports, upgrades, allies and resources. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (5):
 * - 48002 Daytripper (ally)
 * - 48003 Kurt's Chapel (support)
 * - 48004 Kurt's Cutlasses (upgrade)
 * - 48005 Prehensile Tail (upgrade)
 * - 48006 Bamf! (upgrade)
 */
export const NIGHTCRAWLER_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({});
