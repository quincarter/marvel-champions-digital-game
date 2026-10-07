import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Scenario or modular encounter set `dark_beast`. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (7):
 * - 45118 Dark Beast (villain)
 * - 45121a Dark Beast's Bogus Journey (main_scheme)
 * - 45122 High-Tech Goggles (attachment)
 * - 45123 Genetic Enhancement (attachment)
 * - 45124 Cruel Experiment (attachment)
 * - 45125 Evil Genius (treachery)
 * - 45126 Time-Travel Shenanigans (side_scheme)
 */
export const DARK_BEAST: AbilityRegistry = defineAbilities({});
