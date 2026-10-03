import { trait } from "@mc/content";
import {
  boost,
  cards,
  chooseCards,
  chooseOne,
  chosen,
  constant,
  defeatingPlayer,
  defineAbilities,
  discard,
  discardFromHand,
  doubleDamageTaken,
  draw,
  each,
  eachPlayer,
  forEachPlayer,
  gets,
  ifThen,
  increaseDamageTaken,
  moveCards,
  option,
  playFromDeckIgnoringCost,
  putIntoPlay,
  query,
  removeThreatFromAScheme,
  revealedFromEncounterDeck,
  selectCards,
  self,
  surge,
  takesDamageOnlyFrom,
  thatPlayer,
  whenDefeated,
  whenRevealed,
  zone,
} from "../../dsl/index.js";

const SETTING = trait("SETTING");

/** "Each player draws 2 cards. Each player must discard each card from their hand with the chosen resource type." */
const drainOf = (type: "physical" | "mental" | "energy") => [
  forEachPlayer(eachPlayer, draw(2, thatPlayer)),
  forEachPlayer(
    eachPlayer,
    selectCards("drained", zone("hand", thatPlayer, { filter: { printedResource: type } })),
    moveCards(cards(chosen("drained")), "discard"),
  ),
];

/**
 * MojoMania (`mojo`), the Fantasy genre set (`fantasy` 39041-39046, docs/phase7-wave6.md §7.4): A Game of Mojo's (the
 * SHOW environment), Dragon, Goblin, Troll, Fetch Quest and Mana Drain.
 *
 * **Damage by printed resource** (§3.68): the source is the card the damage came through, so a hero's basic attack
 * (the identity, no printed resource) is neither doubled by Dragon nor allowed by Goblin. Troll's +1 and Dragon's
 * doubling are applied in the RRG 1.8 p. 29 order (additions, then doubling).
 *
 * **Fetch Quest** is the RRG 1.8 p. 69 erratum ("ignoring its resource cost", not "for free"): a card with a
 * requirement is never offered by the search.
 *
 * **Mana Drain** asks for a non-wild type; the options are listed physical, mental, energy, so a player who takes the
 * first legal answer picks physical. The two lines of the text are the same in each branch.
 */
export const FANTASY_ABILITIES = defineAbilities({
  // A Game of Mojo's (39041) — Each player gets +1 hand size.
  "39041.a-game-of-mojos-constant": constant(gets("handSize", 1, query("identity"))),
  // A Game of Mojo's — When Revealed: Discard each other Setting environment in play. If this card was revealed from
  // the encounter deck, it gains surge.
  "39041.when-revealed": whenRevealed(
    discard(each(query("environment", { trait: SETTING, excluding: self }))),
    ifThen(revealedFromEncounterDeck, surge()),
  ),

  // Dragon (39042) — Double the amount of damage this minion takes from cards with a printed [energy] resource.
  "39042.dragon-constant": constant(doubleDamageTaken({ self: true }, { fromSource: { printedResource: "energy" } })),
  // Dragon — When Defeated: Each player draws 4 cards.
  "39042.when-defeated": whenDefeated(forEachPlayer(eachPlayer, draw(4, thatPlayer))),

  // Goblin (39043) — This minion can only take damage from cards with a printed [physical] resource.
  "39043.goblin-constant": constant(takesDamageOnlyFrom({ self: true }, { printedResource: "physical" })),
  // Goblin — When Defeated: Remove 2 threat from a scheme.
  "39043.when-defeated": whenDefeated(removeThreatFromAScheme(2)),

  // Troll (39044) — This minion takes 1 additional damage from each card with a printed [mental] resource.
  "39044.troll-constant": constant(
    increaseDamageTaken({ self: true }, 1, { fromSource: { printedResource: "mental" } }),
  ),
  // Troll — When Defeated: The player who defeated this minion may put 1 ally from their discard pile into play.
  "39044.when-defeated": whenDefeated(
    chooseCards("revived", zone("discard", defeatingPlayer, { filter: { categories: ["ally"] } }), {
      min: 0,
      max: 1,
      chooser: defeatingPlayer,
    }),
    putIntoPlay(chosen("revived"), defeatingPlayer),
  ),

  // Fetch Quest (39045) — When Defeated: In player order, each player may search their deck for a card and play that
  // card, ignoring its resource cost. (Shuffle.)
  "39045.when-defeated": whenDefeated(forEachPlayer(eachPlayer, playFromDeckIgnoringCost(thatPlayer))),
  // Fetch Quest — [star] Boost: Put this card into play.
  "39045.boost": boost(putIntoPlay(self)),

  // Mana Drain (39046) — When Revealed: Choose a non-wild resource type, then each player draws 2 cards. Each player
  // must discard each card from their hand with the chosen resource type.
  "39046.when-revealed": whenRevealed(
    chooseOne(
      option("Physical", drainOf("physical")),
      option("Mental", drainOf("mental")),
      option("Energy", drainOf("energy")),
    ),
  ),
  // Mana Drain — [star] Boost: Discard 1 card from your hand.
  "39046.boost": boost(discardFromHand(1)),
});
