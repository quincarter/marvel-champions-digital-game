import { trait } from "@mc/content";
import type { TargetRef, ValueSpec } from "@mc/engine";
import {
  after,
  cards,
  chooseTarget,
  chosen,
  confuse,
  defineAbilities,
  discard,
  discardAtRandom,
  discardEncounterUntil,
  exists,
  firstPlayer,
  forcedResponse,
  giveBoostCard,
  hasStatus,
  heal,
  identityOf,
  ifThen,
  moveCards,
  placeThreat,
  putIntoPlay,
  query,
  resolveSpecials,
  scenarioDeck,
  selectCards,
  self,
  special,
  stun,
  takeDamage,
  theMainScheme,
  theVillain,
  topOfDeck,
  you,
} from "../../dsl/index.js";

/**
 * The Infinity Gauntlet modular set (docs/phase7-wave4.md §1.10, §3.6): the Infinity Gauntlet attachment (21129)
 * and the six Infinity Stone environments (21130–21135), used by the Thanos and Loki scenarios. Single-villain only
 * (`EncounterSet.singleVillainOnly`, data), so only the Thanos scenario (`thanos.ts`) is wired against it today;
 * Loki is left to whoever scripts that scenario's own primitives.
 *
 * **"Attach to the villain" (errata) needs no ability ref.** `attachesTo: { kind: "villain" }` plus the `setup`
 * keyword already puts the Gauntlet into play attached to the (single) villain at setup, generically
 * (`enterPlayOnReveal`'s `case "attachment"`, `packages/engine/src/resolve/reveal.ts`) — the same mechanism
 * `packages/cards/src/wave3/gmw/ronan.ts`'s own docblock describes for the Power Stone's `setup` keyword.
 *
 * **"After attached villain activates against you, resolve the Special ability of each infinity stone in play.
 * Otherwise, put the top card of the infinity stone deck into play."** "Activates against you" is the villain's own
 * attack *or* scheme, targeted at "you": `after.enemySchemesOrAttacks("host")` (the Gauntlet's host is the villain)
 * plus the same `playerIs: "controller", usesAttackedPlayer: true` pair `dsl/abilities.ts`'s private `againstYou`
 * constant builds for `on.enemyAttacks`'s own `againstYou` option — no ready-made helper combines "either enemy
 * event" with "against you", so this spreads the same fields directly onto the pattern object. `resolveSpecials({
 * cards: { trait } })` inherits this Forced Response's own controller (the attacked player) as "you" for each
 * Special that reads it (Mind Stone, Power Stone: "you are confused"/"you are stunned") — proven generically by
 * `packages/engine/src/resolve-specials-controller.test.ts`.
 *
 * Each Special's own "Place this card in the infinity stone deck discard pile" needs no destination beyond a plain
 * `discard`: the card's `home` (set when the Infinity Stone deck is built at setup, `EncounterSet.separateDecks`)
 * already routes it to the deck's own discard pile (`discardZoneFor`, `packages/engine/src/query.ts`) —
 * `thanos.ts`'s own docblock gives the same reading.
 */

const INFINITY_STONE = trait("INFINITY STONE");
const STONE_DECK = "Infinity Stone";
const STONES_IN_PLAY = query("environment", { trait: INFINITY_STONE });

/**
 * "For each different card type discarded this way" (Time Stone). Engine primitive `ValueSpec.distinctCardTypes`
 * (`packages/engine/src/spec.ts`); no `dsl/values.ts` wrapper yet — the same gap
 * `packages/cards/src/wave1/thor/local.ts`'s own `distinctCardTypesOf` documents for Trickster (06030).
 */
const distinctCardTypesOf = (cardsRef: TargetRef): ValueSpec => ({ kind: "distinctCardTypes", cards: cardsRef });

/** "Put the top card of the infinity stone deck into play" (the Forced Response's "otherwise" branch). */
const putTopStoneIntoPlay = [
  selectCards("stone", scenarioDeck(STONE_DECK, { top: 1 })),
  putIntoPlay(chosen("stone"), firstPlayer),
];

export const INFINITY_GAUNTLET = defineAbilities({
  // Infinity Gauntlet (21129, +1 ATK/+1 SCH printed as a stat modifier; Permanent, Setup — data) — [star] Forced
  // Response: After attached villain activates against you, resolve the Special ability of each infinity stone in
  // play. Otherwise, put the top card of the infinity stone deck into play.
  "21129.infinity-gauntlet-forced-response": forcedResponse(
    { ...after.enemySchemesOrAttacks("host"), playerIs: "controller", usesAttackedPlayer: true },
    ifThen(exists(STONES_IN_PLAY), resolveSpecials(STONES_IN_PLAY), putTopStoneIntoPlay),
  ),

  // Mind Stone (21130) — Special: You are confused. If you were already confused, discard 1 card at random from
  // your hand. Place this card in the infinity stone deck discard pile.
  "21130.mind-stone-special": special(
    ifThen(hasStatus(identityOf(you), "confused"), discardAtRandom(1), confuse(identityOf(you))),
    discard(self),
  ),

  // Power Stone (21131) — Special: You are stunned. If you were already stunned, take 3 damage. Place this card in
  // the infinity stone deck discard pile.
  "21131.power-stone-special": special(
    ifThen(hasStatus(identityOf(you), "stunned"), takeDamage(3), stun(identityOf(you))),
    discard(self),
  ),

  // Reality Stone (21132) — Special: Discard an ally, upgrade, or support you control. Place this card in the
  // infinity stone deck discard pile. Not "may": forced, but naturally a no-op with no legal target (`chooseTarget`
  // asks nothing when nothing matches, and discarding an empty slot discards nothing).
  "21132.reality-stone-special": special(
    chooseTarget("card", query(["ally", "upgrade", "support"], { controller: "you" })),
    discard(chosen("card")),
    discard(self),
  ),

  // Soul Stone (21133) — Special: Heal 3 damage from the villain and give it a facedown boost card. Place this
  // card in the infinity stone deck discard pile.
  "21133.soul-stone-special": special(heal(3, theVillain), giveBoostCard(theVillain), discard(self)),

  // Space Stone (21134) — Special: Discard cards from the top of the encounter deck until a minion is discarded →
  // put that minion into play engaged with you. Place this card in the infinity stone deck discard pile.
  "21134.space-stone-special": special(
    discardEncounterUntil(query("minion"), "minion"),
    putIntoPlay(chosen("minion"), you),
    discard(self),
  ),

  // Time Stone (21135) — Special: Discard the top 4 cards of your deck and place 1 threat on the main scheme for
  // each different card type discarded this way. Place this card in the infinity stone deck discard pile.
  "21135.time-stone-special": special(
    selectCards("discarded", topOfDeck(4)),
    moveCards(cards(chosen("discarded")), "discard"),
    placeThreat(distinctCardTypesOf(chosen("discarded")), theMainScheme),
    discard(self),
  ),
});
