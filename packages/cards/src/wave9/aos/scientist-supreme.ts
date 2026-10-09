import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/scientist-supreme` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (4):
 * - 50125 Scientist Supreme (minion)
 * - 50126 Monica Rappaccini (minion)
 * - 50127 Diplomatic Immunity (side_scheme)
 * - 50128 Diplomatic Sanctions (treachery)
 */
export const SCIENTIST_SUPREME: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SCIENTIST_SUPREME_SKIPPED: Readonly<Record<string, string>> = {};
