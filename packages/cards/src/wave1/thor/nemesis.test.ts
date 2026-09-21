import { activeEncounterDeck } from "@mc/engine";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  settleUntil,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { forceMinionIntoPlay, runThor, stackFromSetAside, startThorGame, THOR_DEPS } from "./testing.js";

const thorVsRhino = (seed = 11) =>
  startThorGame(wave1Scenario("rhino", { players: [{ starterDeckId: "thor-aggression" }], seed }));
// A neutral boost card (0 icons, no boost ability) — put on top of the target so the villain phase's boost draw
// consumes it first (matches `packages/cards/src/core/heroes/spider-man.test.ts`'s `ADVANCE`, same Rhino pool).
const ADVANCE = "01186";

describe("Odin's Anger (Thor's obligation)", () => {
  it("offers the optional flip in hero form, then 'exhaust Odinson → remove it from the game'", () => {
    const start = stackEncounterDeck(thorVsRhino(), ADVANCE, "06026");
    const atFlip = settleUntil(runThor(start, toHero(), endTurn()), "chooseOption", firstLegal, THOR_DEPS);
    expect(atFlip.pendingChoice?.playerId).toBe(P1);
    expect(atFlip.pendingChoice?.options.map((o) => o.label)).toEqual(["Flip to alter-ego form", "Stay in hero form"]);
    const flipped = answer(atFlip, ["0"], THOR_DEPS);
    expect(playerOf(flipped, P1).identity.form).toBe("alterEgo");
    expect(flipped.pendingChoice?.options.map((o) => o.label)).toEqual([
      "Exhaust Odinson → remove this obligation from the game",
      "Discard Mjolnir from your hand or from play. You are stunned.",
    ]);
    const removed = settle(answer(flipped, ["0"], THOR_DEPS), firstLegal, undefined, THOR_DEPS);
    const obligation = instancesOf(removed, "06026")[0];
    expect(removed.removedFromGame).toContain(obligation);
    expect(inst(removed, identityOf(removed)).exhausted).toBe(true);
  });

  it("the alternative discards Mjolnir (from hand or play), stuns Thor, and discards the obligation", () => {
    const start = stackEncounterDeck(thorVsRhino(), ADVANCE, "06026");
    // Mjolnir in hand this time, to exercise the hand-zone half of the effect.
    const given = moveToHand(start, P1, "06009");
    const [mjolnir] = given.ids as [never];
    const atChoice = settleUntil(runThor(given.state, endTurn()), "chooseOption", firstLegal, THOR_DEPS); // alter-ego already: no flip offer
    expect(atChoice.pendingChoice?.options).toHaveLength(2);
    const after = settle(answer(atChoice, ["1"], THOR_DEPS), firstLegal, undefined, THOR_DEPS);
    const obligation = instancesOf(after, "06026")[0]!;
    expect(activeEncounterDeck(after).discard).toContain(obligation);
    expect(playerOf(after, P1).discard).toContain(mjolnir);
    expect(inst(after, identityOf(after)).statuses.stunned).toBeGreaterThan(0);
  });
});

describe("Thor nemesis set", () => {
  it("Family Feud: places 1 additional threat for each Asgard card in play, on top of its printed starting threat", () => {
    const start = thorVsRhino();
    const given = moveToHand(start, P1, "06007"); // Asgard (support, Asgard trait)
    const [asgard] = given.ids as [never];
    const withAsgard = runThor(given.state, play(P1, asgard, payWith(given.state, P1, 3, [asgard])));
    const withScheme = stackFromSetAside(withAsgard, P1, "06027");
    const stacked = stackEncounterDeck(withScheme, ADVANCE, "06027");
    const hero = runThor(stacked, toHero());
    const revealed = settle(runThor(hero, endTurn()), firstLegal, undefined, THOR_DEPS);
    const familyFeud = instancesOf(revealed, "06027")[0]!;
    // Printed starting threat is 2 (data); +1 for each Asgard card in play — the Asgard support, and Thor's own
    // identity (printed with the Asgard trait, `packages/content/src/data/thor/cards.ts`), so +2.
    expect(inst(revealed, familyFeud).threat).toBe(4);
  });

  /** Loki (06028) forced into play, engaged with P1, at 3 of his printed 4 hit points — one hit from defeat. */
  function lokiOneHitFromDefeat(topOfEncounterDeck: string) {
    const start = thorVsRhino();
    const given = moveToHand(start, P1, "06006", "06022"); // Lightning Strike, Energy
    const [strike, energyCard] = given.ids as [never, never];
    const withLoki = stackFromSetAside(given.state, P1, "06028", "06030");
    const stacked = stackEncounterDeck(withLoki, topOfEncounterDeck);
    const hero = runThor(stacked, toHero());
    const loki = instancesOf(hero, "06028")[0]!;
    const inPlay = patchInstance(forceMinionIntoPlay(hero, loki, P1), loki, { damage: 3 });
    return { state: inPlay, strike, energyCard, loki };
  }

  it("survives, healed, when the discarded card is a treachery", () => {
    const { state, strike, energyCard, loki } = lokiOneHitFromDefeat("06030"); // Trickster, a treachery
    // Lightning Strike deals 1 damage (X=1, paid with the Energy card alone) to the villain and each minion
    // engaged with Thor, lethal to Loki — his own Forced Interrupt discards the top encounter card (Trickster, a
    // treachery here) and heals him instead of letting the defeat happen.
    const played = runThor(state, play(P1, strike, [energyCard]));
    const after = settle(played, firstLegal, undefined, THOR_DEPS);
    expect(inst(after, loki).damage).toBe(0);
  });

  it("is defeated normally when the discarded card is not a treachery", () => {
    const { state, strike, energyCard, loki } = lokiOneHitFromDefeat("01186"); // ADVANCE, not a treachery
    const played = runThor(state, play(P1, strike, [energyCard]));
    const after = settle(played, firstLegal, undefined, THOR_DEPS);
    expect(activeEncounterDeck(after).discard).toContain(loki);
  });

  it("Frost Giant: stuns a character the villain's attack damages, via its boost ability", () => {
    const start = thorVsRhino();
    const withGiant = stackFromSetAside(start, P1, "06029");
    // The boost card dealt for the villain's own attack this villain phase.
    const stacked = stackEncounterDeck(withGiant, "06029");
    const hero = runThor(stacked, toHero());
    const identity = identityOf(hero);
    const afterTurn = settle(runThor(hero, endTurn()), firstLegal, undefined, THOR_DEPS);
    expect(inst(afterTurn, identity).statuses.stunned).toBeGreaterThan(0);
  });

  it("Trickster: discards the top 3 cards of the revealing player's deck, placing threat per distinct card type", () => {
    const start = thorVsRhino();
    const withTrickster = stackFromSetAside(start, P1, "06030");
    const stacked = stackEncounterDeck(withTrickster, ADVANCE, "06030");
    const deckBefore = playerOf(stacked, P1).deck;
    const top3 = deckBefore.slice(0, 3);
    const revealed = settle(runThor(stacked, toHero(), endTurn()), firstLegal, undefined, THOR_DEPS);
    expect(playerOf(revealed, P1).discard).toEqual(expect.arrayContaining(top3));
    expect(playerOf(revealed, P1).deck.length).toBe(deckBefore.length - 3);
  });
});
