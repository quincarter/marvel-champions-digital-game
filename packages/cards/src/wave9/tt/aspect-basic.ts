import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `tt/aspect-basic` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (4):
 * - 55063 Absorbing Man (ally)
 * - 55064 Titania (ally)
 * - 55065 Whirlwind (ally)
 * - 55066 Zzzax (ally)
 */
export const TT_ASPECT_BASIC: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const TT_ASPECT_BASIC_SKIPPED: Readonly<Record<string, string>> = {};
