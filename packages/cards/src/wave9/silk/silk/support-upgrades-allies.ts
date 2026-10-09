import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `silk/silk/support-upgrades-allies` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (7):
 * - 52006 Albert Moon (support)
 * - 52007 J. Jonah Jameson (support)
 * - 52008 Eidetic Memory (upgrade)
 * - 52009 Organic Webbing (upgrade)
 * - 52010 Outwit (upgrade)
 * - 52011 Spider Claws (upgrade)
 * - 52012 Spider Reflexes (upgrade)
 */
export const SILK_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SILK_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
