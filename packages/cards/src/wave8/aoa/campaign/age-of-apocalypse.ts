import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Campaign-only encounter set `age_of_apocalypse` (campaign mode only). Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (2):
 * - 45164 Agent of Apocalypse (minion)
 * - 45165 Worldwide Crisis (treachery)
 */
export const AGE_OF_APOCALYPSE: AbilityRegistry = defineAbilities({});
