import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Modular encounter set `hellfire`. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (5):
 * - 49038 Sebastian Shaw (minion)
 * - 49039 Selene (minion)
 * - 49040 Hellfire Pawn (minion)
 * - 49041 The Inner Circle (side_scheme)
 * - 49042 Power and Decadence (treachery)
 */
export const HELLFIRE: AbilityRegistry = defineAbilities({});
