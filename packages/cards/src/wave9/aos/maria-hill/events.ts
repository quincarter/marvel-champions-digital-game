import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/maria-hill/events` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (5):
 * - 50003 All-Points Bulletin (event)
 * - 50004 On the Double (event)
 * - 50005 Reinforcements (event)
 * - 50006 The Hard Call (event)
 * - 50007 Special Funding (resource)
 */
export const MARIA_HILL_EVENTS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const MARIA_HILL_EVENTS_SKIPPED: Readonly<Record<string, string>> = {};
