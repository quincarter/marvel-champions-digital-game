import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/batrocs-brigade` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (5):
 * - 50098 Machete (minion)
 * - 50099 Rapido (minion)
 * - 50100 Zaran (minion)
 * - 50101 Batroc's Brigade (side_scheme)
 * - 50102 Soldiers of Fortune (treachery)
 */
export const BATROCS_BRIGADE: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const BATROCS_BRIGADE_SKIPPED: Readonly<Record<string, string>> = {};
