import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `bp/black-panther/support-upgrades-allies` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (8):
 * - 51002 T'Challa (ally)
 * - 51007 The Elephant's Trunk (support)
 * - 51008 Queen Ramonda (support)
 * - 51009 Aja-Adanna (upgrade)
 * - 51010 Kimoyo Beads (upgrade)
 * - 51011 Panther Claws (upgrade)
 * - 51012 Spider Bites (upgrade)
 * - 51013 Vibranium Suit (upgrade)
 */
export const BLACK_PANTHER_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const BLACK_PANTHER_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
