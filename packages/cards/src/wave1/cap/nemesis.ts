import {
  chooseCards,
  chosen,
  constant,
  countBoostIcons,
  eachPlayer,
  each,
  encounterCards,
  enemyAttack,
  forEachPlayer,
  forEachPlayerInChosenOrder,
  identityOf,
  moveCards,
  not,
  playersWhere,
  putIntoPlay,
  query,
  refMatches,
  rule,
  shuffleEncounterDeck,
  TRAIT,
  takeDamage,
  thatPlayer,
  varOf,
  whenRevealed,
  you,
} from "../../dsl/index.js";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Captain America's nemesis set: Hit Squad (03027, side scheme), Baron Zemo (03028, nemesis minion), Hydra
 * Soldier (03029, minion — a Core reprint aliased by `../reprints.ts`, not scripted here), Hail Hydra! (03030,
 * treachery).
 */
export const CAP_NEMESIS = defineAbilities({
  // Hit Squad — When Revealed: In player order, each player discards the top card of the encounter deck and takes
  // 1 damage for each boost icon discarded this way. `.boostIcons` on `moveCards`' bind sums the printed (plus any
  // modifier) boost icons of the moved cards (new — see `apply-effect.ts`'s `moveCards` case).
  "03027.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      moveCards(encounterCards(["deck"], undefined, 1), "discard", "milled"),
      countBoostIcons(chosen("milled"), "milled"),
      takeDamage(varOf("milled.boostIcons"), thatPlayer),
    ),
  ),

  // Baron Zemo — Quickstrike (data). While Baron Zemo is engaged with you, you cannot thwart.
  "03028.baron-zemo-constant": constant(rule({ kind: "cannotThwart", player: you })),

  // Hail Hydra! — When Revealed: Each Hydra minion engaged with a hero attacks that hero (an enemy with no
  // `against` attacks its own engaged player — already a Core primitive). Each player who was not attacked this
  // way searches the encounter deck and discard pile for a Hydra minion and puts it into play engaged with them
  // (a category search: the player chooses one of possibly several matches, unlike Core's `fetchIntoPlay`'s
  // single named card). Shuffle the encounter deck if it was searched.
  // Reading: "engaged with a hero" is read as "engaged with a player" (any form), matching the Core convention
  // that minions engage and attack players regardless of form (docs/phase2-core-set.md §4 "Masters of Mayhem").
  // "Attacked this way" is the attacked player of each of those attacks as it finished, not the player it was
  // initiated against: a player whose character defends an attack on another player is the attacked player (FFG
  // ruling July 25, 2024, docs/rulings/post-rrg-1-6/01-july-2024.md; RRG 1.8 "Defend, Defense", p. 16), so they skip
  // the search and the player the attack was initiated against searches (owner decision C, issue #1012 §4). The
  // `bind` reports those players as `hailHydra.attackedPlayers` (`ATTACKED_PLAYERS_SLOT`). An attack that did not
  // happen (a stunned minion) attacked nobody.
  "03030.when-revealed": whenRevealed(
    enemyAttack(each(query("minion", { trait: TRAIT.HYDRA, engagedWith: "any" })), { bind: "hailHydra" }),
    forEachPlayerInChosenOrder(
      playersWhere(not(refMatches(identityOf(thatPlayer), { inSlot: "hailHydra.attackedPlayers" }))),
      chooseCards("found", encounterCards(["deck", "discard"], query("minion", { trait: TRAIT.HYDRA })), {
        min: 1,
        max: 1,
        chooser: thatPlayer,
      }),
      putIntoPlay(chosen("found"), thatPlayer),
      shuffleEncounterDeck(),
    ),
  ),
});
