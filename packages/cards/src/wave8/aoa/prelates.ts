import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Scenario or modular encounter set `prelates`. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (5):
 * - 45179b Mister Sinister (minion)
 * - 45180b The Shadow King (minion)
 * - 45181b Abyss (minion)
 * - 45182b Sugar Man (minion)
 * - 45183b Mikhail Rasputin (minion)
 */
export const PRELATES: AbilityRegistry = defineAbilities({});
