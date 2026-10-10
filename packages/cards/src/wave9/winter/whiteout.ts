import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `winter/whiteout` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (4):
 * - 54034 Blizzard (minion)
 * - 54035 Encased in Ice (attachment)
 * - 54036 Slippery Conditions (side_scheme)
 * - 54037 Whiteout (treachery)
 */
export const WHITEOUT: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const WHITEOUT_SKIPPED: Readonly<Record<string, string>> = {};
