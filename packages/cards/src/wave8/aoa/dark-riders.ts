import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Scenario or modular encounter set `dark_riders`. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (6):
 * - 45112 Gauntlet (minion)
 * - 45113 Barrage (minion)
 * - 45114 Hard-Drive (minion)
 * - 45115 Tusk (minion)
 * - 45116 Psynapse (minion)
 * - 45117 The Dark Riders (side_scheme)
 */
export const DARK_RIDERS: AbilityRegistry = defineAbilities({});
