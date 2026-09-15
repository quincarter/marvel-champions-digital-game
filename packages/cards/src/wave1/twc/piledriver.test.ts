import { cannotLeavePlay, notDefeatedWithoutThreat, schemeThreatDestination, villainOf, type GameState, type InstanceId } from "@mc/engine";
import { P1, endTurn, identityOf, inst, patchInstance, settle, stackEncounterDeck, toHero } from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { runTwc, startTwcGame, TWC_DEPS } from "./testing.js";

const spiderManVsBreakout = () => startTwcGame(wave1Scenario("breakout", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 41 }));
const play = (state: GameState, ...commands: Parameters<typeof runTwc>[1][]): GameState =>
  settle(runTwc(state, ...commands), undefined, (s) => s.step.phase === "player" && s.step.kind === "turn", TWC_DEPS);

const piledriverId = (state: GameState) => state.villains[2]!.instanceId;
const pileItOnId = (state: GameState) => villainOf(state, piledriverId(state))!.signatureSideSchemeId!;
const withActive = (state: GameState, id: InstanceId): GameState => ({ ...state, activeVillainId: id });

describe("Piledriver (07032/07033)", () => {
  it("redirects his own scheme threat to Pile It On! instead of the main scheme", () => {
    const state = spiderManVsBreakout();
    expect(schemeThreatDestination(state, TWC_DEPS, piledriverId(state))).toBe(pileItOnId(state));
  });
});

describe("Pile It On! (07034)", () => {
  it("cannot leave play while Piledriver is in play, and is not defeated at 0 threat", () => {
    const state = spiderManVsBreakout();
    const scheme = pileItOnId(state);
    expect(cannotLeavePlay(state, TWC_DEPS, scheme)).toBe(true);
    expect(notDefeatedWithoutThreat(state, TWC_DEPS, scheme)).toBe(true);
  });
});

describe("Escape Plan (07043)", () => {
  it("When Revealed: if you are already confused, Piledriver schemes (redirected onto Pile It On!)", () => {
    let state = withActive(spiderManVsBreakout(), piledriverId(spiderManVsBreakout()));
    const heroId = identityOf(state, P1);
    state = patchInstance(state, heroId, { statuses: { stunned: 0, confused: 1, tough: 0 } });
    // Breakout 1B re-picks the active villain every round by highest side-scheme threat; keep Piledriver active for
    // this round (otherwise it reverts to Wrecker before step two, and Piledriver never activates at all).
    state = patchInstance(state, pileItOnId(state), { threat: 99 });
    const before = inst(state, pileItOnId(state)).threat;
    state = stackEncounterDeck(state, "07043");
    state = play(state, endTurn());
    expect(inst(state, pileItOnId(state)).threat).toBeGreaterThan(before);
  });
});

describe("Pummel (07044)", () => {
  it("When Revealed (Hero): Piledriver attacks you, harder while tough", () => {
    let state = withActive(spiderManVsBreakout(), piledriverId(spiderManVsBreakout()));
    const heroId = identityOf(state, P1);
    state = patchInstance(state, heroId, { exhausted: false });
    state = patchInstance(state, pileItOnId(state), { threat: 99 });
    const before = inst(state, heroId).damage;
    state = stackEncounterDeck(state, "07044");
    state = play(state, toHero(), endTurn());
    expect(inst(state, heroId).damage).toBeGreaterThan(before);
  });
});

describe("Uncanny Resilience (07045)", () => {
  it("When Revealed: removes every villain's stunned/confused status cards", () => {
    let state = withActive(spiderManVsBreakout(), piledriverId(spiderManVsBreakout()));
    state = patchInstance(state, pileItOnId(state), { threat: 99 });
    const bulldozer = state.villains[3]!.instanceId;
    state = patchInstance(state, bulldozer, { statuses: { stunned: 1, confused: 0, tough: 0 } });
    expect(inst(state, bulldozer).statuses.stunned).toBe(1);
    // Piledriver, active, draws his own boost card first in his step-two activation ("07037", no ability); "07045"
    // is then the card dealt to the lone player.
    state = stackEncounterDeck(state, "07037", "07045");
    state = play(state, endTurn());
    expect(inst(state, bulldozer).statuses.stunned).toBe(0);
  });
});
