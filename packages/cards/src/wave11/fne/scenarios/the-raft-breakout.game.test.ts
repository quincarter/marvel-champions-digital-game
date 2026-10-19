import {
  characterProfile,
  createGame,
  replay,
  sessionApply,
  startSession,
  type GameOutcome,
  type GameSession,
  type GameState,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { playToOutcome } from "../../../testing/driver.js";
import { firstLegal, inst, patchInstance, settle } from "../../../testing/harness.js";
import { WAVE11_DEPS } from "../../index.js";
import { wave11Scenario } from "../../setup.js";

vi.setConfig({ testTimeout: 600_000 });

/**
 * The Raft Breakout scenario against Hammerhead (docs/phase7-wave11-scenarios.md section S7, task S10), built by
 * `wave11Scenario("the-raft-breakout", { villainSetId: "hammerhead", ... })` and played whole by the greedy driver
 * (testing/driver.ts, which knows no card names): Core's Spider-Man (Justice) and Captain Marvel (Leadership), standard
 * mode, the recommended modular sets (The Owl and Tombstone).
 *
 * - The loss is a plain seeded game with nothing staged: the main scheme (11 threat per hero, accelerating 1 per hero a
 *   round) completes.
 * - The win starts the same game with Hammerhead already on his last stage, one hit point from defeat and without a
 *   tough status card: the first hit the greedy driver lands on him ends the game. Staged: his stage, his damage and his
 *   status cards. Everything else (Master Key on him, the Prisoner minions each hero revealed in setup, the main scheme
 *   and its threat) is the game as set up.
 *
 * Each game must end with no pending prompt, replay deep-equal from its log (`replay`) and command by command
 * (`sessionApply`), and run twice to the same end state.
 */
const SEATS = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];
const KEY = "60143";

function config(seed: number, players: number) {
  return wave11Scenario("the-raft-breakout", {
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
  return patchInstance(ready, villain, { damage: maxHp - 1, statuses: { stunned: 0, confused: 0, tough: 0 } });
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

describe("The Raft Breakout against Hammerhead (standard), greedy driver", () => {
  it("setup: Master Key is on the villain and each hero has a Prisoner minion engaged", () => {
    const ready = settle(opening(7, 2), firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
    const villain = inst(ready, ready.activeVillainId!);
    expect(villain.attachments.map((a) => inst(ready, a).cardId)).toEqual([KEY]);
    const engaged = Object.values(ready.instances).filter(
      (i) => i.engagedWith !== null && ready.cardPool[i.cardId]?.type === "minion",
    );
    expect(engaged.map((i) => i.engagedWith).sort()).toEqual(["p1", "p2"]);
  });

  for (const [seed, players, reason] of [
    [1, 1, "mainSchemeCompleted"],
    [2, 2, "mainSchemeCompleted"],
  ] as const) {
    it(`a loss, seed ${seed}, ${players} player(s): ${reason}; replays deep-equal and the same seed ends the same`, () => {
      const first = playGame(opening(seed, players));
      expect(first.outcome).toEqual({ result: "loss", reason });
      expect(playGame(opening(seed, players)).state).toEqual(first.state);
    });
  }

  it("a win, seed 3: a Hammerhead with one hit point left falls to the first hit; replays deep-equal", () => {
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
