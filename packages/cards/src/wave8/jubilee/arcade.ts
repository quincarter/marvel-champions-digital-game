import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Modular encounter set `arcade`. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (5):
 * - 47030 Arcade (minion)
 * - 47031 Welcome to Murderworld (side_scheme)
 * - 47032 Arcade's Funhouse (side_scheme)
 * - 47033 Hall of Mirrors (side_scheme)
 * - 47034 Elaborate Trap (treachery)
 */
export const ARCADE: AbilityRegistry = defineAbilities({});
