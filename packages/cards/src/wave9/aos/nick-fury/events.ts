import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/nick-fury/events` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (3):
 * - 50037 Concentrated Fire (event)
 * - 50038 Covert Surveillance (event)
 * - 50039 Spray Fire (event)
 */
export const NICK_FURY_EVENTS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const NICK_FURY_EVENTS_SKIPPED: Readonly<Record<string, string>> = {};
