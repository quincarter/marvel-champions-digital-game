import { cardId, encounterSetId } from "@mc/content";
import {
  createGame,
  currentName,
  getInstance,
  replay,
  villainStage,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, test } from "vitest";
import { P1, endTurn, firstLegal, patchInstance, picking, settle } from "../../../testing/harness.js";
import { playToOutcome } from "../../../testing/driver.js";
import { driveEventsPicking } from "../../../testing/staging.js";
import { runWave5, startWave5Game, WAVE5_DEPS } from "../../testing.js";
import { wave5Scenario } from "../../setup.js";
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
  it("the four environment faces (27116b-27119b) aren't shuffled into the encounter deck; they enter play only by flipping", () => {
    const config = ghostSpiderScenario("venom-goblin", { seed: 7, modularSetIds: [encounterSetId("bomb_scare")] });
    for (const id of ["27116b", "27117b", "27118b", "27119b"]) expect(config.encounterDeck).not.toContain(cardId(id));
  });

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
  /**
   * Midtown Manhattan (glider, target 12 for 1 hero, acceleration 1) primed to complete on step one of the villain
   * phase, with Lower and Upper at the given threat before their own step-one acceleration (1 each).
   */
  const completeMidtown = (lower: number, upper: number, pick = firstLegal): GameState => {
    let state = venomGoblin();
    state = patchInstance(state, schemeNamed(state, "Midtown Manhattan"), { threat: 11 });
    state = patchInstance(state, schemeNamed(state, "Lower Manhattan"), { threat: lower });
    state = patchInstance(state, schemeNamed(state, "Upper Manhattan"), { threat: upper });
    return settle(runWave5(state, endTurn(P1)), pick, undefined, WAVE5_DEPS);
  };

  it("Midtown Manhattan (holding the glider) completes, flips to its environment face, and the glider moves to the scheme with the least threat", () => {
    const settled = completeMidtown(5, 0);
    expect(settled.outcome).toBeNull();
    // Midtown Manhattan is no longer among the main schemes...
    expect(schemes(settled).map((id) => currentName(settled, id))).toEqual(["Lower Manhattan", "Upper Manhattan"]);
    // ...its environment face (27118b) entered the villain area and gave the glider to Upper (0 + 1 threat vs Lower's
    // 5 + 1: step one places every main scheme's threat before Midtown's completion resolves, §4.1 Q71).
    const midtownEnv = settled.villainArea.find((id) => getInstance(settled, id)?.cardId === cardId("27118b"));
    expect(midtownEnv).toBeDefined();
    expect(getInstance(settled, midtownEnv!)!.counters["glider"] ?? 0).toBe(0);
    expect(gliderOn(settled)).toBe("Upper Manhattan");
    expect(completeMidtown(0, 5).outcome).toBeNull();
    expect(gliderOn(completeMidtown(0, 5))).toBe("Lower Manhattan");
  });

  it("a tie for the least threat is broken by the first player's choice (MC27 p. 21 FAQ)", () => {
    const base = venomGoblin();
    const lower = schemeNamed(base, "Lower Manhattan");
    const upper = schemeNamed(base, "Upper Manhattan");
    // Step one places every main scheme's threat before any completion resolves (docs/phase7-wave5.md §4.1 Q71, "All
    // first"), so at Midtown's completion Lower and Upper both have 0 + 1, a tie. Checked against the
    // `targetChosen` event for 27118b's own "gliderTo" choice specifically, not the round's own final `gliderOn()`:
    // with Venom Goblin (villain.ts) now scripted, the *same* round's own villain-phase step two also activates him
    // against the player, dealing his own scheme threat to whichever scheme just got the glider (the scenario's own
    // "the main scheme is the one with the glider counter" rule) and then firing his own Forced Response, which
    // recomputes the least-threat scheme all over again and can move the glider a second time — a real, separate
    // tie-break this test doesn't own (`villain.test.ts`'s own coverage).
    let state = patchInstance(base, schemeNamed(base, "Midtown Manhattan"), { threat: 11 });
    state = patchInstance(state, lower, { threat: 0 });
    state = patchInstance(state, upper, { threat: 0 });
    const gliderChoiceTarget = (pick: typeof firstLegal) => {
      // The threat on Lower and Upper when the first player is asked where the glider goes.
      let atChoice: readonly number[] | null = null;
      const recording: typeof firstLegal = (current) => {
        const prompt = current.pendingChoice?.prompt;
        if (atChoice === null && prompt?.kind === "chooseTarget" && prompt.slot === "gliderTo")
          atChoice = [getInstance(current, lower)!.threat, getInstance(current, upper)!.threat];
        return pick(current);
      };
      const { events } = driveEventsPicking(WAVE5_DEPS, state, recording, endTurn(P1));
      const chosen = events.find((e) => e.type === "targetChosen" && e.slot === "gliderTo");
      if (!chosen || chosen.type !== "targetChosen") throw new Error("no gliderTo choice was made");
      return { target: chosen.instanceIds[0], atChoice };
    };
    expect(gliderChoiceTarget(picking(lower))).toEqual({ target: lower, atChoice: [1, 1] });
    expect(gliderChoiceTarget(picking(upper))).toEqual({ target: upper, atChoice: [1, 1] });
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

/** Plays `config` to an outcome with the greedy driver and checks the log replays to the same final state — the
 * `sinister-six/scenario.test.ts` `playAndReplay` precedent. */
function playAndReplay(config: GameSetupConfig) {
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  return result;
}

const BOMB_SCARE = [encounterSetId("bomb_scare")];

test("Venom Goblin, solo: Ghost-Spider", () => {
  playAndReplay(
    wave5Scenario("venom-goblin", {
      seed: 2029,
      players: [{ starterDeckId: "ghost-spider" }],
      modularSetIds: BOMB_SCARE,
    }),
  );
}, 120_000);

test("Venom Goblin, solo: a Core precon (Captain Marvel / Leadership)", () => {
  playAndReplay(
    wave5Scenario("venom-goblin", {
      seed: 2030,
      players: [{ starterDeckId: "core-captain-marvel-leadership" }],
      modularSetIds: BOMB_SCARE,
    }),
  );
}, 120_000);

test("Venom Goblin, 2 players: Spider-Man (Miles Morales) and Ghost-Spider", () => {
  playAndReplay(
    wave5Scenario("venom-goblin", {
      seed: 2031,
      players: [{ starterDeckId: "spider-man-morales" }, { starterDeckId: "ghost-spider" }],
      modularSetIds: BOMB_SCARE,
    }),
  );
}, 180_000);
