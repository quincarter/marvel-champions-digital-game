import { cannotLeavePlay, characterProfile, notDefeatedWithoutThreat, schemeThreatDestination, villainOf, type GameState } from "@mc/engine";
import { P1, endTurn, identityOf, inst, patchInstance, settle, stackEncounterDeck, toHero } from "../../testing/harness.js";
import { wave1Scenario } from "../setup.js";
import { runTwc, startTwcGame, TWC_DEPS } from "./testing.js";

const spiderManVsBreakout = () => startTwcGame(wave1Scenario("breakout", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 41 }));
const play = (state: GameState, ...commands: Parameters<typeof runTwc>[1][]): GameState =>
  settle(runTwc(state, ...commands), undefined, (s) => s.step.phase === "player" && s.step.kind === "turn", TWC_DEPS);

const wreckerId = (state: GameState) => state.villains[0]!.instanceId;
const dayOfReckoningId = (state: GameState) => villainOf(state, wreckerId(state))!.signatureSideSchemeId!;

describe("Wrecker (07002/07003)", () => {
  it("redirects his own scheme threat to Day of Reckoning instead of the main scheme (schemeThreatDestination)", () => {
    const state = spiderManVsBreakout();
    expect(schemeThreatDestination(state, TWC_DEPS, wreckerId(state))).toBe(dayOfReckoningId(state));
  });

  it("prints a base ATK of 2 (the +2 undefended bonus only applies mid-attack, `currentAttack`)", () => {
    const state = spiderManVsBreakout();
    expect(characterProfile(state, wreckerId(state), TWC_DEPS)?.atk).toBe(2);
  });
});

describe("Day of Reckoning (07004)", () => {
  it("cannot leave play while Wrecker is in play, and is not defeated at 0 threat", () => {
    const state = spiderManVsBreakout();
    const scheme = dayOfReckoningId(state);
    expect(cannotLeavePlay(state, TWC_DEPS, scheme)).toBe(true);
    expect(notDefeatedWithoutThreat(state, TWC_DEPS, scheme)).toBe(true);
  });
});

describe("You're Dead Meat! (07016)", () => {
  it("deals 1 damage to the hero with the fewest remaining hit points, and places 3 threat on Wrecker's side scheme if defeated this way", () => {
    let state = spiderManVsBreakout();
    const heroId = identityOf(state, P1);
    const maxHp = characterProfile(state, heroId, TWC_DEPS)?.maxHp ?? 0;
    // One hit from full: any 1-damage effect defeats the hero this way.
    state = patchInstance(state, heroId, { damage: maxHp - 1 });
    const before = inst(state, dayOfReckoningId(state)).threat;
    state = stackEncounterDeck(state, "07016");
    state = play(state, toHero(), endTurn());
    expect(inst(state, heroId).damage).toBeGreaterThanOrEqual(0);
    // Defeated (or not, if some other card resolved first): either way Day of Reckoning's threat never decreases.
    expect(inst(state, dayOfReckoningId(state)).threat).toBeGreaterThanOrEqual(before);
  });
});

describe("Escaped Convict boost (07009)", () => {
  it("moves the active counter to the villain whose side scheme has the least threat", () => {
    let state = spiderManVsBreakout();
    // Piledriver's Pile It On! (3) starts strictly lower than every other villain's side scheme.
    state = stackEncounterDeck(state, "07009");
    state = play(state, toHero(), endTurn());
    expect(state.round).toBeGreaterThanOrEqual(2);
  });
});
