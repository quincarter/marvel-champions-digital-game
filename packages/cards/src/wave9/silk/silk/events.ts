import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `silk/silk/events` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (4):
 * - 52002 Smooth as Silk (event)
 * - 52003 Swinging Silk Kick (event)
 * - 52004 Wallcrawl (event)
 * - 52005 Get the Scoop (player_side_scheme)
 */
export const SILK_EVENTS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SILK_EVENTS_SKIPPED: Readonly<Record<string, string>> = {};
