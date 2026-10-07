import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Bishop obligation and nemesis set. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (5):
 * - 45025 Fear the Future (obligation)
 * - 45026 Trevor Fitzroy (minion)
 * - 45027 Portal Through Time (side_scheme)
 * - 45028 Bantam (minion)
 * - 45029 Temporal Trickery (treachery)
 */
export const BISHOP_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({});
