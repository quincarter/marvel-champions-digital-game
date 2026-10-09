import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/maria-hill/obligation-nemesis` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (5):
 * - 50029 Press Conference (obligation)
 * - 50030 Controller (minion)
 * - 50031 Army of the Controlled (side_scheme)
 * - 50032 Controlled Innocents (environment)
 * - 50033 Diabolical Discs (treachery)
 */
export const MARIA_HILL_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const MARIA_HILL_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
