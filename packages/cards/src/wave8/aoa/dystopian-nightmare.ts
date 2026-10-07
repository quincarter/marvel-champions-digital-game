import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Scenario or modular encounter set `dystopian_nightmare`. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (3):
 * - 45072 Hunted (obligation)
 * - 45073 War-Weary (treachery)
 * - 45074 Targeted for Extermination (side_scheme)
 */
export const DYSTOPIAN_NIGHTMARE: AbilityRegistry = defineAbilities({});
