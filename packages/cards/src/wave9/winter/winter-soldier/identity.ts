import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `winter/winter-soldier/identity` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (1):
 * - 54001a Winter Soldier (hero_identity)
 */
export const WINTER_SOLDIER_IDENTITY: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const WINTER_SOLDIER_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {};
