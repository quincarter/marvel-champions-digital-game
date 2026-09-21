import { activeEncounterDeck, activeVillain, allyLimitFor, applyCommand, remainingHitPoints } from "@mc/engine";
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
  picking,
  play,
  playerOf,
  settle,
  settleUntil,
  stackEncounterDeck,
  toHero,
  use,
} from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { runWave1, startWave1Game, WAVE1_DEPS } from "../testing.js";

// Real wave 1 content: the Captain America (Leadership) precon against Rhino, standard, solo.
const capVsRhino = () =>
  startWave1Game(wave1Scenario("rhino", { players: [{ starterDeckId: "cap-leadership" }], seed: 11 }));
// A neutral boost card (0 icons, no boost ability) — put on top of an obligation/nemesis card being stacked so
// the villain phase's boost draw consumes it first, leaving the real target on top for the player's deal step
// (matches `packages/cards/src/core/heroes/spider-man.test.ts`'s `ADVANCE`, same Rhino encounter pool).
const ADVANCE = "01186";
// Rhino's own set, 0 boost icons and no boost ability: a second neutral boost card, since Core has only two Advances.
const HARD_TO_KEEP_DOWN = "01104";

describe("Captain America kit", () => {
  it('"I Can Do This All Day!": discards 1 card, readies Captain America, once per round', () => {
    const start = capVsRhino();
    const hero = runWave1(start, toHero());
    const identity = identityOf(hero);
    const exhausted = patchInstance(hero, identity, { exhausted: true });
    const discarded = playerOf(exhausted, P1).hand[0]!;
    const after = runWave1(exhausted, use(P1, identity, "03001a.i-can-do-this-all-day", [], { discard: [discarded] }));
    expect(inst(after, identity).exhausted).toBe(false);
    expect(playerOf(after, P1).discard).toContain(discarded);

    // Limit once per round: cannot use again this round even once re-exhausted.
    const exhaustedAgain = patchInstance(after, identity, { exhausted: true });
    const discardedAgain = playerOf(exhaustedAgain, P1).hand[0]!;
    const rejected = applyCommand(
      exhaustedAgain,
      use(P1, identity, "03001a.i-can-do-this-all-day", [], { discard: [discardedAgain] }),
      WAVE1_DEPS,
    );
    expect(rejected.ok).toBe(false);
  });

  it("Living Legend: reduces the cost of the first ally played each round by 1, not the second", () => {
    const start = capVsRhino();
    const given = moveToHand(start, P1, "03002", "03011", "03015", "03015", "03015", "03017", "03017", "03017");
    const [agent13, falcon] = given.ids as [never, never];

    // Agent 13's printed cost is 3; paying only 2 proves the first-ally-this-round discount applied. Her own
    // Response ("remove 2 threat from a scheme") leaves a mandatory chooseTarget pending (only the main scheme
    // is a legal target this early) — settle it before issuing the next command.
    const after1 = settle(
      runWave1(given.state, play(P1, agent13, payWith(given.state, P1, 2, [agent13, falcon]))),
      firstLegal,
      undefined,
      WAVE1_DEPS,
    );
    expect(playerOf(after1, P1).playArea).toContain(agent13);

    // Falcon's printed cost is 4; paying only 3 must fail (no discount left this round) — excluding The Power of
    // Leadership (03018) too, since it doubles its own value while paying for a Leadership card (Falcon's
    // aspect) and would otherwise make 3 cards worth 4 and mask the missing discount.
    const powerOfLeadership = instancesOf(after1, "03018");
    const underpaid = applyCommand(
      after1,
      play(P1, falcon, payWith(after1, P1, 3, [falcon, ...powerOfLeadership])),
      WAVE1_DEPS,
    );
    expect(underpaid.ok).toBe(false);
    // … but paying the full 4 succeeds.
    const after2 = runWave1(after1, play(P1, falcon, payWith(after1, P1, 4, [falcon])));
    expect(playerOf(after2, P1).playArea).toContain(falcon);
  });

  it("Setup: Steve Rogers finds Captain America's Shield (from the deck or discard) into hand", () => {
    const start = capVsRhino();
    const shield = instancesOf(start, "03009")[0]!;
    expect(playerOf(start, P1).hand).toContain(shield);
  });

  it("Shield Block: exhausts Captain America's Shield to prevent an attack's damage", () => {
    const start = capVsRhino();
    const shield = instancesOf(start, "03009")[0]!;
    const given = moveToHand(start, P1, "03005"); // Shield Block
    const [shieldBlock] = given.ids as [never];
    const hero = runWave1(given.state, toHero());
    const withShield = runWave1(hero, play(P1, shield, payWith(hero, P1, 1, [shield, shieldBlock])));
    // The Shield has no printed `attachesTo`, so it auto-attaches to the identity (`actions.ts` `ownIdentity`
    // fallback) rather than landing in `playArea`, which holds only unattached in-play cards.
    expect(inst(withShield, shield).attachedTo).toBe(identityOf(withShield));
    expect(inst(withShield, shield).exhausted).toBe(false);

    // Advance as Rhino's boost card, Advance dealt to Cap (it schemes, dealing no damage), and Hard to Keep Down as that
    // scheme's 0-icon boost card (a boost card's When Revealed doesn't resolve). Otherwise a random dealt card (Shadow
    // of the Past, Assault, …) attacks again after Shield Block is spent. Core has only two Advances.
    const afterTurn = runWave1(stackEncounterDeck(withShield, ADVANCE, ADVANCE, HARD_TO_KEEP_DOWN), endTurn());
    const option = `${shieldBlock}:03005.shield-block-interrupt`;
    const after = settle(afterTurn, picking(option), undefined, WAVE1_DEPS);
    expect(inst(after, identityOf(after)).damage).toBe(0);
    expect(inst(after, shield).exhausted).toBe(true);
  });

  it("Shield Toss: discards X cards and returns the Shield to hand, dealing 4 damage to X enemies", () => {
    const start = capVsRhino();
    const shield = instancesOf(start, "03009")[0]!;
    const given = moveToHand(start, P1, "03006", "03015"); // Shield Toss, a spare card to discard as X = 1
    const [toss, spare] = given.ids as [never, never];
    const hero = runWave1(given.state, toHero());
    const withShield = runWave1(hero, play(P1, shield, payWith(hero, P1, 1, [shield, toss, spare])));
    const villain = activeVillain(withShield).instanceId;
    const hpBefore = remainingHitPoints(withShield, villain);
    expect(hpBefore).toBeDefined(); // the villain is in play with a defined hit point dial

    const midPlay = runWave1(withShield, play(P1, toss, [], { costChoices: { discard: [spare] } }));
    const after = settle(midPlay, undefined, undefined, WAVE1_DEPS);

    expect(remainingHitPoints(after, villain)).toBe(hpBefore! - 4);
    expect(playerOf(after, P1).hand).toContain(shield);
    expect(playerOf(after, P1).discard).toEqual(expect.arrayContaining([toss, spare]));
  });

  it("Captain America's Helmet: sets his hit point dial to 1 instead of defeating him, then discards", () => {
    const start = capVsRhino();
    const given = moveToHand(start, P1, "03008");
    const [helmet] = given.ids as [never];
    const hero = runWave1(given.state, toHero());
    const withHelmet = runWave1(hero, play(P1, helmet, payWith(hero, P1, 1, [helmet])));
    const identity = identityOf(withHelmet);
    const near = patchInstance(withHelmet, identity, { damage: 10 }); // 11 printed HP: any hit is lethal
    const afterTurn = runWave1(stackEncounterDeck(near, ADVANCE, ADVANCE, HARD_TO_KEEP_DOWN), endTurn()); // as in Shield Block: no second attack
    const option = `${helmet}:03008.captain-americas-helmet-interrupt`;
    const after = settle(afterTurn, picking(option), undefined, WAVE1_DEPS);
    expect(remainingHitPoints(after, identity)).toBe(1);
    // `GameState.outcome` is `GameOutcome | null` (packages/engine/src/state.ts), never `undefined` — the helmet
    // really did save him: the game is still running (`null`), not lost.
    expect(after.outcome).toBeNull();
    expect(playerOf(after, P1).discard).toContain(helmet);
  });

  it("Avengers Tower: ally limit is 4 only while every ally you control has the Avenger trait", () => {
    const start = capVsRhino();
    const given = moveToHand(start, P1, "03024"); // Avengers Tower
    const [tower] = given.ids as [never];
    const withTower = runWave1(given.state, play(P1, tower, payWith(given.state, P1, 2, [tower])));
    // Vacuously true with no allies at all.
    expect(allyLimitFor(withTower, WAVE1_DEPS, P1)).toBe(4);

    // Squirrel Girl (03013) is printed with the Avenger trait (`packages/content/src/data/cap/cards.ts`); Agent
    // 13 (03002) is S.H.I.E.L.D. only and is not an Avenger — the data is right and an earlier draft of this test
    // was wrong to treat her as one. A Response is an optional triggered ability (RRG "Response"), so entering
    // play leaves a `chooseTriggers` choice pending (whether to trigger it at all) even though the printed text
    // has no "you may" — settle it (declining is a legal answer) before the next command.
    const given2 = moveToHand(withTower, P1, "03013"); // Squirrel Girl (Avenger)
    const [squirrelGirl] = given2.ids as [never];
    const withAvengerAlly = settle(
      runWave1(given2.state, play(P1, squirrelGirl, payWith(given2.state, P1, 2, [squirrelGirl]))),
      firstLegal,
      undefined,
      WAVE1_DEPS,
    );
    expect(allyLimitFor(withAvengerAlly, WAVE1_DEPS, P1)).toBe(4);

    const given3 = moveToHand(withAvengerAlly, P1, "03020"); // Mockingbird — S.H.I.E.L.D. Spy, not Avenger
    const [mockingbird] = given3.ids as [never];
    const withNonAvenger = runWave1(given3.state, play(P1, mockingbird, payWith(given3.state, P1, 3, [mockingbird])));
    expect(allyLimitFor(withNonAvenger, WAVE1_DEPS, P1)).toBe(3);
  });

  it("Strength in Numbers: exhausts any number of allies you control and draws that many cards", () => {
    const start = capVsRhino();
    // Strength in Numbers, Agent 13, Falcon, plus 3 basic resource cards as guaranteed payment filler (the
    // opening hand alone is too small to pay for both a 3-cost and a 4-cost ally while excluding all 3 named
    // cards from the payment pool).
    const given = moveToHand(start, P1, "03017", "03002", "03011", "03021", "03022", "03023");
    const [strength, agent13, falcon] = given.ids as [never, never, never];
    // Only the 3 named cards are excluded from payment — the 3 resource-card filler (given.ids[3..5]) is exactly
    // what pays for Agent 13 and Falcon.
    const named = [strength, agent13, falcon];
    // Agent 13's and Falcon's Responses are optional triggered abilities (RRG "Response"): entering play leaves
    // a `chooseTriggers` choice pending even though the printed text has no "you may" — settle it after each play
    // (declining is a legal answer) before the next command.
    const withAgent13 = settle(
      runWave1(given.state, play(P1, agent13, payWith(given.state, P1, 3, named))),
      firstLegal,
      undefined,
      WAVE1_DEPS,
    );
    const withBoth = settle(
      runWave1(withAgent13, play(P1, falcon, payWith(withAgent13, P1, 4, named))),
      firstLegal,
      undefined,
      WAVE1_DEPS,
    );
    const handBefore = playerOf(withBoth, P1).hand.length;
    const after = runWave1(withBoth, play(P1, strength, [], { costChoices: { exhausted: [agent13, falcon] } }));
    expect(inst(after, agent13).exhausted).toBe(true);
    expect(inst(after, falcon).exhausted).toBe(true);
    // Strength in Numbers itself leaves the hand (-1), then 2 cards are drawn for the 2 allies exhausted (+2).
    expect(playerOf(after, P1).hand.length).toBe(handBefore - 1 + 2);
  });
});

describe("Man Out of Time (Captain America's obligation)", () => {
  it("offers the optional flip in hero form, then 'exhaust Steve Rogers → remove it from the game'", () => {
    // Man Out of Time (03026) is a `whenRevealed` obligation shuffled into the encounter deck at setup
    // (`packages/engine/src/setup.ts`), not a player-deck card — stack it on top the way an encounter card is
    // stacked, behind a neutral 0-icon boost card so the villain phase's boost draw doesn't consume it first
    // (same shape as `core/heroes/spider-man.test.ts`'s Eviction Notice test, same Rhino encounter pool).
    const start = stackEncounterDeck(capVsRhino(), ADVANCE, "03026");
    const atFlip = settleUntil(runWave1(start, toHero(), endTurn()), "chooseOption", firstLegal, WAVE1_DEPS);
    expect(atFlip.pendingChoice?.playerId).toBe(P1);
    expect(atFlip.pendingChoice?.options.map((o) => o.label)).toEqual(["Flip to alter-ego form", "Stay in hero form"]);
    const flipped = answer(atFlip, ["0"], WAVE1_DEPS);
    expect(playerOf(flipped, P1).identity.form).toBe("alterEgo");
    expect(flipped.pendingChoice?.options.map((o) => o.label)).toEqual([
      "Exhaust Steve Rogers → remove this obligation from the game",
      "Discard half of the cards in your hand, rounded down",
    ]);
    const removed = settle(answer(flipped, ["0"], WAVE1_DEPS), firstLegal, undefined, WAVE1_DEPS);
    const obligation = instancesOf(removed, "03026")[0];
    expect(removed.removedFromGame).toContain(obligation);
    expect(inst(removed, identityOf(removed)).exhausted).toBe(true);
  });

  it("the alternative discards half the hand, rounded down, and puts the obligation in the encounter discard", () => {
    const start = stackEncounterDeck(capVsRhino(), ADVANCE, "03026");
    const atChoice = settleUntil(runWave1(start, endTurn()), "chooseOption", firstLegal, WAVE1_DEPS); // alter-ego: no flip offer
    expect(atChoice.pendingChoice?.options).toHaveLength(2);
    const handBefore = playerOf(atChoice, P1).hand.length;
    const after = settle(answer(atChoice, ["1"], WAVE1_DEPS), firstLegal, undefined, WAVE1_DEPS);
    const obligation = instancesOf(after, "03026")[0]!;
    // The obligation is an encounter card (`home: { kind: "activeEncounterDeck" }`): "discard" sends it to the
    // active villain's encounter discard, not the player's own discard pile (same as
    // `core/heroes/spider-man.test.ts`'s Eviction Notice test).
    expect(activeEncounterDeck(after).discard).toContain(obligation);
    expect(playerOf(after, P1).hand.length).toBe(handBefore - Math.floor(handBefore / 2));
  });
});
