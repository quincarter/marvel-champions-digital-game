import {
  alterEgoAction,
  attackAnEnemy,
  boost,
  cards,
  chooseCards,
  chooseOne,
  choosePlayer,
  chooseTarget,
  chosen,
  chosenPlayer,
  constant,
  dealDamage,
  defineAbilities,
  discard,
  draw,
  each,
  encounterCards,
  exhaustThis,
  exists,
  finalStep,
  giveTough,
  heroAction,
  ifElse,
  ifThen,
  moveCards,
  option,
  placeThreat,
  query,
  resolveSpecials,
  response,
  rule,
  scaled,
  setup,
  shuffleDeck,
  special,
  takeDamage,
  theMainScheme,
  theVillain,
  thwartAScheme,
  TRAIT,
  boostIconsOn,
  after,
  whenRevealed,
  you,
  yourIdentity,
  zone,
} from "../../dsl/index.js";
import { obligation } from "../obligations.js";

const BLACK_PANTHER_UPGRADE = query("upgrade", { trait: TRAIT.BLACK_PANTHER });
const YOUR_BLACK_PANTHER_UPGRADES = query("upgrade", { controller: "you", trait: TRAIT.BLACK_PANTHER });

/** Wakanda Forever! — Hero Action: Resolve the "Special" ability on each Black Panther upgrade you control in any order. */
const WAKANDA_FOREVER = heroAction(resolveSpecials(YOUR_BLACK_PANTHER_UPGRADES));

/** Black Panther (01040a/b; Retaliate 1 is a hero-face keyword) and his hero kit (01041–01049). */
export const BLACK_PANTHER_KIT = defineAbilities({
  // Foresight — Setup: Search your deck for a Black Panther upgrade and add it to your hand. Shuffle your deck.
  "01040b.foresight": setup(
    chooseCards("upgrade", zone("deck", you, { filter: BLACK_PANTHER_UPGRADE }), { min: 1, max: 1 }),
    moveCards(cards(chosen("upgrade")), "hand"),
    shuffleDeck(),
  ),
  // Shuri — Response: After Shuri enters play, search your deck for an upgrade and add it to your hand. Shuffle your deck.
  "01041.shuri-response": response(
    after.entersPlay("self"),
    chooseCards("upgrade", zone("deck", you, { filter: query("upgrade") }), { min: 1, max: 1 }),
    moveCards(cards(chosen("upgrade")), "hand"),
    shuffleDeck(),
  ),
  // Ancestral Knowledge — Alter-Ego Action: Choose up to 3 different cards in your discard pile and shuffle them into your deck.
  "01042.ancestral-knowledge-action": alterEgoAction(
    chooseCards("cards", zone("discard"), { min: 0, max: 3, distinctNames: true }),
    moveCards(cards(chosen("cards")), "deckShuffle"),
  ),
  // Wakanda Forever! (four printings with different resource icons; the same ability).
  "01043a.wakanda-forever-action": WAKANDA_FOREVER,
  "01043b.wakanda-forever-action": WAKANDA_FOREVER,
  "01043c.wakanda-forever-action": WAKANDA_FOREVER,
  "01043d.wakanda-forever-action": WAKANDA_FOREVER,
  // The Golden City — Alter-Ego Action: Exhaust The Golden City → draw 2 cards.
  "01045.the-golden-city-action": alterEgoAction({ cost: exhaustThis }, draw(2)),
  // Energy Daggers — Special: Choose a player. Deal 1 damage to the villain and to each enemy engaged with that player
  // (2 damage instead if this is the final step of this sequence). Not an attack.
  "01046.energy-daggers-special": special(
    choosePlayer(),
    dealDamage(ifElse(finalStep, 2, 1), theVillain),
    dealDamage(ifElse(finalStep, 2, 1), each(query("enemy", { engagedWithPlayer: chosenPlayer() }))),
  ),
  // Panther Claws — Special (attack): Deal 2 damage to an enemy (4 damage instead if this is the final step of this sequence).
  "01047.panther-claws-special": special({ label: "attack" }, attackAnEnemy(ifElse(finalStep, 4, 2))),
  // Tactical Genius — Special (thwart): Remove 1 threat from a scheme (2 threat instead if this is the final step of this sequence).
  "01048.tactical-genius-special": special({ label: "thwart" }, thwartAScheme(ifElse(finalStep, 2, 1))),
  // Vibranium Suit — Special (attack): Move 1 damage from your hero to an enemy (2 damage instead if this is the final step of this sequence).
  "01049.vibranium-suit-special": special(
    { label: "attack" },
    attackAnEnemy(ifElse(finalStep, 2, 1), { moveDamageFrom: yourIdentity }),
  ),
});

/** Affairs of State (01155), Black Panther's obligation. */
export const BLACK_PANTHER_OBLIGATION = defineAbilities({
  // • Choose and discard a Black Panther upgrade you control. Discard this obligation.
  "01155.obligation": obligation("T'Challa", {
    label: "Choose and discard a Black Panther upgrade you control",
    effects: [
      ifThen(exists(YOUR_BLACK_PANTHER_UPGRADES), [
        chooseTarget("upgrade", YOUR_BLACK_PANTHER_UPGRADES),
        discard(chosen("upgrade")),
      ]),
    ],
  }),
});

const RITUAL_X = scaled(boostIconsOn(chosen("ritual")), { plus: 1 });

/** Black Panther's nemesis set: Usurp the Throne (no text), Killmonger, Heart-Shaped Herb, Ritual Combat. */
export const BLACK_PANTHER_NEMESIS = defineAbilities({
  // Killmonger — Killmonger cannot take damage from Black Panther upgrades.
  "01157.killmonger-constant": constant(
    rule({ kind: "cannotTakeDamage", target: { self: true }, fromSource: BLACK_PANTHER_UPGRADE }),
  ),
  // Heart-Shaped Herb — Surge. When Revealed: Give the villain and each minion engaged with you a tough status card.
  "01158.when-revealed": whenRevealed(giveTough(theVillain), giveTough(each(query("minion", { engagedWith: "you" })))),
  // [star] Boost: Give the villain a tough status card.
  "01158.boost": boost(giveTough(theVillain)),
  // Ritual Combat — When Revealed: Discard the top card of the encounter deck. Then, choose to either deal X damage to your
  // hero or place X threat on the main scheme. X is 1 more than the number of boost icons on the discarded encounter card.
  "01159.when-revealed": whenRevealed(
    moveCards(encounterCards(["deck"], undefined, 1), "discard", "ritual"),
    chooseOne(
      option("Deal X damage to your hero", takeDamage(RITUAL_X)),
      option("Place X threat on the main scheme", placeThreat(RITUAL_X, theMainScheme)),
    ),
  ),
});
