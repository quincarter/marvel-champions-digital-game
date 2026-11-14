import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 11 scripting module `elektra/protection` (docs/phase7-elektra-iron-fist.md).
 *
 * Cards (1):
 * - 63039 Moon Knight (ally)
 */
export const ELEKTRA_PROTECTION: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const ELEKTRA_PROTECTION_SKIPPED: Readonly<Record<string, string>> = {
  "63039.moon-knight-interrupt":
    "rules ambiguity, not scripted: the printed 'spend up to 3 resources -> if you spent at least 1:' then one line per resource type does not say whether each line applies once per type spent, once per resource of that type, or as a choice; needs a ruling",
};
