import {
  action,
  addCounters,
  after,
  allOf,
  aScheme,
  attackAnEnemy,
  chosen,
  choosePlayer,
  chosenPlayer,
  confuse,
  constant,
  defineAbilities,
  discardFromHandCost,
  discardThis,
  draw,
  exhaustThis,
  exists,
  forcedResponse,
  gainsTrait,
  gets,
  healYourIdentityCost,
  heroAction,
  heroInterrupt,
  ifElse,
  ifThen,
  isAlterEgo,
  moveCards,
  named,
  not,
  oncePerRound,
  paidWith,
  perHero,
  placeThreat,
  preventDamage,
  query,
  response,
  scaled,
  self,
  spend,
  spendX,
  stun,
  surge,
  theMainScheme,
  theVillain,
  thwart,
  thwartAScheme,
  TRAIT,
  boost,
  undefendedAttack,
  varAtLeast,
  varOf,
  when,
  whenRevealed,
  YOUR_HERO,
  you,
  yourIdentity,
  youHaveTrait,
  zone,
} from "../../dsl/index.js";
import { cardName } from "../names.js";
import { obligation } from "../obligations.js";

/** "If you are Carol Danvers": your identity is Captain Marvel's card, in alter-ego form. */
const youAreCarolDanvers = allOf(isAlterEgo(), exists(query("alterEgo", { controller: "you", name: cardName("01010a") })));

/** Captain Marvel (01010a/b) and her hero kit (01011–01018). */
export const CAPTAIN_MARVEL_KIT = defineAbilities({
  // Rechannel — Action: Spend a [energy] resource and heal 1 damage from Captain Marvel → draw 1 card. (Limit once per round.)
  "01010a.rechannel": action({ cost: [spend({ energy: 1 }), healYourIdentityCost(1)], limit: oncePerRound }, draw(1)),
  // Commander — Action: Choose a player to draw 1 card. (Limit once per round.)
  "01010b.commander": action({ limit: oncePerRound }, choosePlayer(), draw(1, chosenPlayer())),
  // Spider-Woman — Response: After Spider-Woman enters play, confuse the villain.
  "01011.spider-woman-response": response(after.entersPlay("self"), confuse(theVillain)),
  // Crisis Interdiction — Hero Action (thwart): Remove 2 threat from a scheme. Then, if you have the Aerial trait, remove 2 threat from a different scheme.
  "01012.crisis-interdiction-action": heroAction(
    { label: "thwart" },
    thwartAScheme(2, "first"),
    ifThen(youHaveTrait(TRAIT.AERIAL), [aScheme("second", { excludeSlots: ["first"] }), thwart(2, chosen("second"))]),
  ),
  // Photonic Blast — Hero Action (attack): Deal 5 damage to an enemy. If you paid for this card using a [energy] resource, draw 1 card.
  "01013.photonic-blast-action": heroAction({ label: "attack" }, attackAnEnemy(5), ifThen(paidWith("energy"), draw(1))),
  // Alpha Flight Station — Action: Exhaust Alpha Flight Station, choose and discard 1 card from your hand → draw 1 card
  // (draw 2 cards instead if you are Carol Danvers).
  "01015.alpha-flight-station-action": action({ cost: [exhaustThis, discardFromHandCost(1, 1)] }, draw(ifElse(youAreCarolDanvers, 2, 1))),
  // Captain Marvel's Helmet — Captain Marvel gets +1 DEF (+2 DEF instead if you have the Aerial trait).
  "01016.captain-marvels-helmet-constant": constant(gets("def", ifElse(youHaveTrait(TRAIT.AERIAL), 2, 1), YOUR_HERO)),
  // Cosmic Flight — Captain Marvel gains the Aerial trait.
  "01017.cosmic-flight-constant": constant(gainsTrait(TRAIT.AERIAL, YOUR_HERO)),
  // Hero Interrupt (defense): When Captain Marvel would take damage, discard Cosmic Flight → prevent 3 of that damage.
  "01017.cosmic-flight-interrupt": heroInterrupt(when.damage(YOUR_HERO), { label: "defense", cost: discardThis }, preventDamage(3)),
  // Energy Channel — Action: Spend X [energy] resources → put X energy counters here.
  "01018.energy-channel-action": action({ cost: spendX("energy", "x") }, addCounters("energy", varOf("x"))),
  // Hero Action (attack): Discard Energy Channel → deal 2 damage to an enemy (to a maximum of 10) for each energy counter here.
  "01018.energy-channel-hero-action": heroAction(
    { label: "attack", cost: discardThis },
    attackAnEnemy(scaled(varOf("self.counters.energy"), { times: 2, max: 10 })),
  ),
});

/** Family Emergency (01175), Captain Marvel's obligation. */
export const CAPTAIN_MARVEL_OBLIGATION = defineAbilities({
  // • You are stunned. This card gains surge. Discard this obligation.
  "01175.obligation": obligation("Carol Danvers", { label: "You are stunned; this card gains surge", effects: [stun(yourIdentity), surge()] }),
});

/** Captain Marvel's nemesis set: The Psyche-Magnitron, Yon-Rogg, Kree Manipulator, Yon-Rogg's Treason. */
export const CAPTAIN_MARVEL_NEMESIS = defineAbilities({
  // The Psyche-Magnitron — When Revealed: Place an additional 1 [per_hero] threat here.
  "01176.when-revealed": whenRevealed(placeThreat(perHero(1), self)),
  // Yon-Rogg — [star] Forced Response: After Yon-Rogg attacks, place 1 threat on The Psyche-Magnitron.
  "01177.yon-rogg-forced-response": forcedResponse(after.enemyAttacks("self"), placeThreat(1, named(cardName("01176")))),
  // Kree Manipulator — Surge. When Revealed: Place 1 threat on the main scheme.
  "01178.when-revealed": whenRevealed(placeThreat(1, theMainScheme)),
  // [star] Boost: If the villain is making an undefended attack, place 1 threat on the main scheme.
  "01178.boost": boost(ifThen(undefendedAttack, placeThreat(1, theMainScheme))),
  // Yon-Rogg's Treason — When Revealed: Discard each [energy] resource from your hand. If you discarded no cards this way, this card gains surge.
  // Read as each card in hand with a printed [energy] resource icon (a wild icon is its own type).
  "01179.when-revealed": whenRevealed(
    moveCards(zone("hand", you, { filter: { printedResource: "energy" } }), "discard", "treason"),
    ifThen(not(varAtLeast("treason.count")), surge()),
  ),
});
