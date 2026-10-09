import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/shield` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (3):
 * - 50178 S.H.I.E.L.D. Trooper (minion)
 * - 50179 Arrest Warrant (obligation)
 * - 50180 Disavowed (side_scheme)
 */
export const SHIELD: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SHIELD_SKIPPED: Readonly<Record<string, string>> = {};
