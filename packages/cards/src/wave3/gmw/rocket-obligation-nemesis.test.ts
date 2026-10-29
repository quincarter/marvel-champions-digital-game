import { cardId } from "@mc/content";
import { activeEncounterDeck, activeEncounterDeckId, cardsInPlay, statusActive, type GameState } from "@mc/engine";
import {
  firstLegal,
  identityOf,
  endTurn,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  P1,
  play,
  payWith,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEvents, driveEventsPicking } from "../../testing/staging.js";
import { wave3Scenario } from "../setup.js";
import { revealFromEncounterDeck, runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";

const rocketVsRhino = () =>
  startWave3Game(wave3Scenario("rhino", { players: [{ starterDeckId: "rocket-raccoon-aggression" }], seed: 2026 }));

const pickingLabelStartingWith =
  (prefix: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hit = choice.options.find((o) => o.label.startsWith(prefix));
    return hit ? [hit.optionId] : firstLegal(state);
  };

describe("Rocket Raccoon's obligation and nemesis (Crisis on Halfworld, Blackjack's Bazooka, Planetary Invasion)", () => {
  it("Crisis on Halfworld: discards the highest cost upgrade you control (16053.obligation)", () => {
    // Battery Pack (16034, cost 1) and Particle Cannon (16036, cost 3): the higher-cost one is discarded.
    const given = moveToHand(rocketVsRhino(), P1, "16034", "16036");
    const [battery, cannon] = given.ids;
    const withBattery = runWave3(given.state, play(P1, battery!, payWith(given.state, P1, 1, [battery!, cannon!])));
    const withBoth = runWave3(withBattery, play(P1, cannon!, payWith(withBattery, P1, 3, [cannon!])));
    const staged = stackEncounterDeck(withBoth, "01186", "16053");
    const revealed = settle(
      runWave3(staged, { type: "endTurn", playerId: P1 }),
      pickingLabelStartingWith("Discard the highest cost upgrade"),
      undefined,
      WAVE3_DEPS,
    );
    expect(cardsInPlay(revealed)).toContain(battery); // the cheaper upgrade stays
    expect(cardsInPlay(revealed)).not.toContain(cannon); // the highest-cost one was discarded
  });

  it("Crisis on Halfworld: gains surge when you control no upgrade to discard", () => {
    const staged = stackEncounterDeck(rocketVsRhino(), "01186", "16053");
    const discardBefore = activeEncounterDeck(staged).discard.length;
    const revealed = settle(
      runWave3(staged, { type: "endTurn", playerId: P1 }),
      pickingLabelStartingWith("Discard the highest cost upgrade"),
      undefined,
      WAVE3_DEPS,
    );
    // Baseline +2 (Rhino's own boost draw, then the obligation reveal itself). Surge draws and reveals one more.
    expect(activeEncounterDeck(revealed).discard.length).toBeGreaterThan(discardBefore + 2);
  });

  it("Crisis on Halfworld: exhausting your alter-ego removes it from the game", () => {
    const staged = stackEncounterDeck(rocketVsRhino(), "01186", "16053");
    const identity = identityOf(staged);
    const revealed = settle(
      runWave3(staged, { type: "endTurn", playerId: P1 }),
      pickingLabelStartingWith("Exhaust"),
      undefined,
      WAVE3_DEPS,
    );
    const [crisis] = instancesOf(revealed, "16053");
    expect(revealed.removedFromGame).toContain(crisis);
    expect(inst(revealed, identity).exhausted).toBe(true);
  });

  it("Blackjack's Bazooka: Hero Action, spend 3 [mental] resources to discard this card", () => {
    // Blackjack's Bazooka is an *encounter* card (Rocket's own nemesis set) — it enters play by being revealed,
    // not played from a hand. Blackjack O'Hare isn't in play in this standalone (non-`gmw`-scenario) game, so it
    // attaches to the villain instead (`AttachmentHost.ifAble`, data).
    const hero = runWave3(rocketVsRhino(), toHero());
    // Five cards each printing 1 [mental] icon — more than the 3 needed, since revealing Blackjack's Bazooka
    // plays out a full villain phase (including an end-of-round hand-size discard) that can cost a couple of
    // them before the ability is ever used.
    const given = moveToHand(hero, P1, "16030", "16039", "16045", "16041", "16052");
    const { state: withBazooka, id: bazooka } = revealFromEncounterDeck(given.state, "16056", firstLegal);
    expect(cardsInPlay(withBazooka)).toContain(bazooka);
    const mentalInHand = playerOf(withBazooka, P1).hand.filter((id) => given.ids.includes(id));
    expect(mentalInHand.length).toBeGreaterThanOrEqual(3);
    const [m1, m2, m3] = mentalInHand;
    const used = settle(
      runWave3(
        withBazooka,
        use(P1, bazooka, "16056.blackjacks-bazooka-action", [{ fromHand: m1! }, { fromHand: m2! }, { fromHand: m3! }]),
      ),
      firstLegal,
      undefined,
      WAVE3_DEPS,
    );
    expect(cardsInPlay(used)).not.toContain(bazooka);
  });

  it("Planetary Invasion: When Revealed, discards from the encounter deck until a minion, reveals it, and gives it a tough status card (16057.when-revealed)", () => {
    const start = rocketVsRhino();
    const stacked = stackEncounterDeck(start, "01186", "01186", "01101"); // 2 fillers, then a real minion
    const { state, id } = revealFromEncounterDeck(stacked, "16057", firstLegal);
    const minion = instancesOf(state, "01101").find((mid) => cardsInPlay(state).includes(mid));
    expect(minion).toBeDefined();
    expect(statusActive(state, minion!, "tough", WAVE3_DEPS)).toBe(true);
    expect(playerOf(state, P1).discard).not.toContain(id); // Planetary Invasion itself, an encounter card, isn't in a player's discard
  });
});

describe("Planetary Invasion (16057): a Quickstrike attack only initiates in the reveal sentence (FFG ruling January 11, 2024 - Ruling 137)", () => {
  /**
   * Ruling: the revealed minion's Quickstrike "initiat[es] its attack. (The steps of the attack will then resolve at the
   * next available opportunity.) The minion is given a Tough status card immediately after this, because it's in the same
   * sentence as the reveal effect". RRG 1.8 p. 4 ("resolve the ability one sentence at a time") does not say otherwise.
   * Teamwork ruling December 8, 2023 - Ruling 129 gives the same "initiates, resolves later" model.
   */
  it("Vulture (quickstrike, ATK 3) revealed by Planetary Invasion gets its tough status card before its attack deals damage", () => {
    const base = runWave3(rocketVsRhino(), toHero());
    const invasion = base.players[0]!.setAside.find((id) => inst(base, id).cardId === "16057")!;
    const deckId = activeEncounterDeckId(base);
    const stacked = stackEncounterDeck(base, "01186", "01101");
    const mercenary = activeEncounterDeck(stacked).deck.find((i) => inst(stacked, i).cardId === cardId("01101"))!;
    // The Hydra Mercenary stands in for Vulture (01167, quickstrike, ATK 3): same instance, other printing.
    const swapped = patchInstance(stacked, mercenary, { cardId: cardId("01167") });
    const piles = activeEncounterDeck(swapped);
    const state: GameState = {
      ...swapped,
      players: swapped.players.map((p) =>
        p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== invasion) } : p,
      ),
      encounterDecks: {
        ...swapped.encounterDecks,
        [deckId]: { ...piles, deck: [piles.deck[0]!, invasion, ...piles.deck.slice(1)] },
      },
    };
    const { events } = driveEvents(WAVE3_DEPS, state, endTurn());
    const after = events.findIndex((e) => e.type === "encounterCardRevealed" && e.cardId === "01167");
    expect(after, "Vulture was revealed").toBeGreaterThan(-1);
    const next = events.slice(after + 1).find((e) => e.type === "statusGiven" || e.type === "damageDealt");
    // Staging sanity: the revealed minion's step produced one of the two events at all.
    expect(next).toBeDefined();
    // The attack was initiated in the reveal sentence; its damage follows the tough status card.
    expect(next!.type).toBe("statusGiven");
  });
});

describe("Planetary Invasion (16057) with Hawkeye (01066): the keyword initiates, then the enters-play Response, then the attack's steps", () => {
  /**
   * FFG ruling January 11, 2024 - Ruling 137: "The minion is revealed, and its Quickstrike keyword resolves, initiating
   * its attack... Hawkeye's Response may be resolved at this time, after the attack initiates but before the steps of
   * the attack resolve. The minion resolves its attack." RRG 1.8 FAQ "Widow's Bite (#10)" (p. 60): keywords have timing
   * priority over Response abilities; ruling February 15, 2024 - Ruling 147.
   */
  it("Vulture's attack initiates, it gets its tough status card, Hawkeye's Response resolves, then the attack deals its damage", () => {
    const base = runWave3(rocketVsRhino(), toHero());
    // Hawkeye staged straight into P1's play area with his 4 arrow counters (surgery: no cost, no enter-play).
    const spare = playerOf(base, P1).deck.at(-2)!;
    const withHawkeye: GameState = {
      ...base,
      players: base.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== spare), playArea: [...p.playArea, spare] } : p,
      ),
      instances: {
        ...base.instances,
        [spare]: {
          ...base.instances[spare]!,
          cardId: cardId("01066"),
          faceup: true,
          controllerId: P1,
          counters: { arrow: 4 },
        },
      },
    };
    const invasion = withHawkeye.players[0]!.setAside.find((id) => inst(withHawkeye, id).cardId === "16057")!;
    const deckId = activeEncounterDeckId(withHawkeye);
    const stacked = stackEncounterDeck(withHawkeye, "01186", "01101");
    const mercenary = activeEncounterDeck(stacked).deck.find((i) => inst(stacked, i).cardId === cardId("01101"))!;
    // The Hydra Mercenary stands in for Vulture (01167, quickstrike, ATK 3, HP 4): same instance, other printing.
    const swapped = patchInstance(stacked, mercenary, { cardId: cardId("01167") });
    const piles = activeEncounterDeck(swapped);
    const state: GameState = {
      ...swapped,
      players: swapped.players.map((p) =>
        p.playerId === P1 ? { ...p, setAside: p.setAside.filter((i) => i !== invasion) } : p,
      ),
      encounterDecks: {
        ...swapped.encounterDecks,
        [deckId]: { ...piles, deck: [piles.deck[0]!, invasion, ...piles.deck.slice(1)] },
      },
    };
    const acceptHawkeye: Picker = (s) => {
      const hit = s.pendingChoice?.options.find((o) => o.optionId.includes("01066.hawkeye-response"));
      if (hit) return [hit.optionId];
      // Take no damage on a defense prompt: the hero does not defend, so the attack's damage lands on the hero.
      if (s.pendingChoice?.prompt.kind === "declareDefender") return ["decline"];
      return firstLegal(s);
    };
    const { state: after, events } = driveEventsPicking(WAVE3_DEPS, state, acceptHawkeye, endTurn());
    const initiated = events.findIndex(
      (e) =>
        e.type === "triggerEvent" &&
        e.phase === "initiated" &&
        e.event.kind === "enemyAttack" &&
        e.event.enemyInstanceId === mercenary,
    );
    const resolved = events.findIndex(
      (e) =>
        e.type === "triggerEvent" &&
        e.phase === "resolved" &&
        e.event.kind === "enemyAttack" &&
        e.event.enemyInstanceId === mercenary,
    );
    const arrows = events.findIndex(
      (e) => e.type === "counterRemoved" && e.instanceId === spare && e.counterType === "arrow",
    );
    const tough = events.findIndex((e) => e.type === "statusGiven" && e.instanceId === mercenary);
    const heroDamage = events.findIndex((e) => e.type === "damageDealt" && e.sourceInstanceId === mercenary);
    expect(initiated, "Vulture's attack initiated").toBeGreaterThan(-1);
    expect(tough, "the tough status card follows the initiation, in the reveal sentence").toBeGreaterThan(initiated);
    expect(arrows, "Hawkeye's Response resolves after the tough status card").toBeGreaterThan(tough);
    expect(heroDamage, "the attack's steps resolve after Hawkeye's Response").toBeGreaterThan(arrows);
    expect(resolved).toBeGreaterThan(heroDamage);
    expect(inst(after, spare).counters.arrow).toBe(3);
    // The tough status card took Hawkeye's 2 damage.
    expect(inst(after, mercenary).damage).toBe(0);
    expect(inst(after, mercenary).statuses.tough).toBe(0);
  });
});
