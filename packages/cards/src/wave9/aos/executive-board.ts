import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/executive-board` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (9):
 * - 50181a Chief Medical Officer (environment)
 * - 50181b Medical Officer's Aid (attachment)
 * - 50182a Chief Surveillance Officer (environment)
 * - 50182b Surveillance Officer's Aid (attachment)
 * - 50183a Chief Tactical Officer (environment)
 * - 50183b Tactical Officer's Aid (attachment)
 * - 50184a A.I.M. Interference ([energy]) (treachery)
 * - 50184b A.I.M. Interference ([mental]) (treachery)
 * - 50184c A.I.M. Interference ([physical]) (treachery)
 */
export const EXECUTIVE_BOARD: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const EXECUTIVE_BOARD_SKIPPED: Readonly<Record<string, string>> = {};
