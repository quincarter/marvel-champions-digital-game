import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `falcon/techno` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (5):
 * - 53038 Fixer (minion)
 * - 53039 Jet Pack (attachment)
 * - 53040 Tech-Pac (attachment)
 * - 53041 Technological Innovation (side_scheme)
 * - 53042 Techno (treachery)
 */
export const TECHNO: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const TECHNO_SKIPPED: Readonly<Record<string, string>> = {};
