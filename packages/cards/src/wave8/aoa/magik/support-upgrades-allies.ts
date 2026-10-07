import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Magik signature supports, upgrades, allies and resources. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (5):
 * - 45031 Colossus (ally)
 * - 45032 Limbo (support)
 * - 45033 Magik's Crown (upgrade)
 * - 45034 Soulsword (upgrade)
 * - 45035 Mystical Armor (upgrade)
 */
export const MAGIK_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({});
