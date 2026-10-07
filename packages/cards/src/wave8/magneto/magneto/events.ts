import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Magneto signature events. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (3):
 * - 49008 Electromagnetic Blast (event)
 * - 49009 Metal Shards (event)
 * - 49010 Magnetic Missile (event)
 */
export const MAGNETO_EVENTS: AbilityRegistry = defineAbilities({});
