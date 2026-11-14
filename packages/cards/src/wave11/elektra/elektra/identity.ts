import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 11 scripting module `elektra/elektra/identity` (docs/phase7-elektra-iron-fist.md). Scaffold: a registry holding only the reprint aliases
 * (an empty one when there are none) with every other ref skipped, so scripting it is editing this file and its test.
 *
 * Cards (1):
 * - 63001a Elektra (hero_identity)
 */
export const ELEKTRA_ELEKTRA_IDENTITY: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const ELEKTRA_ELEKTRA_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {
  "63001a.killer-instinct":
    "needs engine primitive: Killer Instinct, an interrupt on a faceup boost card given to Elektra that cancels its Boost and gives the card the boost icon",
  "63001b.elektra-natchios-constant":
    "not scripted yet: the begins-the-game Ninja deck is separateDecks data; the constant itself needs a scripted setup hook",
  "63001b.ninja-training":
    "needs engine primitive: the Ninja deck (a separate encounter-family deck shuffled into the encounter deck)",
};
