import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `bp/aspect-basic` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (20):
 * - 51014 Manifold (ally)
 * - 51015 Infiltration (event)
 * - 51016 Going Undercover (player_side_scheme)
 * - 51017 Show of Empathy (player_side_scheme)
 * - 51018 The Raft (support)
 * - 51019 Invisibility Gear (upgrade)
 * - 51020 Sonic Rifle (upgrade)
 * - 51021 Sting Operation (upgrade)
 * - 51022 Aneka (ally)
 * - 51023 Ayo (ally)
 * - 51024 Okoye (ally)
 * - 51025 Heart of the Panther (event)
 * - 51026 Build Support (player_side_scheme)
 * - 51027 Energy (resource)
 * - 51028 Genius (resource)
 * - 51029 Strength (resource)
 * - 51030 Dora Milaje (support)
 * - 51036 Redemption (upgrade)
 * - 51037 White Wolf (ally)
 * - 51038 Target Spotter (support)
 */
export const BP_ASPECT_BASIC: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const BP_ASPECT_BASIC_SKIPPED: Readonly<Record<string, string>> = {};
