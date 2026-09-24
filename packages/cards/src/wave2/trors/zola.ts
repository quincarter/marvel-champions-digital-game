import { trait } from "@mc/content";
import {
  addCounters,
  attachCard,
  boost,
  cards,
  chooseCards,
  chosen,
  confuse,
  constant,
  countersOn,
  coveredByEngineRule,
  defineAbilities,
  discardEncounterUntil,
  eachPlayer,
  enemyAttack,
  enemyScheme,
  firstPlayer,
  forEachPlayer,
  forcedResponse,
  gainsKeyword,
  gets,
  giveTough,
  modifyStat,
  moveCards,
  on,
  putIntoPlay,
  query,
  removeCountersFrom,
  revealCard,
  searchAndReveal,
  self,
  selectCards,
  setup,
  shuffleDeck,
  shuffleEncounterDeck,
  stun,
  theMainScheme,
  theVillain,
  thatPlayer,
  totalPrintedCost,
  tuckCards,
  tuckedUnder,
  valueAtLeast,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  yourIdentity,
  zone,
} from "../../dsl/index.js";
import { countOf } from "../../dsl/values.js";
import { encounterCards } from "../../dsl/effects.js";
import { cardName } from "../names.js";

const TECH = trait("TECH");
const TEST = "test";
/** "If there are 3 or more test counters here" (Zola's stages 1/2, `absorbing-man.ts`'s `HIGH_DELAY` sibling). */
const HIGH_TEST = valueAtLeast(countersOn(theMainScheme, TEST), 3);
const TEST_SUBJECTS_NAME = cardName("04123");

/**
 * The Zola scenario (`zola` encounter set, plus the Under Attack modular set — Core's own, no new cards of its
 * own): the villain (04109–04111), main scheme "The Island of Dr. Zola" (04112), and his own encounter set
 * (04114–04124).
 *
 * **Reading:** `putIntoPlay(card, controller)` already engages a minion with `controller`
 * (`packages/engine/src/resolve/apply-effect.ts`'s `putIntoPlay` case: `engagedWith: isMinion ? controller :
 * instance.engagedWith`), so "put that minion into play engaged with the first player" needs no separate `engage`
 * effect — this pack's `crossbones.ts`/`taskmaster.ts` never needed one either, since neither put a minion into
 * play engaged with someone other than the ability's own resolving player.
 */
export const ZOLA_SET = defineAbilities({
  // Zola (I) prints no ability of its own (Retaliate 1 is data).

  // Zola (II) — Retaliate 1 (data). When Revealed: search for the Test Subjects side scheme and reveal it.
  "04110.when-revealed": whenRevealed(searchAndReveal(TEST_SUBJECTS_NAME, ["deck", "discard"], firstPlayer)),
  // Zola (III) — Retaliate 1 (data). When Revealed: each player searches the encounter deck and discard pile for
  // a minion and reveals it.
  "04111.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, [
      chooseCards("found", encounterCards(["deck", "discard"], query("minion")), {
        min: 1,
        max: 1,
        chooser: thatPlayer,
      }),
      revealCard(chosen("found"), thatPlayer),
      shuffleEncounterDeck(),
    ]),
  ),

  // The Island of Dr. Zola 1A — Setup: search for Hydra Prison and reveal it. Each player searches for a copy of
  // Ultimate Bio-Servant and puts it into play engaged with them. Shuffle the encounter deck.
  "04112a.setup": setup(
    searchAndReveal(cardName("04122"), ["deck", "discard"], firstPlayer),
    forEachPlayer(eachPlayer, [
      chooseCards("bioServant", encounterCards(["deck", "discard"], query("minion", { name: cardName("04114") })), {
        min: 1,
        max: 1,
        chooser: thatPlayer,
      }),
      putIntoPlay(chosen("bioServant"), thatPlayer),
      shuffleEncounterDeck(),
    ]),
  ),
  // The Island of Dr. Zola — Forced Response: after resolving step one of the villain phase, place 1 test counter
  // here. Then, if there are 3+ test counters, discard cards from the top of the encounter deck until a minion is
  // discarded, put it into play engaged with the first player, and remove 3 test counters. Wave 3 §3.2's
  // `villainStepResolved { step: "placeThreat" }` (docs/phase7-wave3.md §3.2, §5) is the step-one-completing
  // event; `on.threatPlaced(mainScheme)` fired on every threat placement on the main scheme from any source, not
  // once per villain phase (docs/phase7-wave3-qa.md Finding 1, and the same bug found here independently, which
  // Finding 1's own list of three cards didn't name).
  "04112b.the-island-of-dr-zola-forced-response": forcedResponse(
    on.villainStepResolved(),
    addCounters(TEST, 1, theMainScheme),
    ifThenHighTest("spawned"),
  ),

  // The Mad Doctor 2A — When Revealed: each player searches the encounter deck and discard pile for a minion and
  // reveals it. Shuffle the encounter deck.
  "04113a.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, [
      chooseCards("found", encounterCards(["deck", "discard"], query("minion")), {
        min: 1,
        max: 1,
        chooser: thatPlayer,
      }),
      revealCard(chosen("found"), thatPlayer),
    ]),
    shuffleEncounterDeck(),
  ),
  // The Mad Doctor 2B — same Forced Response as 1B (see 04112b's comment above for the `villainStepResolved` fix).
  // "If this scheme is completed, the players lose" is data.
  "04113b.the-mad-doctor-forced-response": forcedResponse(
    on.villainStepResolved(),
    addCounters(TEST, 1, theMainScheme),
    ifThenHighTest("spawned2"),
  ),
  // The data carries a second ("-constant") ability ref alongside the response with no separate printed text of
  // its own — an empty constant, the same parser-artifact shape as this pack's other duplicated refs.
  "04113b.the-mad-doctor-constant": coveredByEngineRule(),

  // Ultimate Bio-Servant — Toughness (data). [star] Gets +1 ATK for each attachment on it. [star] Boost: give the
  // villain a tough status card.
  "04114.ultimate-bio-servant-constant": constant(
    gets("atk", countOf(query("attachment", { host: self })), query("minion", { self: true })),
  ),
  "04114.boost": boost(giveTough(theVillain)),

  // Zola's Mutate — When Revealed: discard cards from the top of the encounter deck until a Tech attachment is
  // discarded; attach it to Zola's Mutate. [star] Boost: shuffle Zola's Mutate into the encounter deck.
  "04115.when-revealed": whenRevealed(
    discardEncounterUntil(query("attachment", { trait: TECH }), "found"),
    attachCard(chosen("found"), self),
  ),
  "04115.boost": boost(moveCards(cards(self), "encounterDeckShuffle")),

  // Berserk Mutate — Quickstrike (data). [star] Boost: place 1 test counter on the main scheme. For each test
  // counter on the main scheme, Zola gets +1 SCH and +1 ATK for this activation.
  "04116.boost": boost(
    addCounters(TEST, 1, theMainScheme),
    modifyStat("sch", countersOn(theMainScheme, TEST), theVillain, "endOfAttack"),
    modifyStat("atk", countersOn(theMainScheme, TEST), theVillain, "endOfAttack"),
  ),

  // Defensive Programming — Attach to the minion with the most remaining HP without a copy already there (data,
  // host). Attached minion gets +2 hit points and gains guard.
  "04117.defensive-programming-constant": constant(gets("hp", 2, query("minion", { hostOfSelf: true }))),
  "04117.defensive-programming-constant-2": constant(
    gainsKeyword({ name: "guard" }, query("minion", { hostOfSelf: true })),
  ),
  // Pain Inhibitors — same host rule. Attached minion gets +2 hit points and gains retaliate 1.
  "04118.pain-inhibitors-constant": constant(gets("hp", 2, query("minion", { hostOfSelf: true }))),
  "04118.pain-inhibitors-constant-2": constant(
    gainsKeyword({ name: "retaliate", value: 1 }, query("minion", { hostOfSelf: true })),
  ),
  // Neurological Implants — same host rule (data: +2 ATK/+2 SCH). Attached minion also gets +2 hit points. The
  // second ability ref the data carries has no further printed text (the same parser-artifact shape as
  // `04113b.the-mad-doctor-constant`) — stood up empty.
  "04119.neurological-implants-constant": constant(gets("hp", 2, query("minion", { hostOfSelf: true }))),
  "04119.neurological-implants-constant-2": coveredByEngineRule(),

  // Mind Ray — When Revealed (Alter-Ego): Zola schemes; you are confused. When Revealed (Hero): Zola attacks you;
  // you are stunned.
  "04120.when-revealed-alter-ego": whenRevealedAlterEgo(enemyScheme(theVillain), confuse(yourIdentity)),
  "04120.when-revealed-hero": whenRevealedHero(enemyAttack(theVillain, { against: you }), stun(yourIdentity)),

  // Technological Enhancements — Incite 1 (data). When Revealed: place 1 test counter. [star] Boost: place 1 test
  // counter.
  "04121.when-revealed": whenRevealed(addCounters(TEST, 1, theMainScheme)),
  "04121.boost": boost(addCounters(TEST, 1, theMainScheme)),

  // Hydra Prison — When Revealed: each player searches their deck, discard pile and hand for a hero-specific ally
  // and tucks it facedown beneath this scheme; place X threat where X is the total cost of all allies beneath it.
  // Each player shuffles their deck. When Defeated: remove this scheme from the game and return each ally beneath
  // it to its owner's hand.
  "04122.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, [
      chooseCards(
        "ally",
        zone(["hand", "deck", "discard"], thatPlayer, { filter: query("ally", { identitySetOf: thatPlayer }) }),
        { min: 1, max: 1, chooser: thatPlayer },
      ),
      tuckCards(cards(chosen("ally")), self, true),
      shuffleDeck(thatPlayer),
    ]),
    selectCards("beneath", tuckedUnder(self)),
    { kind: "placeThreat", target: self, amount: totalPrintedCost(chosen("beneath")) },
  ),
  "04122.when-defeated": whenDefeated(moveCards(tuckedUnder(self), "hand"), moveCards(cards(self), "removedFromGame")),

  // Test Subjects — When Defeated: the first player discards cards from the top of the encounter deck until they
  // discard a minion. Reveal that minion.
  "04123.when-defeated": whenDefeated(
    discardEncounterUntil(query("minion"), "found"),
    revealCard(chosen("found"), firstPlayer),
  ),

  // Zola's Experiments — Forced Response: after a minion enters play, attach the topmost Tech attachment in the
  // encounter discard pile to that minion.
  "04124.zolas-experiments-forced-response": forcedResponse(
    on.entersPlay(query("minion")),
    selectCards("found", encounterCards(["discard"], query("attachment", { trait: TECH }), 1)),
    { kind: "attach", card: chosen("found"), to: { kind: "eventTarget" } },
  ),
});

/**
 * "Then, if there are 3 or more test counters here, discard cards from the top of the encounter deck until a
 * minion is discarded. Put that minion into play engaged with the first player and remove 3 test counters from
 * this scheme." — shared by stages 1B and 2B, each with its own bind slot name.
 */
function ifThenHighTest(slot: string) {
  return {
    kind: "if" as const,
    condition: HIGH_TEST,
    then: [
      discardEncounterUntil(query("minion"), slot),
      putIntoPlay(chosen(slot), firstPlayer),
      removeCountersFrom(theMainScheme, TEST, 3),
    ],
  };
}
