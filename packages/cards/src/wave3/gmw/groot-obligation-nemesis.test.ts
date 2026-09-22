import { activeEncounterDeck } from "@mc/engine";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../testing/harness.js";
import { wave3Scenario } from "../setup.js";
import { revealFromEncounterDeck, runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";

const grootVsRhino = () =>
  startWave3Game(wave3Scenario("rhino", { players: [{ starterDeckId: "groot-protection" }], seed: 2026 }));

const pickingLabelStartingWith =
  (prefix: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hit = choice.options.find((o) => o.label.startsWith(prefix));
    return hit ? [hit.optionId] : firstLegal(state);
  };

describe("Groot's obligation and nemesis (Wilt, Blazing Inferno, Furnax, Fan the Flames)", () => {
  it("Wilt: exhausting your alter-ego removes it from the game, leaving Groot's growth counters untouched", () => {
    const staged = stackEncounterDeck(grootVsRhino(), "01186", "16025");
    const identity = identityOf(staged);
    const withCounters = patchInstance(staged, identity, { counters: { growth: 4 } });
    const revealed = settle(
      runWave3(withCounters, { type: "endTurn", playerId: P1 }),
      pickingLabelStartingWith("Exhaust"),
      undefined,
      WAVE3_DEPS,
    );
    const [wilt] = instancesOf(revealed, "16025");
    expect(revealed.removedFromGame).toContain(wilt); // removed from the game, not merely discarded
    expect(inst(revealed, identity).exhausted).toBe(true);
    expect(inst(revealed, identity).counters.growth).toBe(4); // the alternative branch never resolved
  });

  it("Wilt: removing 3 growth counters from Groot doesn't gain surge when there were some to remove", () => {
    const staged = stackEncounterDeck(grootVsRhino(), "01186", "16025");
    const identity = identityOf(staged);
    const withCounters = patchInstance(staged, identity, { counters: { growth: 4 } });
    const discardBefore = activeEncounterDeck(withCounters).discard.length;
    const revealed = settle(
      runWave3(withCounters, { type: "endTurn", playerId: P1 }),
      pickingLabelStartingWith("Remove 3 growth counters"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(revealed, identity).counters.growth).toBe(1); // 4 - 3
    // Rhino's own boost draw (unconditional, ahead of the reveal step — docs/card-scripting-process.md §3's
    // `stackSetAsideBehindBoost` lesson) consumes 01186 first; 16025 is what the villain phase actually reveals.
    // No surge means no *further* card beyond those two lands in the discard pile.
    expect(activeEncounterDeck(revealed).discard.length).toBe(discardBefore + 2);
  });

  it("Wilt: gains surge when Groot has no growth counters to remove", () => {
    const staged = stackEncounterDeck(grootVsRhino(), "01186", "16025");
    const identity = identityOf(staged);
    const withNoCounters = patchInstance(staged, identity, { counters: { growth: 0 } });
    const discardBefore = activeEncounterDeck(withNoCounters).discard.length;
    const revealed = settle(
      runWave3(withNoCounters, { type: "endTurn", playerId: P1 }),
      pickingLabelStartingWith("Remove 3 growth counters"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(revealed, identity).counters.growth ?? 0).toBe(0);
    // Baseline is +2 (Rhino's own boost draw, then the obligation reveal itself — the previous test's own
    // comment). Surge draws and reveals a further encounter card on top of that.
    expect(activeEncounterDeck(revealed).discard.length).toBeGreaterThan(discardBefore + 2);
  });

  it("Fan the Flames: When Revealed, take 2 indirect damage (plus 1 for Blazing Inferno, plus 1 for Furnax, if in play)", () => {
    const start = grootVsRhino();
    const identity = identityOf(start);
    const damageBefore = inst(start, identity).damage;
    const { state } = revealFromEncounterDeck(start, "16028", firstLegal);
    expect(inst(state, identity).damage).toBe(damageBefore + 2);
  });

  it("Blazing Inferno: Forced Response, after the villain phase begins, deal 2 indirect damage to each player", () => {
    const start = grootVsRhino();
    // Revealing it happens mid-villain-phase, after that phase's own "phase begins" trigger already resolved
    // (docs/phase7-wave3.md §3.2), so this side scheme's own response only fires starting the *next* villain phase.
    const { state: withScheme } = revealFromEncounterDeck(start, "16026", firstLegal);
    const identity = identityOf(withScheme);
    const before = inst(withScheme, identity).damage;
    const nextPhase = settle(runWave3(withScheme, endTurn()), firstLegal, undefined, WAVE3_DEPS);
    expect(inst(nextPhase, identity).damage).toBe(before + 2);
  });

  it("Furnax: [star] Forced Response, after Furnax activates, deal 2 indirect damage to each player", () => {
    const start = grootVsRhino();
    // Same timing as Blazing Inferno above: Furnax is engaged the villain phase he's revealed (after enemy
    // activations for that phase already resolved), so he activates starting the *next* villain phase.
    const { state: withFurnax } = revealFromEncounterDeck(start, "16027", firstLegal);
    const identity = identityOf(withFurnax);
    const before = inst(withFurnax, identity).damage;
    // Clear the main scheme's threat first: left alone, Furnax's own scheme activation (his printed SCH, no ATK)
    // stacks on Rhino's own step-one placement and completes the main scheme this same villain phase, ending the
    // game before the response resolves — a scenario-balance accident unrelated to Furnax's own ability.
    const roomToBreathe = patchInstance(withFurnax, withFurnax.mainScheme.instanceId, { threat: 0 });
    const activated = settle(runWave3(roomToBreathe, endTurn()), firstLegal, undefined, WAVE3_DEPS);
    expect(activated.outcome).toBeNull();
    expect(inst(activated, identity).damage).toBe(before + 2);
  });
});
