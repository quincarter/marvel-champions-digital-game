import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `falcon/falcon/support-upgrades-allies` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (9):
 * - 53002 Redwing (ally)
 * - 53006 Falcon's Flock (support)
 * - 53007 Soup Kitchen (support)
 * - 53008 Aerial Evacuation (upgrade)
 * - 53009 Aerial Recon (upgrade)
 * - 53010 Battlefield Awareness (upgrade)
 * - 53011 Draw Their Fire (upgrade)
 * - 53012 Talon Line (upgrade)
 * - 53013 Vibranium Microweave (upgrade)
 */
export const FALCON_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FALCON_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
