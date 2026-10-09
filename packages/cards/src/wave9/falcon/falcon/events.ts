import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `falcon/falcon/events` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (3):
 * - 53003 Bird of Prey (event)
 * - 53004 Bird's-Eye View (event)
 * - 53005 Up, Up, and Away (event)
 */
export const FALCON_EVENTS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FALCON_EVENTS_SKIPPED: Readonly<Record<string, string>> = {};
