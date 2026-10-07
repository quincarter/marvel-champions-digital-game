import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Magik signature events. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (5):
 * - 45036 Scrying (event)
 * - 45037 Stepping Disc (event)
 * - 45038 Exorcism (event)
 * - 45039 Soul Strike (event)
 * - 45040 Magic Barrier (event)
 */
export const MAGIK_EVENTS: AbilityRegistry = defineAbilities({});
