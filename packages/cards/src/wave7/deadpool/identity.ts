import type { AbilityRegistry } from "@mc/engine";
import {
  addAccelerationToken,
  alterEgoAction,
  changeForm,
  chooseCards,
  chosen,
  cards,
  defineAbilities,
  discardFromHandCost,
  forcedInterrupt,
  instead,
  isHero,
  moveCards,
  oncePerRound,
  query,
  setRemainingHitPoints,
  shuffleDeck,
  when,
  yourIdentity,
  YOUR_IDENTITY,
  you,
  zone,
} from "../../dsl/index.js";

/**
 * Deadpool / Wade Wilson (44001a/b): docs/phase7-wave7.md §7.3, §3.78. Stats and hand size are data (hero THW 2,
 * ATK 2, DEF 1, hand size 5, 9 hit points; alter-ego REC 8, hand size 6). No Setup. His deck is the 'Pool aspect, so
 * the Dreadpool set rides with any game that seats it (the `dreadpool` module, not this one).
 *
 * - **The Regeneratin' Degenerate (44001a)**, Forced Interrupt: when Deadpool would be defeated, instead set his hit
 *   point dial to 1, change to alter-ego form and add 1 acceleration token to the main scheme. Printed on the hero
 *   face only, so `while: isHero()`: Wade Wilson at 0 hit points is defeated. The form change is an effect, not the
 *   once-per-round change (RRG "Form, Change Form", p. 21). When he cannot change form the replacement resolves as
 *   far as it can (spec Q45 = A): the dial still goes to 1 and the token is still added.
 * - **Break the Fourth Wall (44001b)**, Alter-Ego Action: discard a card from your hand -> search your deck for a
 *   Deadpool event (an event of his own identity set) and add it to your hand, once per round. A search needs only a
 *   searchable area to start (RRG "Search", p. 39), so a deck with no such event still pays and finds nothing; the
 *   deck is shuffled after the search (RRG p. 39).
 */
export const DEADPOOL_IDENTITY: AbilityRegistry = defineAbilities({
  "44001a.the-regeneratin-degenerate": forcedInterrupt(
    when.defeated(YOUR_IDENTITY),
    { while: isHero(), would: true },
    instead(setRemainingHitPoints(1, yourIdentity), changeForm(you, "alterEgo"), addAccelerationToken()),
  ),

  "44001b.break-the-fourth-wall": alterEgoAction(
    { limit: oncePerRound, cost: discardFromHandCost(1) },
    chooseCards("found", zone("deck", you, { filter: query("event", { identitySetOf: you }) }), { min: 0, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),
});
