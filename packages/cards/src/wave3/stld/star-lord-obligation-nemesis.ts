import {
  chooseTarget,
  chosen,
  constant,
  defineAbilities,
  discard,
  discardAtRandom,
  engagedPlayerOf,
  exists,
  firstRevealGainsSurge,
  ifThen,
  placeThreat,
  query,
  self,
  takeDamage,
  theMainScheme,
  whenRevealed,
} from "../../dsl/index.js";
import { obligation } from "../../core/obligations.js";

const ELEMENT_GUN_IN_PLAY = query("upgrade", { name: "Element Gun" });

/**
 * Banishment (17024), Star-Lord's obligation, and his nemesis set: Budding Crime Syndicate (17025, no ability of
 * its own — its Hinder keyword is read directly, docs/phase7-wave3.md §1.3), Mister Knife (17026), Spartoi
 * Cunning ×3 (17027).
 */
export const STAR_LORD_OBLIGATION_NEMESIS = defineAbilities({
  // Banishment — Give to the Peter Quill player. You may flip to alter-ego form. Choose:
  // • Exhaust Peter Quill → remove Banishment from the game.
  // • Discard an Element Gun from play. If you cannot, place 3 threat on the main scheme. Discard this
  //   obligation.
  "17024.obligation": obligation("Peter Quill", {
    label: "Discard an Element Gun from play",
    effects: [
      ifThen(
        exists(ELEMENT_GUN_IN_PLAY),
        [chooseTarget("gun", ELEMENT_GUN_IN_PLAY), discard(chosen("gun"))],
        placeThreat(3, theMainScheme),
      ),
    ],
  }),

  // Mister Knife — Retaliate 1 (data). The first treachery the engaged player reveals each villain phase gains
  // surge. FAQ "Mister Knife (#26)" (RRG 1.8 p. 62): a card revealed before Mister Knife was in play doesn't
  // count, since the rule is only read once it's already in play (docs/phase7-wave3.md §3.8).
  "17026.mister-knife-constant": constant(
    firstRevealGainsSurge(query("treachery"), "phase", { revealer: engagedPlayerOf(self) }),
  ),

  // Spartoi Cunning — When Revealed: Discard 1 card at random from your hand, take 1 damage, and place 1 threat
  // on the main scheme.
  "17027.when-revealed": whenRevealed(discardAtRandom(1), takeDamage(1), placeThreat(1, theMainScheme)),
});
