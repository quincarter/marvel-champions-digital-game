import { applyCommand, handSize, legalActions, playCostOf, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  picking,
  play,
  run,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { WAVE5_DEPS } from "../../index.js";
import { startWave5Game } from "../../testing.js";
import { ghostSpiderScenario, ghostSpiderScenarioWithExtras } from "./support.js";

const ghostSpiderVsRhino = (seed = 1) => startWave5Game(ghostSpiderScenario("rhino", { seed }));

/** Accepts the named optional Interrupt/Response/target option; declines everything else. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

/** Plays `code` (already the player's hand) from `state`, paying `cost` other hand cards, resolving prompts with `pick`. */
function playFromHandHelper(
  state: Parameters<typeof run>[0],
  code: string,
  cost: number,
  pick: Picker = firstLegal,
): { readonly state: ReturnType<typeof run>; readonly id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  const played = settle(
    runWith(WAVE5_DEPS, given.state, play(P1, id, payWith(given.state, P1, cost, given.ids))),
    pick,
    undefined,
    WAVE5_DEPS,
  );
  return { state: played, id };
}

describe("George Stacy (support, 27007)", () => {
  it("27007.george-stacy-action: attaches a hand event facedown to George Stacy (to a maximum of 3)", () => {
    const { state: withStacy, id: stacy } = playFromHandHelper(ghostSpiderVsRhino(1), "27007", 1);
    const given = moveToHand(withStacy, P1, "27013"); // Bait and Switch, an event.
    const [baitAndSwitch] = given.ids as [InstanceId];
    const after = settle(
      runWith(WAVE5_DEPS, given.state, use(P1, stacy, "27007.george-stacy-action")),
      picking(baitAndSwitch),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, stacy).attachments).toContain(baitAndSwitch);
    expect(inst(after, baitAndSwitch).facedownAs).toBeTruthy();
  });

  it("27007.george-stacy-action: a fourth facedown attachment is refused past the maximum of 3", () => {
    const { state: withStacy, id: stacy } = playFromHandHelper(ghostSpiderVsRhino(2), "27007", 1);
    const given = moveToHand(withStacy, P1, "27013", "27013", "27013", "27014");
    const [e1, e2, e3, e4] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    let s = given.state;
    for (const event of [e1, e2, e3]) {
      s = patchInstance(s, stacy, { exhausted: false });
      s = settle(
        runWith(WAVE5_DEPS, s, use(P1, stacy, "27007.george-stacy-action")),
        picking(event),
        undefined,
        WAVE5_DEPS,
      );
    }
    expect(inst(s, stacy).attachments).toHaveLength(3);
    const ready = patchInstance(s, stacy, { exhausted: false });
    const after = settle(
      runWith(WAVE5_DEPS, ready, use(P1, stacy, "27007.george-stacy-action")),
      picking(e4),
      undefined,
      WAVE5_DEPS,
    );
    // The `ifThen` gate is already false at 3 attachments: the ability resolves (George Stacy still exhausts) but
    // the fourth event never gets a chance to attach.
    expect(inst(after, stacy).attachments).toHaveLength(3);
    expect(inst(after, stacy).attachments).not.toContain(e4);
  });

  it("27007.george-stacy-constant: an event attached facedown may be played as if it were in hand", () => {
    const hero = run(ghostSpiderVsRhino(3), toHero(P1)); // Bait and Switch is a Hero Action (thwart).
    const { state: withStacy, id: stacy } = playFromHandHelper(hero, "27007", 1);
    const given = moveToHand(withStacy, P1, "27013"); // Bait and Switch, cost 1.
    const [baitAndSwitch] = given.ids as [InstanceId];
    const attached = settle(
      runWith(WAVE5_DEPS, given.state, use(P1, stacy, "27007.george-stacy-action")),
      picking(baitAndSwitch),
      undefined,
      WAVE5_DEPS,
    );
    const before = mainThreat(attached);
    const resolved = settle(
      runWith(WAVE5_DEPS, attached, play(P1, baitAndSwitch, payWith(attached, P1, 1, [baitAndSwitch]))),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(mainThreat(resolved)).toBeLessThanOrEqual(before); // "Remove 4 threat from the main scheme."
    expect(inst(resolved, baitAndSwitch).facedownAs).toBeFalsy(); // turned faceup as it was played, per §3.15.
  });
});

describe("Ticket to the Multiverse (upgrade, 27008)", () => {
  it("27008.ticket-to-the-multiverse-action: discards the hand, shuffles it back, draws up and readies Ghost-Spider", () => {
    const hero = run(ghostSpiderVsRhino(1), toHero(P1));
    const { state: withTicket, id: ticket } = playFromHandHelper(hero, "27008", 3);
    const identity = identityOf(withTicket, P1);
    const exhausted = patchInstance(withTicket, identity, { exhausted: true });
    const after = settle(
      runWith(WAVE5_DEPS, exhausted, use(P1, ticket, "27008.ticket-to-the-multiverse-action")),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(after.players[0]!.hand.length).toBe(handSize(after, P1, WAVE5_DEPS));
    // Ticket itself is removed from the game entirely (not in hand, deck or discard).
    expect(after.players[0]!.deck).not.toContain(ticket);
    expect(after.players[0]!.discard).not.toContain(ticket);
    expect(after.players[0]!.hand).not.toContain(ticket);
    expect(inst(after, identity).exhausted).toBe(false); // "Ready each Ghost-Spider card you control."
  });
});

describe("Web-Bracelet (upgrade, 27009)", () => {
  it("27009.web-bracelet-response: draws a card after an Interrupt/Response on an event resolves (max 1 per event)", () => {
    // Backflip (01003, Spider-Man's own 0-cost Interrupt (defense) event) isn't in Ghost-Spider's own precon
    // (her signature events are `events-a.ts`); added as an extra, legality off, purely to give her hand *some*
    // real Interrupt-on-an-event ability to resolve — the same test-only relaxation `identity.test.ts` uses.
    const state = startWave5Game(ghostSpiderScenarioWithExtras("rhino", { seed: 1, extraCodes: ["01003"] }));
    const { state: withBracelet, id: bracelet } = playFromHandHelper(state, "27009", 2);
    const stacked = stackEncounterDeck(withBracelet, "01186", "01101");
    const given = moveToHand(stacked, P1, "01003");
    const [backflip] = given.ids as [InstanceId];
    const identity = identityOf(given.state, P1);
    const exhaustedIdentity = patchInstance(run(given.state, toHero(P1)), identity, { exhausted: true });
    const beforeHand = exhaustedIdentity.players[0]!.hand.length;
    const option = `${backflip}:01003.backflip-interrupt`;
    const after = settle(
      runWith(WAVE5_DEPS, exhaustedIdentity, endTurn(P1)),
      (s) => {
        const prompt = s.pendingChoice?.prompt;
        if (prompt?.kind === "payForCard" && prompt.instanceId === backflip) return []; // Backflip costs 0.
        return accepting(option, "27009.web-bracelet-response")(s);
      },
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, bracelet).exhausted).toBe(true); // Web-Bracelet's own exhaust cost.
    expect(after.players[0]!.hand.length).toBe(beforeHand - 1 /* Backflip left the hand */ + 1); /* Web-Bracelet drew */
  });
});

describe("Silk (ally, 27010)", () => {
  it("27010.silk-response: searches the encounter deck for a treachery and discards it, while you control another Web-Warrior card", () => {
    const hero = run(ghostSpiderVsRhino(1), toHero(P1)); // Ghost-Spider herself is a Web-Warrior card in hero form.
    const beforeDeck = hero.encounterDecks[Object.keys(hero.encounterDecks)[0]!]!.deck.length;
    const { state: after } = playFromHandHelper(hero, "27010", 2, accepting("27010.silk-response"));
    const deck = after.encounterDecks[Object.keys(after.encounterDecks)[0]!]!;
    expect(deck.deck.length).toBe(beforeDeck - 1);
    expect(deck.discard.length).toBeGreaterThan(0);
  });

  it("27010.silk-response: does nothing without another Web-Warrior card in play (Gwen Stacy, alter-ego, is not one)", () => {
    const state = ghostSpiderVsRhino(2); // Starts in alter-ego (Gwen Stacy, CIVILIAN trait).
    const beforeDeckId = Object.keys(state.encounterDecks)[0]!;
    const beforeDeck = state.encounterDecks[beforeDeckId]!.deck.length;
    const { state: after } = playFromHandHelper(state, "27010", 2, accepting("27010.silk-response"));
    const deck = after.encounterDecks[Object.keys(after.encounterDecks)[0]!]!;
    expect(deck.deck.length).toBe(beforeDeck); // No search happened: the `if` condition was false.
  });
});

describe("Spider-Man / Miles Morales (ally, 27011)", () => {
  it("27011.spider-man-response: stuns and confuses an enemy with 3+ Web-Warrior cards controlled (himself included)", () => {
    const hero = run(ghostSpiderVsRhino(1), toHero(P1)); // 1: the identity.
    const { state: withSilk } = playFromHandHelper(hero, "27010", 2, accepting("27010.silk-response")); // 2: Silk.
    const villain = withSilk.villains[0]!.instanceId;
    const { state: after } = playFromHandHelper(withSilk, "27011", 4, accepting("27011.spider-man-response", villain)); // 3: Miles himself, already in play when his own response checks the count.
    expect(inst(after, villain).statuses.stunned).toBeGreaterThan(0);
    expect(inst(after, villain).statuses.confused).toBeGreaterThan(0);
  });

  it("27011.spider-man-response: does nothing with fewer than 3 Web-Warrior cards controlled", () => {
    const state = ghostSpiderVsRhino(2); // Alter-ego identity (not a Web-Warrior card) + Miles alone = 1.
    const villain = state.villains[0]!.instanceId;
    const { state: after } = playFromHandHelper(state, "27011", 4, accepting("27011.spider-man-response", villain));
    expect(inst(after, villain).statuses.stunned).toBe(0);
    expect(inst(after, villain).statuses.confused).toBe(0);
  });
});

describe("Spider-UK (ally, 27012)", () => {
  it("27012.spider-uk-interrupt: deals damage to the attacking enemy equal to the number of Web-Warrior cards controlled", () => {
    const hero = run(ghostSpiderVsRhino(1), toHero(P1)); // 1: the identity.
    const { state: withSpiderUk, id: spiderUk } = playFromHandHelper(hero, "27012", 3); // 2: Spider-UK himself.
    const villain = withSpiderUk.villains[0]!.instanceId;
    const before = inst(withSpiderUk, villain).damage;
    const stacked = stackEncounterDeck(withSpiderUk, "01186"); // Advance, filler for Rhino's own boost draw.
    const reached = settle(
      runWith(WAVE5_DEPS, stacked, endTurn(P1)),
      firstLegal,
      (s) => s.pendingChoice?.prompt.kind === "declareDefender",
      WAVE5_DEPS,
    );
    const defending = answer(reached, [spiderUk], WAVE5_DEPS);
    const after = settle(defending, accepting("27012.spider-uk-interrupt"), undefined, WAVE5_DEPS);
    expect(inst(after, villain).damage).toBe(before + 2); // The identity + Spider-UK: 2 Web-Warrior cards.
  });
});

describe("Spider-Man / Hobie Brown (ally, 27017)", () => {
  it("27017.spider-man-constant: cannot be played, or offered, without a Web-Warrior card in play", () => {
    const state = ghostSpiderVsRhino(1); // Alter-ego identity: not a Web-Warrior card.
    const given = moveToHand(state, P1, "27017");
    const [id] = given.ids as [InstanceId];
    const result = applyCommand(
      given.state,
      { type: "playCard", playerId: P1, cardInstanceId: id, payment: [], attachToInstanceId: null },
      WAVE5_DEPS,
    );
    expect(result.ok).toBe(false);
    const actions = legalActions(given.state, P1, WAVE5_DEPS);
    if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
    expect(actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id)).toBe(false);
  });

  it("27017.spider-man-constant: is offered and plays normally with a Web-Warrior card in play (the identity, in hero form)", () => {
    const hero = run(ghostSpiderVsRhino(2), toHero(P1));
    const given = moveToHand(hero, P1, "27017");
    const [id] = given.ids as [InstanceId];
    const actions = legalActions(given.state, P1, WAVE5_DEPS);
    if (actions.kind !== "turn") throw new Error(`expected a turn, got ${actions.kind}`);
    expect(actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === id)).toBe(true);
  });

  it("27017.spider-man-interrupt: when Spider-Man leaves play, discards the top 3 encounter cards", () => {
    const hero = run(ghostSpiderVsRhino(3), toHero(P1));
    const { state: withHobie, id: hobie } = playFromHandHelper(hero, "27017", 3);
    const deckId = Object.keys(withHobie.encounterDecks)[0]!;
    const base = patchInstance(
      stackEncounterDeck(withHobie, "01186", "01100", "01101", "01104"),
      hobie,
      { damage: 2 }, // hp 3: one more point of damage is lethal.
    );
    const toDeclareDefender = (state: typeof base) =>
      answer(
        settle(
          runWith(WAVE5_DEPS, state, endTurn(P1)),
          firstLegal,
          (s) => s.pendingChoice?.prompt.kind === "declareDefender",
          WAVE5_DEPS,
        ),
        [hobie],
        WAVE5_DEPS,
      );
    // Run the identical combat twice from the same starting state — once declining the interrupt, once accepting
    // it — since the villain phase's own boost draw and discards would otherwise pollute a plain before/after
    // discard-pile diff (the same trap `27023`'s own test above avoids for hand size).
    const declined = settle(toDeclareDefender(base), firstLegal, undefined, WAVE5_DEPS);
    const accepted = settle(toDeclareDefender(base), accepting("27017.spider-man-interrupt"), undefined, WAVE5_DEPS);
    const declinedDiscard = new Set(declined.encounterDecks[deckId]!.discard);
    const newlyDiscarded = accepted.encounterDecks[deckId]!.discard.filter((id) => !declinedDiscard.has(id));
    expect(newlyDiscarded).toHaveLength(3); // Spider-Man's own effect: "discard the top 3 cards".
  });

  // A 3-card discard summed across every card: 01100 (2 boost), 01101 (1), 01104 (0) deal 3. `boostIconsOn` once read
  // only the first card of a multi-card ref (docs/phase7-wave5.md §4.1 Q56, fixed in 79634d1f).
  it("27017.spider-man-interrupt: deals damage to the villain equal to the number of boost icons discarded this way (engine fix: docs/phase7-wave5.md §4.1 Q56)", () => {
    const hero = run(ghostSpiderVsRhino(4), toHero(P1));
    const { state: withHobie, id: hobie } = playFromHandHelper(hero, "27017", 3);
    const villain = withHobie.villains[0]!.instanceId;
    const base = patchInstance(stackEncounterDeck(withHobie, "01186", "01100", "01101", "01104"), hobie, { damage: 2 });
    const toDeclareDefender = (state: typeof base) =>
      answer(
        settle(
          runWith(WAVE5_DEPS, state, endTurn(P1)),
          firstLegal,
          (s) => s.pendingChoice?.prompt.kind === "declareDefender",
          WAVE5_DEPS,
        ),
        [hobie],
        WAVE5_DEPS,
      );
    const declined = settle(toDeclareDefender(base), firstLegal, undefined, WAVE5_DEPS);
    const accepted = settle(toDeclareDefender(base), accepting("27017.spider-man-interrupt"), undefined, WAVE5_DEPS);
    // Printed sum of the 3 stacked cards' boost icons (2 + 1 + 0 = 3).
    expect(inst(accepted, villain).damage).toBe(inst(declined, villain).damage + 3);
  });
});

describe("Web of Life and Destiny (support, 27023)", () => {
  it("27023.web-of-life-and-destiny-constant: costs nothing while your identity has the Web-Warrior trait", () => {
    const state = ghostSpiderVsRhino(1);
    const given = moveToHand(state, P1, "27023");
    const [id] = given.ids as [InstanceId];
    expect(playCostOf(given.state, P1, id, WAVE5_DEPS)?.current).toBe(3); // Alter-ego: no discount.
    const hero = run(given.state, toHero(P1));
    expect(playCostOf(hero, P1, id, WAVE5_DEPS)?.current).toBe(0); // Hero form: Web-Warrior trait, fully ignored.
  });

  it("27023.web-of-life-and-destiny-response: after a Web-Warrior ally leaves play, a chosen player draws 1 card", () => {
    const hero = run(ghostSpiderVsRhino(2), toHero(P1));
    const { state: withSupport } = playFromHandHelper(hero, "27023", 0);
    const { state: withSilk, id: silk } = playFromHandHelper(withSupport, "27010", 2, accepting("27010.silk-response"));
    const stacked = stackEncounterDeck(withSilk, "01186"); // filler for Rhino's own boost draw.
    const base = patchInstance(stacked, silk, { damage: 1 }); // hp 2: one more point of damage is lethal.
    const toDeclareDefender = (state: typeof base) =>
      answer(
        settle(
          runWith(WAVE5_DEPS, state, endTurn(P1)),
          firstLegal,
          (s) => s.pendingChoice?.prompt.kind === "declareDefender",
          WAVE5_DEPS,
        ),
        [silk],
        WAVE5_DEPS,
      );
    // Run the identical combat twice from the same starting state — once declining the response, once accepting
    // it — and compare the final hand sizes, since the same villain phase also deals each player an unrelated
    // encounter card later on, which a single "before combat vs. after the whole phase" comparison can't tell
    // apart from the response's own draw.
    const declined = settle(toDeclareDefender(base), firstLegal, undefined, WAVE5_DEPS);
    const accepted = settle(
      toDeclareDefender(base),
      accepting("27023.web-of-life-and-destiny-response", P1),
      undefined,
      WAVE5_DEPS,
    );
    expect(accepted.players[0]!.hand.length).toBe(declined.players[0]!.hand.length + 1);
  });
});

describe("Plan B (upgrade, 27024)", () => {
  it("27024.plan-b-action: exhausts Plan B and discards a random hand card to deal 2 damage to an enemy", () => {
    const state = run(ghostSpiderVsRhino(1), toHero(P1)); // "Hero Action".
    const { state: withPlanB, id: planB } = playFromHandHelper(state, "27024", 1);
    const villain = withPlanB.villains[0]!.instanceId;
    const before = inst(withPlanB, villain).damage;
    const beforeHand = withPlanB.players[0]!.hand.length;
    const after = settle(
      runWith(WAVE5_DEPS, withPlanB, use(P1, planB, "27024.plan-b-action")),
      accepting(villain),
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, villain).damage).toBe(before + 2);
    expect(after.players[0]!.hand.length).toBe(beforeHand - 1);
    expect(inst(after, planB).exhausted).toBe(true);
  });
});
