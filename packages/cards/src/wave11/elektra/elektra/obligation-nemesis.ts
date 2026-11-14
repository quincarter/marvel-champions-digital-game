import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 11 scripting module `elektra/elektra/obligation-nemesis` (docs/phase7-elektra-iron-fist.md). Scaffold: a registry holding only the reprint aliases
 * (an empty one when there are none) with every other ref skipped, so scripting it is editing this file and its test.
 *
 * Cards (5):
 * - 63040 Conditioned by the Hand (obligation)
 * - 63041 Aka (minion)
 * - 63042 The Fist Fits in the Hand (side_scheme)
 * - 63044 Hand Blademaster (minion)
 * - 63045 Hand Archer (minion)
 */
export const ELEKTRA_ELEKTRA_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const ELEKTRA_ELEKTRA_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {
  "63040.obligation": "not scripted yet: Conditioned by the Hand give-to-player rule",
  "63040.conditioned-by-the-hand-forced-response":
    "not scripted yet: Conditioned by the Hand 3 damage to another identity or ally",
  "63040.conditioned-by-the-hand-action": "not scripted yet: Conditioned by the Hand alter-ego discard action",
  "63041.when-defeated": "not scripted yet: Aka shuffles into the encounter deck when defeated",
  "63041.boost": "not scripted yet: Aka's boost deals him to the Elektra Natchios player as a facedown encounter card",
  "63042.the-fist-fits-in-the-hand-constant": "not scripted yet: The Fist Fits in the Hand side scheme constant",
  "63044.hand-blademaster-constant": "not scripted yet: Hand Blademaster constant",
  "63044.when-defeated": "not scripted yet: Hand Blademaster when defeated",
  "63045.when-defeated": "not scripted yet: Hand Archer when defeated",
};
