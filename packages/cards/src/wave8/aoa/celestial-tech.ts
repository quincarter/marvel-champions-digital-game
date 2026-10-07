import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Scenario or modular encounter set `celestial_tech`. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (3):
 * - 45156 Celestial Armor (attachment)
 * - 45157 Celestial Weapon (attachment)
 * - 45158 Celestial Tech (treachery)
 */
export const CELESTIAL_TECH: AbilityRegistry = defineAbilities({});
