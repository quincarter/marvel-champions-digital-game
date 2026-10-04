import { trait } from "@mc/content";
import type { EventPattern } from "@mc/engine";
import {
  alterEgoAction,
  constant,
  defineAbilities,
  enemyAttack,
  exhaustYourHero,
  exists,
  forcedResponse,
  ifThen,
  moveCards,
  cards,
  each,
  on,
  placeThreat,
  query,
  encounterCards,
  oneCopyOf,
  revealCard,
  selectCards,
  chosen,
  shuffleEncounterDeck,
  you,
  self,
  spend,
  theMainScheme,
  whenRevealed,
} from "../../../dsl/index.js";

const ASSASSIN = query("minion", { trait: trait("ASSASSIN") });

/** "After [X] attacks and defeats a character": the enemy attack's `defeated` result (RRG 1.8 "Attack", p. 7). */
const attacksAndDefeats = (by: "self" | typeof ASSASSIN): EventPattern => ({
  ...on.enemyAttacks(by),
  requireResults: { defeated: 1 },
});

/**
 * Guild Business (37025), Gambit's obligation, and his Belladonna nemesis set (`gambit_nemesis`): Belladonna (37026,
 * nemesis minion), The Assassins Guild (37027, side scheme), Guild Assassin x2 (37028, minion) and Assassination
 * Attempt (37029, treachery). docs/phase7-wave6.md §6.2.
 *
 * - **Guild Business** stays in play (Claustrophobia's shape). "Give to the Remy LeBeau player" is the engine's
 *   obligation default (an empty `constant()`); it has no When Revealed. Its action costs Remy exhausted and an
 *   [energy] resource.
 * - **Assassination Attempt**: every ASSASSIN minion attacks the revealing player, alter-ego form or not; if none was
 *   in play, the search finds one and reveals it.
 */
export const GAMBIT_OBLIGATION_NEMESIS = defineAbilities({
  // Give to the Remy LeBeau player.
  "37025.guild-business-constant": constant(),
  // Alter-Ego Action: Exhaust Remy LeBeau and spend a [energy] resource -> remove Guild Business from the game.
  "37025.guild-business-action": alterEgoAction(
    { cost: [exhaustYourHero, spend({ energy: 1 })] },
    moveCards(cards(self), "removedFromGame"),
  ),

  // Belladonna — Quickstrike, Toughness (data). [star] Forced Response: After Belladonna attacks and defeats a
  // character, place 2 threat on the main scheme.
  "37026.belladonna-forced-response": forcedResponse(attacksAndDefeats("self"), placeThreat(2, theMainScheme)),

  // The Assassins Guild — Forced Response: After an ASSASSIN minion attacks and defeats a character, place 2 threat here.
  "37027.the-assassins-guild-forced-response": forcedResponse(attacksAndDefeats(ASSASSIN), placeThreat(2, self)),

  // Guild Assassin — Quickstrike (data). [star] Forced Response: After Guild Assassin attacks and defeats a character,
  // place 1 threat on the main scheme.
  "37028.guild-assassin-forced-response": forcedResponse(attacksAndDefeats("self"), placeThreat(1, theMainScheme)),

  // Assassination Attempt — When Revealed: Each ASSASSIN minion attacks you (even if you are in alter-ego form). If
  // there are no ASSASSIN minions in play, search the encounter deck and discard pile for an ASSASSIN minion and
  // reveal it.
  "37029.when-revealed": whenRevealed(
    ifThen(exists(ASSASSIN), enemyAttack(each(ASSASSIN), { against: you }), [
      selectCards("found", oneCopyOf(encounterCards(["deck", "discard"], ASSASSIN))),
      revealCard(chosen("found"), you),
      shuffleEncounterDeck(),
    ]),
  ),
});
