import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/gravitational-pull` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (4):
 * - 50139 Moonstone (minion)
 * - 50140 Rule the Skies (side_scheme)
 * - 50141 Gravitational Pull (treachery)
 * - 50142 Psychological Manipulation (treachery)
 */
export const GRAVITATIONAL_PULL: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const GRAVITATIONAL_PULL_SKIPPED: Readonly<Record<string, string>> = {};
