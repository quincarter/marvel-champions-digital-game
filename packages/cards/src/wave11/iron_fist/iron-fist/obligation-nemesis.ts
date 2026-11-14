import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../../dsl/index.js";

/**
 * Wave 11 scripting module `iron_fist/iron-fist/obligation-nemesis` (docs/phase7-elektra-iron-fist.md). Scaffold: an empty registry with every ref
 * skipped, so scripting it is editing this file and its test.
 *
 * Cards (4):
 * - 64028 Lack of Chi (obligation)
 * - 64029 Davos (minion)
 * - 64030 Steel Serpent (side_scheme)
 * - 64031 Crane Daughter (minion)
 */
export const IRON_FIST_IRON_FIST_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const IRON_FIST_IRON_FIST_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {
  "64028.obligation": "not scripted yet: Lack of Chi give-to-player rule",
  "64028.when-revealed": "not scripted yet: Lack of Chi when revealed",
  "64028.lack-of-chi-forced-interrupt": "not scripted yet: Lack of Chi forced interrupt",
  "64029.when-revealed": "not scripted yet: Davos tucks the three Crane Daughter minions",
  "64029.davos-forced-interrupt": "not scripted yet: Davos swaps damage for a tucked Crane Daughter",
  "64030.steel-serpent-constant": "not scripted yet: Steel Serpent side scheme constant",
  "64031.when-defeated": "not scripted yet: Crane Daughter when defeated",
  "64031.boost": "not scripted yet: Crane Daughter boost",
};
