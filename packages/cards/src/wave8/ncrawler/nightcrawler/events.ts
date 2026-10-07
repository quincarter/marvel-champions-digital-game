import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Nightcrawler signature events. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (5):
 * - 48007 'Port and Punch (event)
 * - 48008 Teleport Drop (event)
 * - 48009 Scout Ahead (event)
 * - 48010 'Port Away (event)
 * - 48011 Tally Ho! (event)
 */
export const NIGHTCRAWLER_EVENTS: AbilityRegistry = defineAbilities({});
