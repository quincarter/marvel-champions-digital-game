import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Magneto signature supports, upgrades, allies and resources. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (7):
 * - 49002 Asteroid M (support)
 * - 49003 Magneto's Helmet (upgrade)
 * - 49004 Magneto's Armor (upgrade)
 * - 49005 Magneto's Cape (upgrade)
 * - 49006 Magnetic Bubble (upgrade)
 * - 49007 Wrapped in Metal (upgrade)
 * - 49011 Master of Magnetism (resource)
 */
export const MAGNETO_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({});
