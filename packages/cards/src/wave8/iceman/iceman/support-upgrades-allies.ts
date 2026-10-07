import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Iceman signature supports, upgrades, allies and resources. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (7):
 * - 46002 Frostbite (upgrade)
 * - 46003 Snow Clone (ally)
 * - 46004 Power Belt (upgrade)
 * - 46005 Cryokinetic Perception (upgrade)
 * - 46006 Ice Slide (upgrade)
 * - 46007 Frozen Solid (upgrade)
 * - 46008 Ice Wall (support)
 */
export const ICEMAN_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({});
