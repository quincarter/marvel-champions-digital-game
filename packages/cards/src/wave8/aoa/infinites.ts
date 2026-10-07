import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Scenario or modular encounter set `infinites`. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (3):
 * - 45069 Infinite Soldier (minion)
 * - 45070 Culling the Weak (treachery)
 * - 45071 Gene Pool (side_scheme)
 */
export const INFINITES: AbilityRegistry = defineAbilities({});
