import {
  chooseCards,
  chosen,
  constant,
  eachPlayer,
  each,
  encounterCards,
  enemyAttack,
  exists,
  forEachPlayer,
  ifThen,
  moveCards,
  not,
  putIntoPlay,
  query,
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
  "03030.when-revealed": whenRevealed(
    enemyAttack(each(query("minion", { trait: TRAIT.HYDRA, engagedWith: "any" }))),
    forEachPlayer(
      eachPlayer,
      ifThen(not(exists(query("minion", { trait: TRAIT.HYDRA, engagedWithPlayer: thatPlayer }))), [
        chooseCards("found", encounterCards(["deck", "discard"], query("minion", { trait: TRAIT.HYDRA })), {
          min: 1,
          max: 1,
          chooser: thatPlayer,
        }),
        putIntoPlay(chosen("found"), thatPlayer),
        shuffleEncounterDeck(),
      ]),
    ),
  ),
});
