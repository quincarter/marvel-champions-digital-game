import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Scenario or modular encounter set `standard_iii`. Not scripted yet: an empty registry for the scripting agent of this group to fill.
 *
 * Cards (6):
 * - 45075a Pursued by the Past (environment)
 * - 45076 Dark Designs (treachery)
 * - 45077 Sinister Strike (treachery)
 * - 45078 Evil Alliance (treachery)
 * - 45079 Nowhere is Safe (treachery)
 * - 45080 Drawing Near (obligation)
 */
export const STANDARD_III: AbilityRegistry = defineAbilities({});
