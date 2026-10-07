import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Campaign-only encounter set `aoa_campaign` (campaign mode only). Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (2):
 * - 45177 North American Sea Wall (side_scheme)
 * - 45178 Panicked Refugees (obligation)
 */
export const AOA_CAMPAIGN: AbilityRegistry = defineAbilities({});
