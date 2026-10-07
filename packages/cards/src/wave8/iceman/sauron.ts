import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Modular encounter set `sauron`. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (4):
 * - 46029 Sauron (minion)
 * - 46030 Sauron Lives! (side_scheme)
 * - 46031 Life Drain (attachment)
 * - 46032 The Eye of Sauron (treachery)
 */
export const SAURON: AbilityRegistry = defineAbilities({});
