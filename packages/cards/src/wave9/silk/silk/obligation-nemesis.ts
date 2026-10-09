import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `silk/silk/obligation-nemesis` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (4):
 * - 52028 Silk Sense Overload (obligation)
 * - 52029 Morlun (minion)
 * - 52030 The Great Hunt (side_scheme)
 * - 52031 Hunting the Spider-Bride (treachery)
 */
export const SILK_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SILK_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
