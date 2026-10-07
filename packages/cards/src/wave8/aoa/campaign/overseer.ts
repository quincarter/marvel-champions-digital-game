import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Campaign-only encounter set `overseer` (campaign mode only). Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (5):
 * - 45179a Mister Sinister (minion)
 * - 45180a The Shadow King (minion)
 * - 45181a Abyss (minion)
 * - 45182a Sugar Man (minion)
 * - 45183a Mikhail Rasputin (minion)
 */
export const OVERSEER: AbilityRegistry = defineAbilities({});
