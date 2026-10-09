import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `silk/growing-strong` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (4):
 * - 52035 Atlas (minion)
 * - 52036 Grow Invulnerable (side_scheme)
 * - 52037 Growing Strong (treachery)
 * - 52038 Titanic Proportions (treachery)
 */
export const GROWING_STRONG: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const GROWING_STRONG_SKIPPED: Readonly<Record<string, string>> = {};
