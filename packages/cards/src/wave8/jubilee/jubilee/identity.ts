import type { AbilityRegistry } from "@mc/engine";
import {
  alterEgoAction,
  chooseCards,
  chosen,
  defineAbilities,
  exhaustThis,
  oncePerPhase,
  putIntoPlay,
  resource,
  shuffleDeck,
  you,
  zone,
} from "../../../dsl/index.js";

/**
 * Jubilee / Jubilation Lee (47001a/b): docs/phase7-wave8.md section 7.3, 3.66, 3.70.
 *
 * Cards (1):
 * - 47001a Jubilee (hero_identity)
 *
 * "Like, totally!" (47001a), Resource: exhaust Jubilee, generate a [wild] resource. The hero face's text only works
 * while the identity is in hero form; exhausting her means she cannot also thwart, attack or defend with that exhaust,
 * and in alter-ego form the ability is not there to use (so it cannot pay Grounded's cost).
 *
 * Mall Rat (47001b), Action, limit once per phase: search your deck for the Shopping Spree player side scheme and put it
 * into play. Not a play, so it costs nothing. Deck only (a copy in hand or in the discard pile is not found). A search
 * always ends in a shuffle (RRG "Search", p. 39), also when nothing is found, and the use is spent either way.
 */
export const JUBILEE_IDENTITY: AbilityRegistry = defineAbilities({
  "47001a.like-totally": resource({ wild: 1 }, { cost: exhaustThis }),

  "47001b.mall-rat": alterEgoAction(
    { limit: oncePerPhase },
    chooseCards("found", zone("deck", you, { filter: { name: "Shopping Spree" } }), { min: 0, max: 1 }),
    putIntoPlay(chosen("found"), you),
    shuffleDeck(),
  ),
});
