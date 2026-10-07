import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Scenario or modular encounter set `blue_moon`. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (8):
 * - 45139 Blue Area of the Moon (environment)
 * - 45140 Gladiator (minion)
 * - 45141 Oracle (minion)
 * - 45142 Manta (minion)
 * - 45143 Earthquake (minion)
 * - 45144 Warstar (minion)
 * - 45145 Imperial Guardsman (attachment)
 * - 45146 Trial by Combat (side_scheme)
 */
export const BLUE_MOON: AbilityRegistry = defineAbilities({});
