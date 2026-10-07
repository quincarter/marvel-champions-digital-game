import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Campaign-only encounter set `aoa_basic_campaign` (campaign mode only). Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (6):
 * - 45171a Mission Team (support)
 * - 45172 Destiny (ally)
 * - 45173 Blink (ally)
 * - 45174 Morph (ally)
 * - 45175 X-Man (ally)
 * - 45176 Desperate Measures (upgrade)
 */
export const AOA_BASIC_CAMPAIGN: AbilityRegistry = defineAbilities({});
