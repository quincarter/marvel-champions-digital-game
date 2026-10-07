import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Scenario or modular encounter set `savage_land`. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (6):
 * - 45127 The Savage Land (environment)
 * - 45128 Pterosaur (minion)
 * - 45129 Velociraptor (minion)
 * - 45130 Giant Ape (minion)
 * - 45131 Land Out of Time (treachery)
 * - 45132 Village Under Attack (side_scheme)
 */
export const SAVAGE_LAND: AbilityRegistry = defineAbilities({});
