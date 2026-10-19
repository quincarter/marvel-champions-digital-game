import {
  characterProfile,
  createGame,
  replay,
  sessionApply,
  startSession,
  type GameOutcome,
  type GameSession,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { playToOutcome } from "../../../testing/driver.js";
import { firstLegal, inst, patchInstance, settle } from "../../../testing/harness.js";
import { WAVE11_DEPS } from "../../index.js";
import { wave11Scenario } from "../../setup.js";

vi.setConfig({ testTimeout: 600_000 });

/**
 * The Getaway scenario against Hammerhead (docs/phase7-wave11-scenarios.md section S6, task S8), built by
 * `wave11Scenario("the-getaway", { villainSetId: "hammerhead", ... })` and played whole by the greedy driver
 * (testing/driver.ts, which knows no card names): Core's Spider-Man (Justice) and Captain Marvel (Leadership), standard
 * mode, the recommended modular sets (Cops and Drive).
 *
 * - The loss is a plain seeded game: the chase speeds up and either the main scheme (target 9 per hero, accelerating
 *   2 per hero a round) completes (two players, seed 2) or the lone hero is defeated first (seed 1).
 * - The win starts the same game with Hammerhead already on his last stage, one hit point from defeat, no tough card,
 *   and the main scheme at no threat with Out Front flipped to Alongside: the heroes are Alongside him, so a hit is
 *   dealt to him and the greedy driver's first attack ends the game. (With Out Front on him a hit removes threat from
 *   the main scheme instead and never reaches his hit points, so a natural win is a long chase.)
 *
 * Each game must end with no pending prompt, replay deep-equal from its log (`replay`) and command by command
 * (`sessionApply`), and run twice to the same end state.
 */
const SEATS = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];
const OUT_FRONT = "60129a";

function config(seed: number, players: number) {
  return wave11Scenario("the-getaway", {
    villainSetId: "hammerhead",
    players: SEATS.slice(0, players),
    seed,
    difficulty: "standard",
  } as never);
}

function opening(seed: number, players: number, nearlyDefeated = false): GameState {
  const base = config(seed, players);
  const lastStage = base.villainLastStageIndex ?? base.villainStartStageIndex ?? 0;
  const created = createGame(nearlyDefeated ? { ...base, villainStartStageIndex: lastStage } : base, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  if (!nearlyDefeated) return created.state;
  const ready = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
  const villain = ready.activeVillainId!;
  const maxHp = characterProfile(ready, villain, WAVE11_DEPS)!.maxHp;
  const hurt = patchInstance(ready, villain, { damage: maxHp - 1, statuses: { stunned: 0, confused: 0, tough: 0 } });
  // The heroes are Alongside him: no threat on the main scheme, Out Front on its Alongside face.
  const front = (Object.keys(hurt.instances) as InstanceId[]).find((i) => inst(hurt, i).cardId === OUT_FRONT)!;
  return patchInstance(patchInstance(hurt, hurt.mainScheme.instanceId, { threat: 0 }), front, { flipped: true });
}

function walk(session: GameSession): GameState {
  let current = startSession(session.log.initialState);
  for (const command of session.log.commands) {
    const result = sessionApply(current, command, WAVE11_DEPS);
    if (!result.ok) throw new Error(`replayed ${command.type} refused: ${result.error.message}`);
    current = result.session;
  }
  return current.state;
}

function playGame(initial: GameState): { state: GameState; outcome: GameOutcome } {
  const run = playToOutcome(initial, WAVE11_DEPS, { maxCommands: 4000 });
  const s = run.session.state;
  expect(run.outcome, `no outcome after ${run.commands} commands, round ${run.rounds}`).not.toBeNull();
  expect(s.pendingChoice, "a prompt is still open at the end").toBeNull();
  const replayed = replay(run.session.log, WAVE11_DEPS);
  if (!replayed.ok) throw new Error(`replay failed: ${replayed.error.message}`);
  expect(replayed.state, "replay diverged").toEqual(s);
  expect(walk(run.session), "the command-by-command walk diverged").toEqual(s);
  return { state: s, outcome: run.outcome! };
}

const speedCounters = (s: GameState): number => inst(s, s.mainScheme.instanceId).counters.speed ?? 0;
const outFrontOn = (s: GameState, id: InstanceId): boolean =>
  inst(s, id).attachments.some((a) => inst(s, a).cardId === OUT_FRONT);

describe("The Getaway against Hammerhead (standard), greedy driver", () => {
  it("setup: Out Front is on the villain, one speed counter is on the main scheme", () => {
    const ready = settle(opening(7, 2), firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
    expect(outFrontOn(ready, ready.activeVillainId!)).toBe(true);
    expect(speedCounters(ready)).toBe(1);
  });

  for (const [seed, players, reason] of [
    [1, 1, "allPlayersDefeated"],
    [2, 2, "mainSchemeCompleted"],
  ] as const) {
    it(`a loss, seed ${seed}, ${players} player(s): ${reason}; replays deep-equal and the same seed ends the same`, () => {
      const first = playGame(opening(seed, players));
      expect(first.outcome).toEqual({ result: "loss", reason });
      // The chase sped up on the way: at least one round end placed speed counters.
      expect(speedCounters(first.state)).toBeGreaterThan(1);
      expect(playGame(opening(seed, players)).state).toEqual(first.state);
    });
  }

  it("a win, seed 3: Alongside a Hammerhead with one hit point left, the first hit defeats him; replays deep-equal", () => {
    const start = opening(3, 2, true);
    const villain = start.activeVillainId!;
    const first = playGame(start);
    expect(first.outcome).toEqual({ result: "win", reason: "villainDefeated" });
    expect(inst(first.state, villain).damage).toBeGreaterThanOrEqual(
      characterProfile(start, villain, WAVE11_DEPS)!.maxHp,
    );
    expect(playGame(opening(3, 2, true)).state).toEqual(first.state);
  });
});
