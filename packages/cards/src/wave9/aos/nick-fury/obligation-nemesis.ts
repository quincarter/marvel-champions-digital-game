import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/nick-fury/obligation-nemesis` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (5):
 * - 50059 Discovered (obligation)
 * - 50060 Orion (minion)
 * - 50061 Acquire Infinity Formula (side_scheme)
 * - 50062 Leviathan Soldier (minion)
 * - 50063 Cold Storage (treachery)
 */
export const NICK_FURY_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const NICK_FURY_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
