import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `falcon/falcon/obligation-nemesis` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (5):
 * - 53029 Harlem's Protector (obligation)
 * - 53030 Viper (minion)
 * - 53031 Serpent Solutions (side_scheme)
 * - 53032 Serpent Soldier (minion)
 * - 53033 Adder-tisement (treachery)
 */
export const FALCON_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FALCON_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
