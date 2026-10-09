import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/maria-hill/identity` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (1):
 * - 50001a Maria Hill (hero_identity)
 */
export const MARIA_HILL_IDENTITY: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const MARIA_HILL_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {};
