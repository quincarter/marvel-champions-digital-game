import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Iceman obligation and nemesis set. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (5):
 * - 46024 Hot-Headed (obligation)
 * - 46025 Pyro (minion)
 * - 46026 Playing with Fire (side_scheme)
 * - 46027 Pyro's Flamethrower (attachment)
 * - 46028 Burn! (treachery)
 */
export const ICEMAN_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({});
