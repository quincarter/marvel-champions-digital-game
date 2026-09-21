import { activeVillain, applyCommand, remainingHitPoints, type InstanceId } from "@mc/engine";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  picking,
  play,
  playerOf,
  putOnTopOfDeck,
  settle,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { moveToDiscard } from "../../testing/staging.js";
import { wave1Scenario } from "../setup.js";
import { MSM_DEPS, runMsm, startMsmGame } from "./testing.js";

// Real wave 1 content: the Ms. Marvel (Protection) precon against Rhino, standard, solo.
const msmVsRhino = () =>
  startMsmGame(wave1Scenario("rhino", { players: [{ starterDeckId: "msm-protection" }], seed: 7 }));

/**
 * A picker that never discards `protect` at a "discard down to hand size" check (end-of-turn hand size, hero 5 /
 * alter-ego 6, can otherwise arbitrarily claim the very card a test is about to use), and otherwise selects
 * `triggerOption` whenever a `chooseTriggers` prompt offers it, else defers to `firstLegal`.
 */
const protecting =
  (protect: readonly InstanceId[], triggerOption?: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "discardDownToHandSize") {
      const safe = choice.options.map((o) => o.optionId).filter((id) => !protect.includes(id as InstanceId));
      return safe.slice(0, choice.minSelections);
    }
    if (triggerOption && choice.prompt.kind === "chooseTriggers") return picking(triggerOption)(state);
    return firstLegal(state);
  };

describe("Ms. Marvel kit", () => {
  it('"Morphogenetics": exhausts Ms. Marvel to return a just-played Attack event to hand', () => {
    const start = msmVsRhino();
    const given = moveToHand(start, P1, "05003"); // Big Hands (Attack, Superpower)
    const [bigHands] = given.ids as [never];
    const hero = runMsm(given.state, toHero());
    const identity = identityOf(hero);
    const villain = activeVillain(hero).instanceId;
    const hpBefore = remainingHitPoints(hero, villain);
    const option = `${identity}:05001a.morphogenetics`;
    const played = runMsm(hero, play(P1, bigHands, payWith(hero, P1, 2, [bigHands])));
    // The Response fires from `cardPlayed` (after the event has already resolved and been discarded), so the
    // damage lands first and the "return to hand" undoes the discard afterward, not the play.
    const after = settle(played, protecting([bigHands], option), undefined, MSM_DEPS);
    expect(remainingHitPoints(after, villain)).toBe(hpBefore! - 4);
    expect(playerOf(after, P1).hand).toContain(bigHands);
    expect(playerOf(after, P1).discard).not.toContain(bigHands);
    expect(inst(after, identity).exhausted).toBe(true);
  });

  it('"Teen Spirit": discards down to the first Ms. Marvel card and only that one goes to hand', () => {
    const start = msmVsRhino();
    // Nova (05012, protection ally) and Energy (05019, basic resource) print no [Ms. Marvel] set icon, so neither
    // is "a Ms. Marvel card" even though both are real cards from her own precon; Red Dagger (05002, aspect
    // "hero:05001a") is her signature ally and is the one the search should stop on.
    const stacked = putOnTopOfDeck(start, P1, "05012", "05019", "05002");
    const [nova, energy, redDagger] = stacked.ids as [InstanceId, InstanceId, InstanceId];
    const deckBefore = playerOf(stacked.state, P1).deck;
    const identity = identityOf(stacked.state);
    const after = runMsm(stacked.state, use(P1, identity, "05001b.teen-spirit"));
    expect(playerOf(after, P1).hand).toContain(redDagger);
    expect(playerOf(after, P1).discard).toEqual(expect.arrayContaining([nova, energy]));
    expect(playerOf(after, P1).discard).not.toContain(redDagger);
    // The search stops at the match: everything under it is still untouched, at the top of the deck.
    expect(playerOf(after, P1).deck).toEqual(deckBefore.slice(3));
  });

  it('"Teen Spirit": limit once per round', () => {
    const start = msmVsRhino();
    const stacked = putOnTopOfDeck(start, P1, "05002");
    const [redDagger] = stacked.ids as [InstanceId];
    const identity = identityOf(stacked.state);
    const after = runMsm(stacked.state, use(P1, identity, "05001b.teen-spirit"));
    expect(playerOf(after, P1).hand).toContain(redDagger);
    // Put another signature card back on top and try again the same round: rejected by "Limit once per round."
    const given = putOnTopOfDeck(after, P1, "05003");
    const rejected = applyCommand(given.state, use(P1, identity, "05001b.teen-spirit"), MSM_DEPS);
    expect(rejected.ok).toBe(false);
  });

  it('"Teen Spirit": an Alter-Ego action, illegal in hero form', () => {
    const start = msmVsRhino();
    const hero = runMsm(start, toHero());
    const identity = identityOf(hero);
    const rejected = applyCommand(hero, use(P1, identity, "05001b.teen-spirit"), MSM_DEPS);
    expect(rejected.ok).toBe(false);
  });

  it('"Teen Spirit": stops when the deck empties mid-discard, never reaching a match already in the discard pile', () => {
    const start = msmVsRhino();
    // Every other copy of a Ms. Marvel signature card (the "msm-protection" starter runs more than one copy of
    // Big Hands/Sneak By/Wiggle Room) moves out of the deck's way into hand...
    const cleared = moveToHand(
      start,
      P1,
      "05003",
      "05003",
      "05003",
      "05004",
      "05004",
      "05004",
      "05005",
      "05005",
      "05006",
      "05007",
      "05008",
      "05009",
      "05010",
      "05011",
    ).state;
    // ...and the one remaining match (Red Dagger) sits in the discard pile the whole time, never reachable this way
    // once the (now matchless) deck runs out (RRG 1.8 "Player Deck", p. 33).
    const { state: withDiscard, id: redDagger } = moveToDiscard(cleared, P1, "05002");
    const identity = identityOf(withDiscard);
    const after = runMsm(withDiscard, use(P1, identity, "05001b.teen-spirit"));
    expect(playerOf(after, P1).hand).not.toContain(redDagger);
    expect(playerOf(after, P1).discard).toContain(redDagger);
    expect(playerOf(after, P1).deck).toEqual([]);
  });

  it("Red Dagger: an Interrupt that replaces his own defeat, paid with 2 resources of different types", () => {
    const start = msmVsRhino();
    // Red Dagger, 3 single-icon cards to pay his own cost (energy/mental/mental filler), and Big Hands (physical)
    // + Sneak By (mental) held back as the two-different-types payment for his own interrupt.
    const given = moveToHand(start, P1, "05002", "05005", "05009", "05006", "05003", "05004");
    const [redDagger, wiggleRoom, biokinetic, aamir, bigHands, sneakBy] = given.ids as [
      never,
      never,
      never,
      never,
      never,
      never,
    ];
    const hero = runMsm(given.state, toHero());
    const withDagger = runMsm(hero, play(P1, redDagger, payWith(hero, P1, 3, [redDagger, bigHands, sneakBy])));
    expect(playerOf(withDagger, P1).playArea).toContain(redDagger);
    // 2 of his printed 3 hit points already lost: any positive attack damage this way is lethal.
    const near = patchInstance(withDagger, redDagger, { damage: 2 });

    const option = `${redDagger}:05002.red-dagger-interrupt`;
    const atDeclare = settle(
      runMsm(near, endTurn()),
      protecting([redDagger, bigHands, sneakBy]),
      (s) => s.pendingChoice?.prompt.kind === "declareDefender",
      MSM_DEPS,
    );
    const declared = answer(atDeclare, [redDagger], MSM_DEPS);
    const villain = activeVillain(declared).instanceId;
    const hpBefore = remainingHitPoints(declared, villain);

    const after = settle(
      declared,
      (s) => {
        const prompt = s.pendingChoice?.prompt;
        if (!prompt) return [];
        if (prompt.kind === "chooseTriggers") return picking(option)(s);
        if (prompt.kind === "payForAbility" && prompt.instanceId === redDagger)
          return [`hand:${bigHands}`, `hand:${sneakBy}`];
        return protecting([redDagger, bigHands, sneakBy])(s);
      },
      undefined,
      MSM_DEPS,
    );

    // Red Dagger is never defeated: his defeat was replaced, so he leaves play into his controller's hand instead
    // of the discard pile (the same "interrupt + instead" shape as Clea/Captain America's Helmet).
    expect(playerOf(after, P1).hand).toContain(redDagger);
    expect(playerOf(after, P1).discard).not.toContain(redDagger);
    expect(remainingHitPoints(after, villain)).toBe(hpBefore! - 2);
    expect(playerOf(after, P1).discard).toEqual(expect.arrayContaining([bigHands, sneakBy]));
    void wiggleRoom;
    void biokinetic;
    void aamir;
  });

  it("Big Hands: Hero Action (attack) deals 4 damage to an enemy", () => {
    const start = msmVsRhino();
    const given = moveToHand(start, P1, "05003");
    const [bigHands] = given.ids as [never];
    const hero = runMsm(given.state, toHero());
    const villain = activeVillain(hero).instanceId;
    const hpBefore = remainingHitPoints(hero, villain);
    const played = runMsm(hero, play(P1, bigHands, payWith(hero, P1, 2, [bigHands])));
    const after = settle(played, firstLegal, undefined, MSM_DEPS);
    expect(remainingHitPoints(after, villain)).toBe(hpBefore! - 4);
    expect(playerOf(after, P1).discard).toContain(bigHands);
  });

  it("Sneak By: Hero Action (thwart) removes 3 threat from a scheme", () => {
    const start = msmVsRhino();
    const given = moveToHand(start, P1, "05004");
    const [sneakBy] = given.ids as [never];
    const hero = runMsm(given.state, toHero());
    const mainSchemeThreatBefore = inst(hero, hero.mainScheme.instanceId).threat;
    const played = runMsm(hero, play(P1, sneakBy, payWith(hero, P1, 2, [sneakBy])));
    const after = settle(played, firstLegal, undefined, MSM_DEPS);
    expect(inst(after, after.mainScheme.instanceId).threat).toBe(Math.max(0, mainSchemeThreatBefore - 3));
  });

  it("Wiggle Room: prevents 3 of an attack's damage and draws 1 card", () => {
    const start = msmVsRhino();
    const given = moveToHand(start, P1, "05005"); // cost 0
    const [wiggleRoom] = given.ids as [never];
    const hero = runMsm(given.state, toHero());
    const option = `${wiggleRoom}:05005.wiggle-room-interrupt`;
    // Deck size, not hand size: the end-of-turn "discard down to hand size" step (unrelated to Wiggle Room) can
    // also fire here depending on hand composition, which would make a hand-length delta noisy. The deck only
    // moves for the "draw 1 card" part of Wiggle Room's own text.
    const deckBefore = playerOf(hero, P1).deck.length;
    const after = settle(runMsm(hero, endTurn()), protecting([wiggleRoom], option), undefined, MSM_DEPS);
    // Rhino's attack this early deals 4 (ATK 2 plus a boost); prevent(3) leaves exactly 1, proving the prevention
    // fired rather than being skipped outright (0 would be indistinguishable from "no attack happened at all").
    expect(inst(after, identityOf(after)).damage).toBe(1);
    expect(playerOf(after, P1).discard).toContain(wiggleRoom);
    expect(playerOf(after, P1).deck.length).toBe(deckBefore - 1);
  });

  it("Aamir Khan: bottoms a discarded card and draws 1", () => {
    const start = msmVsRhino();
    const given = moveToHand(start, P1, "05006"); // Aamir Khan, cost 1 mental — no hero-form play restriction
    const [aamir] = given.ids as [never];
    const withAamir = settle(
      runMsm(given.state, play(P1, aamir, payWith(given.state, P1, 1, [aamir]))),
      firstLegal,
      undefined,
      MSM_DEPS,
    );
    expect(playerOf(withAamir, P1).playArea).toContain(aamir);
    const { state: withDiscard, id: bigHands } = moveToDiscard(withAamir, P1, "05003");
    const deckSizeBefore = playerOf(withDiscard, P1).deck.length;
    const handBefore = playerOf(withDiscard, P1).hand.length;
    // "Place 1 card from your discard pile on the bottom of your deck" is a mid-ability `chooseCards`, not a cost —
    // it settles as its own pending choice after the command. Big Hands isn't the only discard-pile candidate (the
    // 1-resource cost of playing Aamir Khan itself discarded a payment card too), so pick it explicitly.
    const after = settle(
      runMsm(withDiscard, use(P1, aamir, "05006.aamir-khan-action")),
      picking(bigHands),
      undefined,
      MSM_DEPS,
    );
    expect(playerOf(after, P1).deck[playerOf(after, P1).deck.length - 1]).toBe(bigHands);
    expect(playerOf(after, P1).deck.length).toBe(deckSizeBefore); // placed to bottom (+1), then 1 drawn (-1)
    expect(playerOf(after, P1).hand.length).toBe(handBefore + 1); // Aamir Khan is exhausted, not discarded; +1 drawn
    expect(inst(after, aamir).exhausted).toBe(true);
  });

  it("Bruno Carrelli: attaches a hand card facedown, then returns up to 3 attached cards to hand", () => {
    const start = msmVsRhino();
    const given = moveToHand(start, P1, "05007", "05003"); // Bruno Carrelli (cost 1 physical), Big Hands to attach
    const [bruno, bigHands] = given.ids as [never, never];
    const withBruno = settle(
      runMsm(given.state, play(P1, bruno, payWith(given.state, P1, 1, [bruno, bigHands]))),
      firstLegal,
      undefined,
      MSM_DEPS,
    );
    const handBefore = playerOf(withBruno, P1).hand.length;
    // "Attach 1 card from your hand facedown here" is a mid-ability `chooseCards` over the whole hand (several
    // candidates), so it settles as a pending choice — explicitly pick Big Hands, not whatever `firstLegal` would.
    const attached = settle(
      runMsm(withBruno, use(P1, bruno, "05007.bruno-carrelli-action")),
      picking(bigHands),
      undefined,
      MSM_DEPS,
    );
    expect(inst(attached, bigHands).attachedTo).toBe(bruno);
    expect(inst(attached, bigHands).faceup).toBe(false);
    expect(playerOf(attached, P1).hand.length).toBe(handBefore - 1);
    // Bruno is exhausted by the first ability's cost; ready him again with test surgery to use the second.
    const ready = patchInstance(attached, bruno, { exhausted: false });
    const before2 = playerOf(ready, P1).hand.length;
    // "Add up to 3 cards attached here to your hand" allows 0 (min 0); explicitly pick the 1 available so the test
    // proves the return, not `firstLegal`'s minimal (decline-everything) answer.
    const returned = settle(
      runMsm(ready, use(P1, bruno, "05007.bruno-carrelli-action-2")),
      picking(bigHands),
      undefined,
      MSM_DEPS,
    );
    expect(playerOf(returned, P1).hand).toContain(bigHands);
    expect(playerOf(returned, P1).hand.length).toBe(before2 + 1);
    expect(inst(returned, bigHands).faceup).toBe(true);
  });

  it("Nakia Bahadir: reduces the cost of the next card played this phase by 1", () => {
    const start = msmVsRhino();
    const given = moveToHand(start, P1, "05008", "05003"); // Nakia Bahadir (cost 1 energy), Big Hands (printed cost 2)
    const [nakia, bigHands] = given.ids as [never, never];
    const withNakia = settle(
      runMsm(given.state, play(P1, nakia, payWith(given.state, P1, 1, [nakia, bigHands]))),
      firstLegal,
      undefined,
      MSM_DEPS,
    );
    const withDiscount = runMsm(withNakia, use(P1, nakia, "05008.nakia-bahadir-action"));
    expect(inst(withDiscount, nakia).exhausted).toBe(true);
    const hero = runMsm(withDiscount, toHero());
    const villain = activeVillain(hero).instanceId;
    const hpBefore = remainingHitPoints(hero, villain);
    // Big Hands is printed cost 2; paying only 1 succeeds because of the discount (an underpaid `playCard` command
    // is rejected outright, so a successful play here is itself proof the reduction applied).
    const after = settle(
      runMsm(hero, play(P1, bigHands, payWith(hero, P1, 1, [bigHands]))),
      firstLegal,
      undefined,
      MSM_DEPS,
    );
    expect(playerOf(after, P1).discard).toContain(bigHands);
    expect(remainingHitPoints(after, villain)).toBe(hpBefore! - 4);
  });

  it("Biokinetic Polymer Suit: generates a wild resource usable only for an event", () => {
    const start = msmVsRhino();
    const given = moveToHand(start, P1, "05009", "05003");
    const [suit, bigHands] = given.ids as [never, never];
    const hero = runMsm(given.state, toHero());
    const withSuit = runMsm(hero, play(P1, suit, payWith(hero, P1, 1, [suit, bigHands])));
    const villain = activeVillain(withSuit).instanceId;
    const hpBefore = remainingHitPoints(withSuit, villain);
    // Pay Big Hands' printed cost of 2 with the Suit's generated resource (an ability payment) plus 1 hand card.
    const after = settle(
      runMsm(
        withSuit,
        play(P1, bigHands, payWith(withSuit, P1, 1, [suit, bigHands]), {
          abilities: [{ ability: { instanceId: suit, abilityId: "05009.biokinetic-polymer-suit-resource" as never } }],
        }),
      ),
      firstLegal,
      undefined,
      MSM_DEPS,
    );
    expect(remainingHitPoints(after, villain)).toBe(hpBefore! - 4);
    expect(inst(after, suit).exhausted).toBe(true);
  });

  it("Embiggen!: increases an Attack event's damage by 2 while exhausted", () => {
    const start = msmVsRhino();
    const given = moveToHand(start, P1, "05010", "05003"); // Embiggen!, Big Hands
    const [embiggen, bigHands] = given.ids as [never, never];
    const hero = runMsm(given.state, toHero());
    const withEmbiggen = settle(
      runMsm(hero, play(P1, embiggen, payWith(hero, P1, 2, [embiggen, bigHands]))),
      firstLegal,
      undefined,
      MSM_DEPS,
    );
    const villain = activeVillain(withEmbiggen).instanceId;
    const hpBefore = remainingHitPoints(withEmbiggen, villain);
    const option = `${embiggen}:05010.embiggen-interrupt`;
    const midPlay = runMsm(withEmbiggen, play(P1, bigHands, payWith(withEmbiggen, P1, 2, [embiggen, bigHands])));
    const after = settle(midPlay, protecting([embiggen, bigHands], option), undefined, MSM_DEPS);
    expect(remainingHitPoints(after, villain)).toBe(hpBefore! - 6); // printed 4 damage + Embiggen!'s +2
    expect(inst(after, embiggen).exhausted).toBe(true);
  });

  it("Shrink: increases the threat a Thwart event removes by 2", () => {
    const start = msmVsRhino();
    const given = moveToHand(start, P1, "05011", "05004");
    const [shrink, sneakBy] = given.ids as [never, never];
    const hero = runMsm(given.state, toHero());
    const withShrink = runMsm(hero, play(P1, shrink, payWith(hero, P1, 2, [shrink, sneakBy])));
    const threatBefore = inst(withShrink, withShrink.mainScheme.instanceId).threat;
    const option = `${shrink}:05011.shrink-interrupt`;
    const midPlay = runMsm(withShrink, play(P1, sneakBy, payWith(withShrink, P1, 2, [shrink, sneakBy])));
    const after = settle(midPlay, protecting([shrink, sneakBy], option), undefined, MSM_DEPS);
    expect(inst(after, after.mainScheme.instanceId).threat).toBe(Math.max(0, threatBefore - 5));
    expect(inst(after, shrink).exhausted).toBe(true);
  });
});
