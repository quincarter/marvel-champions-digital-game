import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  allOf,
  anyOf,
  attackExcessAsDealt,
  cards,
  chooseCards,
  chosen,
  defineAbilities,
  encounterCards,
  eventDealt,
  exactlyDefeated,
  heal,
  heroAction,
  query,
  reorderCards,
  response,
  self,
  shuffleEncounterDeck,
  valueAtMost,
} from "../../dsl/index.js";
import { FNE_ASPECT_BASIC_BASIC } from "../fne/aspect-basic/basic.js";

/**
 * Wave 11 scripting module `elektra/basic` (docs/phase7-elektra-iron-fist.md).
 *
 * Cards (3):
 * - 63022 Stone (ally)
 * - 63023 Hunting Shadows (event)
 * - 63027 Dance with the Devil (upgrade)
 *
 * Reprints, aliased to the original card's script: 63027.
 *
 * **63022 Stone**: one ability for "exactly defeats an enemy or side scheme", so it listens to Stone's attack and to a
 * side scheme's defeat together. An attack is exact when it defeated the enemy and dealt no excess damage (ruling
 * August 3, 2026 - Ruling 6: the excess dealt, so a damage reducer does not make a defeat exact); a side scheme is
 * exactly defeated by Stone's thwart when it removed exactly the last threat (`exactlyDefeated`, MC60 p. 4).
 *
 * **63023 Hunting Shadows**: "set it aside, shuffle, put it on top" is the chosen card shuffled in with the deck and then
 * placed on top (`reorderCards`): the set-aside step is invisible, since nothing can react to a card sitting there.
 * Not optional ("for a card", RRG 1.8 "Search", p. 39: no criteria to fail), so one card is found while the top 8 has any.
 */
export const ELEKTRA_BASIC: AbilityRegistry = defineAbilities({
  "63022.stone-response": response(
    {
      ...after.attacks("self", { target: query(["enemy", "sideScheme"]) }),
      on: ["attack", "schemeDefeated"],
    },
    {
      while: anyOf(exactlyDefeated, allOf(eventDealt("defeated"), valueAtMost(attackExcessAsDealt, 0))),
    },
    heal(2, self),
  ),

  "63023.hunting-shadows-action": heroAction(
    chooseCards("found", encounterCards(["deck"], undefined, 8), { min: 1, max: 1 }),
    shuffleEncounterDeck(),
    reorderCards(cards(chosen("found"))),
  ),

  "63027.dance-with-the-devil-action": FNE_ASPECT_BASIC_BASIC["60031.dance-with-the-devil-action"]!,
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const ELEKTRA_BASIC_SKIPPED: Readonly<Record<string, string>> = {};
