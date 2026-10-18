import type { AbilityRegistry } from "@mc/engine";
import {
  alterEgoAction,
  anyNumberOfToughStatusCards,
  attacksLoseKeywords,
  after,
  chooseCards,
  constant,
  defineAbilities,
  forcedResponse,
  moveCards,
  chosen,
  cards,
  query,
  oncePerPhase,
  shuffleDeck,
  takeDamage,
  zone,
} from "../../../dsl/index.js";

/** "Unbreakable Skin" (both faces): any number of tough status cards, and attacks against Luke Cage lose piercing. */
const unbreakableSkin = () =>
  constant(anyNumberOfToughStatusCards({ self: true }), attacksLoseKeywords(["piercing"], { target: { self: true } }));

/**
 * Wave 11 scripting module `luke_cage/luke-cage/identity` (docs/phase7-wave11-hero-packs.md H8.4, H3.2, H3.3).
 *
 * Cards (1):
 * - 62001a Luke Cage (hero_identity); 62001b is the alter-ego face.
 *
 * **62001a/b.luke-cage-constant** (Unbreakable Skin, both faces): "Luke Cage can have any number of tough status
 * cards. Attacks against Luke Cage lose piercing." Each tough card still prevents one damage instance; the card text
 * beats the one-of-each-status limit (RRG 1.8 p. 4).
 *
 * **62001a.luke-cage-forced-response**: "After a tough status card is discarded from Luke Cage, he takes 1
 * unpreventable damage (ignoring tough)." One per card discarded (several at once are several conditions of one
 * occurrence, H3.2).
 * Unpreventable damage (H3.3, MC62 insert) ignores tough and nothing reduces or prevents it.
 *
 * **62001b.luke-cage-action**: "Search your deck and discard pile for the Burstein Process upgrade and add it to your
 * hand. (Limit once per phase.)" Optional pick (a search may find nothing); the deck is shuffled afterwards (RRG 1.8
 * "Search", p. 39).
 */
export const LUKE_CAGE_LUKE_CAGE_IDENTITY: AbilityRegistry = defineAbilities({
  "62001a.luke-cage-constant": unbreakableSkin(),
  "62001a.luke-cage-forced-response": forcedResponse(
    after.statusDiscarded("tough", "self"),
    takeDamage(1, undefined, { unpreventable: true }),
  ),
  "62001b.luke-cage-constant": unbreakableSkin(),
  "62001b.luke-cage-action": alterEgoAction(
    { limit: oncePerPhase },
    chooseCards(
      "found",
      zone(["deck", "discard"], undefined, { filter: query("upgrade", { name: "Burstein Process" }) }),
      { min: 0, max: 1 },
    ),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const LUKE_CAGE_LUKE_CAGE_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {};
