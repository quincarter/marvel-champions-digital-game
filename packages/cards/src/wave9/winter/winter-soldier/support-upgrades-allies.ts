import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `winter/winter-soldier/support-upgrades-allies` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (7):
 * - 54002 Cybernetic Arm (upgrade)
 * - 54003 Black Widow (ally)
 * - 54007 Safe House #30 (support)
 * - 54008 Silent Infiltration (upgrade)
 * - 54009 Winter Armor (upgrade)
 * - 54010 Winter Mask (upgrade)
 * - 54011 Winter Rifle (upgrade)
 */
export const WINTER_SOLDIER_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const WINTER_SOLDIER_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
