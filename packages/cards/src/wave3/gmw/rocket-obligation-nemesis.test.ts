import { activeEncounterDeck, cardsInPlay, statusActive } from "@mc/engine";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
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
  it("Crisis on Halfworld: discards the highest cost upgrade you control", () => {
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

  it("Planetary Invasion: When Revealed, discards from the encounter deck until a minion, reveals it, and gives it a tough status card", () => {
    const start = rocketVsRhino();
    const stacked = stackEncounterDeck(start, "01186", "01186", "01101"); // 2 fillers, then a real minion
    const { state, id } = revealFromEncounterDeck(stacked, "16057", firstLegal);
    const minion = instancesOf(state, "01101").find((mid) => cardsInPlay(state).includes(mid));
    expect(minion).toBeDefined();
    expect(statusActive(state, minion!, "tough", WAVE3_DEPS)).toBe(true);
    expect(playerOf(state, P1).discard).not.toContain(id); // Planetary Invasion itself, an encounter card, isn't in a player's discard
  });
});
