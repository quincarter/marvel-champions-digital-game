import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/supersonic` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (5):
 * - 50156 MACH-IV (minion)
 * - 50157 Blasters (attachment)
 * - 50158 Heat-Seeking Missiles (attachment)
 * - 50159 Aerial Dogfight (side_scheme)
 * - 50160 Supersonic (treachery)
 */
export const SUPERSONIC: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SUPERSONIC_SKIPPED: Readonly<Record<string, string>> = {};
