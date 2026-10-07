import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Scenario or modular encounter set `unus`. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (8):
 * - 45059 Unus (villain)
 * - 45062a Hunting Gene Traitors (main_scheme)
 * - 45063 Prelate Sidearm (attachment)
 * - 45064 Prelate Armor (attachment)
 * - 45065 Infinite Hunter (minion)
 * - 45066 Genetic Experiments (attachment)
 * - 45067 Infinite Prelate (treachery)
 * - 45068 Endless Ranks (side_scheme)
 */
export const UNUS: AbilityRegistry = defineAbilities({});
