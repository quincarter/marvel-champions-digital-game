import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Nightcrawler obligation and nemesis set. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (5):
 * - 48026 Crisis of Faith (obligation)
 * - 48027 Azazel (minion)
 * - 48028 Brimstone Dimension (side_scheme)
 * - 48029 Azazel's Sword (attachment)
 * - 48030 Brimstone Strike (treachery)
 */
export const NIGHTCRAWLER_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({});
