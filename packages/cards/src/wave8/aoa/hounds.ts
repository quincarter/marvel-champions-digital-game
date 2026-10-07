import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Scenario or modular encounter set `hounds`. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (4):
 * - 45097 Ahab (minion)
 * - 45098 Hound (minion)
 * - 45099 Ahab's Energy Spear (attachment)
 * - 45100 Release the Hounds (side_scheme)
 */
export const HOUNDS: AbilityRegistry = defineAbilities({});
