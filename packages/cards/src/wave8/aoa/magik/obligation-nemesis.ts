import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Magik obligation and nemesis set. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (6):
 * - 45053 Darkchilde (obligation)
 * - 45054 Belasco (minion)
 * - 45055 Ruler of Limbo (side_scheme)
 * - 45056 S'ym (minion)
 * - 45057 Witchfire (minion)
 * - 45058 Battle for Limbo (treachery)
 */
export const MAGIK_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({});
