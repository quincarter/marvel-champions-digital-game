import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/maria-hill/support-upgrades-allies` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (5):
 * - 50002 Nick Fury (ally)
 * - 50008 Support Staff (support)
 * - 50009 The Iliad (support)
 * - 50010 Life Model Decoy (upgrade)
 * - 50011 S.H.I.E.L.D. Director (upgrade)
 */
export const MARIA_HILL_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const MARIA_HILL_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
