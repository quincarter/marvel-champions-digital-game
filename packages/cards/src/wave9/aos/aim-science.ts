import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/aim-science` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (3):
 * - 50083 A.I.M. Scientist (minion)
 * - 50084 A.I.M. Soldier (minion)
 * - 50085 Mad Science (side_scheme)
 */
export const AIM_SCIENCE: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const AIM_SCIENCE_SKIPPED: Readonly<Record<string, string>> = {};
