import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/campaign/executive-board-evidence` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (9):
 * - 50185 Medical Records (evidence)
 * - 50186 Wiretap (evidence)
 * - 50187 Security Scanner (evidence)
 * - 50188 Money (evidence)
 * - 50189 Blackmail (evidence)
 * - 50190 Ideology (evidence)
 * - 50191 Security Clearance (evidence)
 * - 50192 Travel (evidence)
 * - 50193 Authority (evidence)
 */
export const EXECUTIVE_BOARD_EVIDENCE: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const EXECUTIVE_BOARD_EVIDENCE_SKIPPED: Readonly<Record<string, string>> = {};
