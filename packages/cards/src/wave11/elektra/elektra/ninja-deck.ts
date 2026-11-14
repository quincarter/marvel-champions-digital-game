import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 11 scripting module `elektra/elektra/ninja-deck` (docs/phase7-elektra-iron-fist.md). Scaffold: a registry holding only the reprint aliases
 * (an empty one when there are none) with every other ref skipped, so scripting it is editing this file and its test.
 *
 * Cards (3):
 * - 63002 Ninja Stars (treachery)
 * - 63003 Ninja Strike (treachery)
 * - 63004 Ninja Vanish (treachery)
 */
export const ELEKTRA_ELEKTRA_NINJA_DECK: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const ELEKTRA_ELEKTRA_NINJA_DECK_SKIPPED: Readonly<Record<string, string>> = {
  "63002.when-revealed":
    "needs engine primitive: Villainous boost cards (give this card to Elektra as a facedown boost card)",
  "63002.boost":
    "needs engine primitive: the Ninja deck (a separate encounter-family deck shuffled into the encounter deck)",
  "63003.when-revealed":
    "needs engine primitive: Villainous boost cards (give this card to Elektra as a facedown boost card)",
  "63003.boost":
    "needs engine primitive: the Ninja deck (a separate encounter-family deck shuffled into the encounter deck)",
  "63004.when-revealed":
    "needs engine primitive: Villainous boost cards (give this card to Elektra as a facedown boost card)",
  "63004.boost":
    "needs engine primitive: the Ninja deck (a separate encounter-family deck shuffled into the encounter deck)",
};
