import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Scenario or modular encounter set `genosha`. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (6):
 * - 45133 Genosha (environment)
 * - 45134 Magistrate (minion)
 * - 45135 Armored Unibike (minion)
 * - 45136 Genoshan Mech (minion)
 * - 45137 Escaped Mutant (attachment)
 * - 45138 Police State (side_scheme)
 */
export const GENOSHA: AbilityRegistry = defineAbilities({});
