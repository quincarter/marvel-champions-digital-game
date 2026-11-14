import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 11 scripting module `elektra/elektra/obligation-nemesis` (docs/phase7-elektra-iron-fist.md). Scaffold: an empty registry with every ref
 * skipped, so scripting it is editing this file and its test.
 *
 * Cards (5):
 * - 63028 Conditioned by the Hand (obligation)
 * - 63029 Aka (minion)
 * - 63030 The Fist Fits in the Hand (side_scheme)
 * - 63032 Hand Blademaster (minion)
 * - 63033 Hand Archer (minion)
 */
export const ELEKTRA_ELEKTRA_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const ELEKTRA_ELEKTRA_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {
  "63028.obligation": "not scripted yet: Conditioned by the Hand give-to-player rule",
  "63028.conditioned-by-the-hand-forced-response":
    "not scripted yet: Conditioned by the Hand 3 damage to another identity or ally",
  "63028.conditioned-by-the-hand-action": "not scripted yet: Conditioned by the Hand alter-ego discard action",
  "63029.when-defeated": "not scripted yet: Aka shuffles into the encounter deck when defeated",
  "63029.boost": "not scripted yet: Aka's boost deals him to the Elektra Natchios player as a facedown encounter card",
  "63030.the-fist-fits-in-the-hand-constant": "not scripted yet: The Fist Fits in the Hand side scheme constant",
  "63032.hand-blademaster-constant": "not scripted yet: Hand Blademaster constant",
  "63032.when-defeated": "not scripted yet: Hand Blademaster when defeated",
  "63033.when-defeated": "not scripted yet: Hand Archer when defeated",
};
