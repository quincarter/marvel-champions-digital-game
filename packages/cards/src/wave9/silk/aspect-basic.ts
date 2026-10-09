import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `silk/aspect-basic` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (18):
 * - 52013 Scarlet Spider (ally)
 * - 52014 Spider-Byte (ally)
 * - 52015 Not Today! (event)
 * - 52016 "Stop Hitting Yourself" (event)
 * - 52017 Dr. Sinclair (support)
 * - 52018 Energy Shield (upgrade)
 * - 52019 Ready for a Fight (upgrade)
 * - 52020 Stun Gun (upgrade)
 * - 52021 Madame Web (ally)
 * - 52022 Spider-Man (ally)
 * - 52023 Across the Spider-Verse (event)
 * - 52024 Investigative Journalism (event)
 * - 52025 Energy (resource)
 * - 52026 Genius (resource)
 * - 52027 Strength (resource)
 * - 52032 Spider-Man 2099 (ally)
 * - 52033 Spider-Woman (ally)
 * - 52034 Quick Quip (event)
 */
export const SILK_ASPECT_BASIC: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SILK_ASPECT_BASIC_SKIPPED: Readonly<Record<string, string>> = {};
