import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `winter/winter-soldier/obligation-nemesis` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (5):
 * - 54027 Red Room Programming (obligation)
 * - 54028 Crossbones (minion)
 * - 54029 Hydra Hit Squad (side_scheme)
 * - 54030 High-Tech Armament (attachment)
 * - 54031 Hydra Mercenary (minion)
 */
export const WINTER_SOLDIER_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const WINTER_SOLDIER_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
