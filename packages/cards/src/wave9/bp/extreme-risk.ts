import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `bp/extreme-risk` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (4):
 * - 51039 Joystick (minion)
 * - 51040 Energy Truncheon (attachment)
 * - 51041 Playing for Keeps (side_scheme)
 * - 51042 Extreme Risk (treachery)
 */
export const EXTREME_RISK: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const EXTREME_RISK_SKIPPED: Readonly<Record<string, string>> = {};
