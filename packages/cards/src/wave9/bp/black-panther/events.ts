import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `bp/black-panther/events` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (4):
 * - 51003 Clawed Strike (event)
 * - 51004 On the Prowl (event)
 * - 51005 Wakanda Forever! (event)
 * - 51006 Vibranium (resource)
 */
export const BLACK_PANTHER_EVENTS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const BLACK_PANTHER_EVENTS_SKIPPED: Readonly<Record<string, string>> = {};
