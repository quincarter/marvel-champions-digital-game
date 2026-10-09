import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `bp/black-panther/obligation-nemesis` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (5):
 * - 51031 T'Challa's Shadow (obligation)
 * - 51032 Klaw (minion)
 * - 51033 Manipulated M.U.S.I.C. (side_scheme)
 * - 51034 M.U.S.I.C. (minion)
 * - 51035 The Scream (treachery)
 */
export const BLACK_PANTHER_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const BLACK_PANTHER_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
