import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/aim-abduction` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (3):
 * - 50080 A.I.M. Abductor (minion)
 * - 50081 Abduct Superhumans (side_scheme)
 * - 50082 Nabbed! (treachery)
 */
export const AIM_ABDUCTION: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const AIM_ABDUCTION_SKIPPED: Readonly<Record<string, string>> = {};
