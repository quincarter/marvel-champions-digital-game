import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Bishop signature events. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (3):
 * - 45007 Concussive Blast (event)
 * - 45008 Command Authority (event)
 * - 45009 Energy Conversion (event)
 */
export const BISHOP_EVENTS: AbilityRegistry = defineAbilities({});
