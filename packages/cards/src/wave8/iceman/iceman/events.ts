import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Iceman signature events. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (3):
 * - 46009 Arctic Attack (event)
 * - 46010 Ice Blast (event)
 * - 46011 Chill Out! (event)
 */
export const ICEMAN_EVENTS: AbilityRegistry = defineAbilities({});
