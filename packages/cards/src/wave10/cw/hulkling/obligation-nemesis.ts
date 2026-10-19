import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import { obligation } from "../../../core/obligations.js";
import {
  allOf,
  attachCard,
  cards,
  chooseTarget,
  chosen,
  constant,
  defineAbilities,
  discard,
  discardFromHand,
  each,
  enemyAttack,
  engage,
  eventTargetsTogether,
  exists,
  findCard,
  firstPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsKeywordX,
  gets,
  giveTough,
  ifThen,
  inPlay,
  isHero,
  modifyAttack,
  moveCards,
  named,
  on,
  placeThreat,
  query,
  resourceTypesOf,
  self,
  stillCountedByDiscarder,
  takeDamage,
  theMainScheme,
  topOfDeck,
  tuckCards,
  varAtLeast,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
} from "../../../dsl/index.js";

const SUPER_SKRULL = "Super Skrull";
const SUPER_SKRULL_CARD = query("minion", { name: SUPER_SKRULL });
const YOUR_UPGRADES = query("upgrade", { controller: "you" });
const YOUR_SHAPES = query("upgrade", { trait: trait("Shapeshift"), controller: "you" });
const milled = (type: "energy" | "mental" | "physical" | "wild") => varAtLeast(`skrull.${type}`);

/**
 * Wave 10 scripting module `cw/hulkling/obligation-nemesis` (docs/phase7-wave10.md section 8.4,
 * docs/phase7-wave10-box-heroes.md B3.3, B3.12, B3.13, B3.15).
 *
 * Cards (5):
 * - 56054 Complicated Lineage (obligation)
 * - 56055 Super Skrull (minion)
 * - 56056 Skrull Business (side_scheme)
 * - 56057 Fantastic Powers (attachment)
 * - 56058 You're Coming With Me! (treachery)
 *
 * **56054.obligation**: the Core obligation frame (`core/obligations.ts`): the flip is optional, then the player
 * chooses between exhausting Teddy Altman to remove the card and the second option, whose discard of every Shapeshift
 * upgrade the player controls comes before the card's own. Discarding the shapes does not ready Hulkling (Chosen Shape
 * hears a shape entering, not leaving).
 *
 * **56055.super-skrull-forced-interrupt**: "When Super Skrull attacks you, discard the top card of your deck. If that
 * card's printed resource has: ...". The four lines are one ability. A card with two different icons gives both
 * results (RRG 1.8 FAQ "Hulk", p. 61: the printed resources are checked simultaneously), and wild is its own line, not
 * "all of the above". The results read different things (this attack's ATK, the hand, Super Skrull's status cards, the
 * upgrades), so the order the player may choose cannot change the outcome and no choice of order is asked. With
 * Skrull Business in play the discarded card is still counted (owner's answer to box-heroes question 14 = A,
 * provisional; the mark is on Skrull Business's ability).
 *
 * **56056.skrull-business-forced-response**: every discard from the top of any player's deck is answered once, the cards
 * going facedown under this scheme. `stillCountedByDiscarder` keeps the discarding ability's own count (question 14 = A).
 *
 * **56057**: the constant is the printed "+3 hit points and retaliate 1"; the +1 ATK and +1 SCH are the card's own
 * stat modifiers (data). The When Revealed finds Super Skrull in the encounter deck, its discard pile, the set-aside
 * nemesis set or in play. One already in play is not put into play again: he engages the revealing player and keeps
 * everything on him (owner's answer to question 15 = B, provisional, by analogy with RRG 1.8 "Find", p. 19: a minion
 * already in play that is found and revealed is engaged by that player; "Engage", p. 18). Otherwise he enters play
 * engaged with the player, and the encounter deck is shuffled when he came out of it (RRG "Search", p. 39). With
 * Super Skrull nowhere to be found nothing is attached, and the attachment is discarded (RRG "Attach To", p. 8).
 * Which decks are looked through is the engine's `findCard` (RRG "Find", p. 19: "should not unnecessarily search game
 * areas if they know where the card ... can be found"): in play, set aside or in the discard pile he is known to be
 * there and no deck is searched or shuffled; otherwise the encounter deck is looked through and shuffled (RRG "Search",
 * p. 39: "if any portion of a deck is searched ... shuffle that entire deck"), whether or not he was in it, e.g. when he
 * has been removed from the game. That is the RRG's "Search" rule applied to "Find", not a ruling on this card.
 *
 * **56058**: "Discard the top 3 cards of your deck", then 1 threat on the main scheme (alter ego) or 1 damage (hero) for
 * each different resource icon on the discarded cards. Wild counts as its own icon. With Skrull Business in play the
 * three are still counted (question 14 = A).
 */
export const HULKLING_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "56054.obligation": obligation("Teddy Altman", {
    label: "Discard each Shapeshift upgrade you control",
    effects: [discard(each(YOUR_SHAPES))],
  }),

  "56055.super-skrull-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("self", { againstYou: true }),
    moveCards(topOfDeck(1), "discard", "skrull"),
    ifThen(milled("energy"), modifyAttack({ atkBonus: 2 })),
    ifThen(milled("mental"), discardFromHand(1)),
    ifThen(milled("physical"), giveTough(self)),
    ifThen(allOf(milled("wild"), exists(YOUR_UPGRADES)), [
      // No "choose": an encounter card targeting one of several eligible cards; the first player selects
      // (RRG 1.8 "First Player", p. 19).
      chooseTarget("upgrade", YOUR_UPGRADES, { chooser: firstPlayer }),
      discard(chosen("upgrade")),
    ]),
  ),

  "56056.skrull-business-forced-response": stillCountedByDiscarder(
    forcedResponse(on.aPlayerDiscardsFromTheirDeck(), tuckCards(cards(eventTargetsTogether), self, true)),
  ),

  "56057.fantastic-powers-constant": constant(
    gets("hp", 3, { hostOfSelf: true }),
    gainsKeywordX("retaliate", 1, { hostOfSelf: true }),
  ),
  "56057.when-revealed": whenRevealed(
    ifThen(inPlay(SUPER_SKRULL), engage(named(SUPER_SKRULL), you), findCard(SUPER_SKRULL_CARD, "play")),
    attachCard(self, named(SUPER_SKRULL)),
    ifThen(isHero(), enemyAttack(named(SUPER_SKRULL), { against: you })),
  ),

  "56058.when-revealed-alter-ego": whenRevealedAlterEgo(
    moveCards(topOfDeck(3), "discard", "discarded"),
    placeThreat(resourceTypesOf(chosen("discarded")), theMainScheme),
  ),
  "56058.when-revealed-hero": whenRevealedHero(
    moveCards(topOfDeck(3), "discard", "discarded"),
    takeDamage(resourceTypesOf(chosen("discarded"))),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const HULKLING_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
