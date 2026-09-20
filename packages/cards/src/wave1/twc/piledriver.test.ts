import { cannotLeavePlay, notDefeatedWithoutThreat, schemeThreatDestination, villainOf, type GameState } from "@mc/engine";
import { P1, endTurn, identityOf, inst, patchInstance, settle, stackEncounterDeck, toHero } from "../../testing/harness.js";
import { withActive } from "../../testing/staging.js";
import { wave1Scenario } from "../setup.js";
import { runTwc, startTwcGame, TWC_DEPS } from "./testing.js";

const spiderManVsBreakout = () => startTwcGame(wave1Scenario("breakout", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 41 }));
const play = (state: GameState, ...commands: Parameters<typeof runTwc>[1][]): GameState =>
  settle(runTwc(state, ...commands), undefined, (s) => s.step.phase === "player" && s.step.kind === "turn", TWC_DEPS);

const piledriverId = (state: GameState) => state.villains[2]!.instanceId;
const pileItOnId = (state: GameState) => villainOf(state, piledriverId(state))!.signatureSideSchemeId!;

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
    // Breakout 1B re-picks the active villain every round by highest post-step-one side-scheme threat; keep
    // Piledriver active for this round (otherwise it reverts to Wrecker before step two, and Piledriver never
    // activates at all). 8 (9 after step one's own +1) safely beats every other villain's own post-step-one total
    // (Wrecker 6+1=7 is the highest of the rest) without itself already being 10-or-more when step one's +1 lands —
    // crossing Pile Drive's own threshold before the re-pick reads the totals would hand the active counter to
    // Wrecker instead, the same interaction `wave1/twc/breakout.test.ts`'s own test now documents.
    state = patchInstance(state, pileItOnId(state), { threat: 8 });
    const before = inst(state, pileItOnId(state)).threat;
    state = stackEncounterDeck(state, "07043");
    state = play(state, endTurn());
    // Piledriver's own reveal-triggered scheme (redirected onto Pile It On!, `07032.piledriver-constant`) pushes
    // this comfortably past Pile Drive's own 10-or-more threshold (9 + his SCH of 2, plus any boost icons), so the
    // scheme is placed here — proven by the value actually *changing* — and then immediately capped to 3
    // (`07034.pile-drive`, scripted since the wave B primitives batch).
    expect(inst(state, pileItOnId(state)).threat).toBe(3);
    expect(before).not.toBe(3);
  });
});

describe("Pummel (07044)", () => {
  it("When Revealed (Hero): Piledriver attacks you, harder while tough", () => {
    let state = withActive(spiderManVsBreakout(), piledriverId(spiderManVsBreakout()));
    const heroId = identityOf(state, P1);
    state = patchInstance(state, heroId, { exhausted: false });
    state = patchInstance(state, pileItOnId(state), { threat: 8 });
    const before = inst(state, heroId).damage;
    state = stackEncounterDeck(state, "07044");
    state = play(state, toHero(), endTurn());
    expect(inst(state, heroId).damage).toBeGreaterThan(before);
  });
});

describe("Uncanny Resilience (07045)", () => {
  it("When Revealed: removes every villain's stunned/confused status cards", () => {
    let state = withActive(spiderManVsBreakout(), piledriverId(spiderManVsBreakout()));
    // See Escape Plan's own comment above: 8 keeps Piledriver picked active without prematurely tripping Pile
    // Drive during step one, so his own encounter deck (holding the stacked cards below) is the one actually used.
    state = patchInstance(state, pileItOnId(state), { threat: 8 });
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
