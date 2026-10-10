import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 9 scripting module `tt/trickster-magic` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (7):
 * - 55056 Absorbing Man (minion)
 * - 55057 Titania (minion)
 * - 55058 Whirlwind (minion)
 * - 55059 Zzzax (minion)
 * - 55060 The Trickster Tango (side_scheme)
 * - 55061 Puppet Master (side_scheme)
 * - 55062 Love Triangle (attachment)
 */
export const TRICKSTER_MAGIC: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const TRICKSTER_MAGIC_SKIPPED: Readonly<Record<string, string>> = {};
