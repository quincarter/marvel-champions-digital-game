import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/thunderbolts` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (10):
 * - 50129a Citizen V (villain)
 * - 50130a Apprehending Rogue Agents (main_scheme)
 * - 50131a Justice, Like Lightning (environment)
 * - 50132 Citizen V's Sword (attachment)
 * - 50133 Jolt (minion)
 * - 50134 Innocent Bystanders (obligation)
 * - 50135 The Coming Storm (side_scheme)
 * - 50136 Rumbling Thunder (side_scheme)
 * - 50137 Down but Not Out (treachery)
 * - 50138 Tap In (treachery)
 */
export const THUNDERBOLTS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const THUNDERBOLTS_SKIPPED: Readonly<Record<string, string>> = {};
