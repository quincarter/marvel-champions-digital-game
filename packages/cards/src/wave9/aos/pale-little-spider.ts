import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/pale-little-spider` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (4):
 * - 50148 Black Widow (minion)
 * - 50149 Handspring (attachment)
 * - 50150 Pride of the Red Room (side_scheme)
 * - 50151 Pale Little Spider (treachery)
 */
export const PALE_LITTLE_SPIDER: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const PALE_LITTLE_SPIDER_SKIPPED: Readonly<Record<string, string>> = {};
