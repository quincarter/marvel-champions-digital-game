import { cardId, encounterSetId } from "@mc/content";
import { currentName, getInstance, villainStage, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { P1, endTurn, firstLegal, patchInstance, settle } from "../../../testing/harness.js";
import { runWave5, startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";

/**
 * `wave5Scenario("venom-goblin", …)` (`sm` 27113–27126, MC27 p. 17, docs/phase7-wave5.md §1.1/§2.2/§3.3/§3.4/§3.9).
 * `27116a.setup`'s own worked shape is `packages/engine/src/glider-main-schemes.test.ts`'s (landed); these tests
 * exercise the real, scripted scenario data on top of it, plus the completed-stage-flips-to-environment pipeline
 * `main-scheme.ts` scripts (27117b–27119b's own When Revealed/loss check). Only Goblin Gear is a recommended
 * modular; Bomb Scare (Core) stands in for it, the box's own `mysterio`/`sinister-six` precedent for an unscripted
 * modular.
 */
function venomGoblin(
  players: Parameters<typeof ghostSpiderScenario>[1]["extraPlayers"] = [],
  overrides: Partial<Parameters<typeof ghostSpiderScenario>[1]> = {},
): GameState {
  return startWave5Game(
    ghostSpiderScenario("venom-goblin", {
      seed: 7,
      modularSetIds: [encounterSetId("bomb_scare")],
      extraPlayers: players,
      ...overrides,
    }),
  );
}

const schemes = (state: GameState): readonly InstanceId[] => [
  state.mainScheme.instanceId,
  ...(state.extraMainSchemes ?? []).map((s) => s.instanceId),
];
const schemeNamed = (state: GameState, name: string): InstanceId => {
  const found = schemes(state).find((id) => currentName(state, id) === name);
  if (!found)
    throw new Error(`no main scheme named ${name} among ${schemes(state).map((id) => currentName(state, id))}`);
  return found;
};
const threatOf = (state: GameState, name: string): number => getInstance(state, schemeNamed(state, name))!.threat;
const gliderOn = (state: GameState): string | undefined =>
  schemes(state)
    .filter((id) => (getInstance(state, id)?.counters["glider"] ?? 0) > 0)
    .map((id) => currentName(state, id))[0];

describe("wave5Scenario('venom-goblin'): 27116a.setup", () => {
  it("1 player: Lower/Midtown/Upper Manhattan in play, the glider on Midtown, Skies Over New York set aside as its environment face", () => {
    const state = venomGoblin();
    expect(schemes(state).map((id) => currentName(state, id))).toEqual([
      "Lower Manhattan",
      "Midtown Manhattan",
      "Upper Manhattan",
    ]);
    expect(gliderOn(state)).toBe("Midtown Manhattan");
    expect([
      threatOf(state, "Lower Manhattan"),
      threatOf(state, "Midtown Manhattan"),
      threatOf(state, "Upper Manhattan"),
    ]).toEqual([1, 2, 0]);
    const skiesEnv = state.encounterSetAside.find((id) => getInstance(state, id)?.cardId === cardId("27116b"));
    expect(skiesEnv).toBeDefined();
    // Only the environment face is set aside; the main scheme card (27116a) itself is the one now in the villain area
    // (as Lower/Midtown/Upper, each still card 27116a at a different stage) — no separate 27116a instance sits idle.
    expect(state.encounterSetAside.some((id) => getInstance(state, id)?.cardId === cardId("27116a"))).toBe(false);
  });

  it("2/3/4 players: starting threat scales by player count (Lower 1, Midtown 2, Upper 0 per hero)", () => {
    const two = venomGoblin([{ starterDeckId: "spider-man-morales" }]);
    expect([
      threatOf(two, "Lower Manhattan"),
      threatOf(two, "Midtown Manhattan"),
      threatOf(two, "Upper Manhattan"),
    ]).toEqual([2, 4, 0]);
    const three = venomGoblin([{ starterDeckId: "spider-man-morales" }, { starterDeckId: "core-spider-man-justice" }]);
    expect([
      threatOf(three, "Lower Manhattan"),
      threatOf(three, "Midtown Manhattan"),
      threatOf(three, "Upper Manhattan"),
    ]).toEqual([3, 6, 0]);
    const four = venomGoblin([
      { starterDeckId: "spider-man-morales" },
      { starterDeckId: "core-spider-man-justice" },
      { starterDeckId: "core-captain-marvel-leadership" },
    ]);
    expect([
      threatOf(four, "Lower Manhattan"),
      threatOf(four, "Midtown Manhattan"),
      threatOf(four, "Upper Manhattan"),
    ]).toEqual([4, 8, 0]);
  });

  it("standard: Venom Goblin starts at stage 1; expert: starts at stage 2 with the expert encounter set", () => {
    const standard = venomGoblin();
    expect(villainStage(standard).stageNumber).toBe(1);
    expect(standard.scenarioRules.difficulty).toBeUndefined();
    const expert = venomGoblin([], { difficulty: "expert" });
    expect(villainStage(expert).stageNumber).toBe(2);
    expect(expert.scenarioRules.difficulty).toBe("expert");
  });
});

describe("a completed stage (27117b/27118b/27119b) flips to its environment and moves the glider counter", () => {
  it("Midtown Manhattan (holding the glider) completes, flips to its environment face, and the glider moves to the least-threat scheme", () => {
    const state = venomGoblin();
    const midtown = schemeNamed(state, "Midtown Manhattan");
    // targetThreat 12 (1 hero), acceleration 1/round; the villain's own step-one scheme also lands on the glider
    // scheme (docs/phase7-wave5.md §3.3, `packages/engine/src/glider-main-schemes.test.ts`'s own "+2 from the
    // villain's scheme" comment) — Venom Goblin (I)'s SCH is 2, so Midtown gains at least 1 (its own acceleration)
    // this round; patched one below its own acceleration alone guarantees completion regardless of the villain's
    // extra scheme amount (a direct patch to the target value itself would never fire the completion check — the
    // `escape-the-museum-completion.test.ts` precedent).
    const primed = patchInstance(state, midtown, { threat: 11 });
    const settled = settle(runWave5(primed, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(settled.outcome).toBeNull();
    // Midtown Manhattan is no longer among the main schemes...
    expect(schemes(settled).map((id) => currentName(settled, id))).toEqual(["Lower Manhattan", "Upper Manhattan"]);
    // ...its environment face (27118b) entered the villain area, was revealed, and the glider counter (which it
    // held) moved off it to one of the two remaining schemes — the exact tie-break ("the main scheme with the
    // least threat", superlative "lowest") is asserted structurally on the ability's own plain-data effect in
    // `main-scheme.test.ts` instead of recomputed here: by the time `endTurn` settles a full villain phase, a real
    // encounter card may already have placed more threat on whichever scheme the glider landed on, so the two
    // schemes' *final* threat no longer reflects what was compared at the moment of the move.
    const midtownEnv = settled.villainArea.find((id) => getInstance(settled, id)?.cardId === cardId("27118b"));
    expect(midtownEnv).toBeDefined();
    expect(getInstance(settled, midtownEnv!)!.counters["glider"] ?? 0).toBe(0);
    expect(gliderOn(settled)).toBeDefined();
    expect(["Lower Manhattan", "Upper Manhattan"]).toContain(gliderOn(settled));
  });

  it("with 2 [Symbiote] environments in play (2 completed stages), the players lose the game", () => {
    const state = venomGoblin();
    const midtown = schemeNamed(state, "Midtown Manhattan");
    const primedMidtown = patchInstance(state, midtown, { threat: 11 });
    const afterMidtown = settle(runWave5(primedMidtown, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(afterMidtown.outcome).toBeNull();
    // One [Symbiote] environment (Midtown's own) is not yet 2: complete a second stage (Upper, target 10, 1/round).
    const upper = schemeNamed(afterMidtown, "Upper Manhattan");
    const primedUpper = patchInstance(afterMidtown, upper, { threat: 9 });
    const afterUpper = settle(runWave5(primedUpper, endTurn(P1)), firstLegal, undefined, WAVE5_DEPS);
    expect(afterUpper.outcome).toMatchObject({ result: "loss" });
  });
});
