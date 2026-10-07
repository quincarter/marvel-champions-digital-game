import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Jubilee signature events. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (8):
 * - 47006 Blinding Flash (event)
 * - 47007a Firecracker (event)
 * - 47007b Firecracker (event)
 * - 47007c Firecracker (event)
 * - 47008a Flash of Light (event)
 * - 47008b Flash of Light (event)
 * - 47008c Flash of Light (event)
 * - 47009 Grand Finale (event)
 */
export const JUBILEE_EVENTS: AbilityRegistry = defineAbilities({});
