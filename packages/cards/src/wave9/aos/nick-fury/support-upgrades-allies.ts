import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/nick-fury/support-upgrades-allies` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (9):
 * - 50035a Assault (upgrade)
 * - 50036 Maria Hill (ally)
 * - 50040 Fury's Flying Car (support)
 * - 50041 Safe House #221 (support)
 * - 50042 EM Shield (upgrade)
 * - 50043 Eyepatch Camera (upgrade)
 * - 50044 Fury's Watch (upgrade)
 * - 50045 Intelligence Analysis (upgrade)
 * - 50046 Secret Agent (upgrade)
 */
export const NICK_FURY_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const NICK_FURY_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
