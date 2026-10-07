import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Jubilee obligation and nemesis set. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (5):
 * - 47023 Grounded (obligation)
 * - 47024 Nanny (minion)
 * - 47025 Naughty Children (side_scheme)
 * - 47026 Battle Suit (attachment)
 * - 47027 "Lost" Child (attachment)
 */
export const JUBILEE_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({});
