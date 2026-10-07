import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Modular encounter set `crazy_gang`. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (6):
 * - 48033 The Crazy Gang (side_scheme)
 * - 48034 Queen of Hearts (minion)
 * - 48035 Jester (minion)
 * - 48036 Executioner (minion)
 * - 48037 Tweedledope (minion)
 * - 48038 "Off with His Head!" (treachery)
 */
export const CRAZY_GANG: AbilityRegistry = defineAbilities({});
