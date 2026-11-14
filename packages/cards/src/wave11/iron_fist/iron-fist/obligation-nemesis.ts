import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 11 scripting module `iron_fist/iron-fist/obligation-nemesis` (docs/phase7-elektra-iron-fist.md). Scaffold: a registry holding only the reprint aliases
 * (an empty one when there are none) with every other ref skipped, so scripting it is editing this file and its test.
 *
 * Cards (4):
 * - 64034 Lack of Chi (obligation)
 * - 64035 Davos (minion)
 * - 64036 Steel Serpent (side_scheme)
 * - 64037 Crane Daughter (minion)
 */
export const IRON_FIST_IRON_FIST_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const IRON_FIST_IRON_FIST_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {
  "64034.obligation": "not scripted yet: Lack of Chi give-to-player rule",
  "64034.when-revealed": "not scripted yet: Lack of Chi when revealed",
  "64034.lack-of-chi-forced-interrupt": "not scripted yet: Lack of Chi forced interrupt",
  "64035.when-revealed": "not scripted yet: Davos tucks the three Crane Daughter minions",
  "64035.davos-forced-interrupt": "not scripted yet: Davos swaps damage for a tucked Crane Daughter",
  "64036.steel-serpent-constant": "not scripted yet: Steel Serpent side scheme constant",
  "64037.when-defeated": "not scripted yet: Crane Daughter when defeated",
  "64037.boost": "not scripted yet: Crane Daughter boost",
};
