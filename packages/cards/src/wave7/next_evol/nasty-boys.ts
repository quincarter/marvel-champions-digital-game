import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  activatingEnemy,
  addCounters,
  atEndOfActivation,
  boost,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  countOf,
  countersOn,
  defineAbilities,
  each,
  encounterCards,
  exhaust,
  forcedInterrupt,
  gets,
  ifThen,
  modifyAttack,
  moveCards,
  on,
  placeThreat,
  query,
  refMatches,
  revealCard,
  rule,
  self,
  shuffleEncounterDeck,
  stun,
  sum,
  whenRevealed,
  yourIdentity,
} from "../../dsl/index.js";

/**
 * The Nasty Boys modular set (40112-40117): five NASTY BOY minions and the Get Nasty side scheme. Teamwork (NASTY BOY)
 * on all five, and Hairbag's surge, Ramrod's retaliate and Slab's toughness, are card data (the built keywords; wave 6
 * decisions Q1 = RRG 1.8, Q2 = before When Revealed). A minion draws no boost card of its own (only the villain and
 * villainous minions do), so what is scripted here is each card's rules text and its Boost ability, resolved when the
 * card is turned faceup as a boost card for another enemy.
 *
 * "Exhaust a character you control" follows Bitter Rival (`trors` 04136): the player chooses any character they
 * control, one already exhausted included (the choice is not narrowed to a ready one).
 */
const NASTY_BOY = trait("NASTY BOY");
const NASTY_BOY_MINIONS = query("minion", { trait: NASTY_BOY });
const MINIONS = query("minion");
const YOUR_CHARACTERS = query("character", { controller: "you" });
const THE_VILLAIN = query("villain");

export const NASTY_BOYS: AbilityRegistry = defineAbilities({
  // Gorgeous George — Forced Interrupt: When Gorgeous George attacks you, exhaust a character you control. (An attack on
  // your ally is resolved by the ally's controller, owner decision Q5 = A.)
  "40112.gorgeous-george-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("self", { againstYou: true }),
    chooseTarget("char", YOUR_CHARACTERS),
    exhaust(chosen("char")),
  ),
  // [star] Boost: Exhaust a character you control.
  "40112.boost": boost(chooseTarget("char", YOUR_CHARACTERS), exhaust(chosen("char"))),

  // Hairbag — [star] Boost: After this activation, shuffle Hairbag into the encounter deck. (The boost card is not
  // also discarded: it has left the discard-bound path by then; `boost.test.ts` pins that for Goblin Knight.)
  "40113.boost": boost(atEndOfActivation(moveCards(cards(self), "encounterDeckShuffle"))),

  // Ramrod — [star] Ramrod's attacks gain piercing.
  "40114.ramrod-constant": constant(
    rule({ kind: "attackKeywords", keywords: ["piercing"], attacker: query("minion", { self: true }) }),
  ),
  // [star] Boost: If the villain is attacking, this attack gains piercing. (A scheme activation ignores the attack
  // modifier, and a villainous minion's attack is not the villain's, so neither gains it.)
  "40114.boost": boost(ifThen(refMatches(activatingEnemy, THE_VILLAIN), modifyAttack({ keywords: ["piercing"] }))),

  // Ruckus — When Revealed: Stun each character you control. [star] Boost: You are stunned.
  "40115.when-revealed": whenRevealed(stun(each(YOUR_CHARACTERS))),
  "40115.boost": boost(stun(yourIdentity)),

  // Slab — [star] Forced Interrupt: When Slab attacks, place 1 growth counter on him. Slab gets +1 ATK for each growth
  // counter on him for this attack. (Any attack of his, so no "against you" condition.)
  "40116.slab-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("self"),
    addCounters("growth", 1, self),
    modifyAttack({ atkBonus: countersOn(self, "growth") }),
  ),

  // Get Nasty — Each minion gets +1 ATK.
  "40117.get-nasty-constant": constant(gets("atk", 1, MINIONS)),
  // When Revealed: Place 1 threat here for each minion in play (2 threat instead for each NASTY BOY): a NASTY BOY counts
  // twice. Then search the encounter deck and discard pile for a NASTY BOY minion and reveal it (the player who revealed
  // Get Nasty chooses among them). Shuffle. The threat is counted before the search, so the minion it reveals is not.
  "40117.when-revealed": whenRevealed(
    placeThreat(sum(countOf(MINIONS), countOf(NASTY_BOY_MINIONS)), self),
    chooseCards("found", encounterCards(["deck", "discard"], NASTY_BOY_MINIONS), { min: 1, max: 1 }),
    revealCard(chosen("found")),
    shuffleEncounterDeck(),
  ),
});
