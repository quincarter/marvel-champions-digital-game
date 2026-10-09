import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `falcon/aspect-basic` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (19):
 * - 53014 Adam Warlock (ally)
 * - 53015 Aero (ally)
 * - 53016 Cloud 9 (ally)
 * - 53017 Hugin & Munin (ally)
 * - 53018 Spectrum (ally)
 * - 53019 Strength in Diversity (event)
 * - 53020 Flight Squadron (support)
 * - 53021 Resource Reserve (support)
 * - 53022 The Triskelion (support)
 * - 53023 Captain America (upgrade)
 * - 53024 Wingman (upgrade)
 * - 53025 Energy (resource)
 * - 53026 Genius (resource)
 * - 53027 Strength (resource)
 * - 53028 The Power of Flight (resource)
 * - 53034 Captain America's Shield (upgrade)
 * - 53035 Winter Soldier (ally)
 * - 53036 Misty Knight (ally)
 * - 53037 Ops Room (support)
 */
export const FALCON_ASPECT_BASIC: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FALCON_ASPECT_BASIC_SKIPPED: Readonly<Record<string, string>> = {};
