import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/power-of-the-atom` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (4):
 * - 50152 Radioactive Man (minion)
 * - 50153 Radiation Exposure (attachment)
 * - 50154 Runaway Nuclear Reaction (side_scheme)
 * - 50155 Power of the Atom (treachery)
 */
export const POWER_OF_THE_ATOM: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const POWER_OF_THE_ATOM_SKIPPED: Readonly<Record<string, string>> = {};
