import {
  cardsInPlay,
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
 * The Stop the Presses! scenario against Hammerhead (docs/phase7-wave11-scenarios.md section S7, task S11), built by
 * `wave11Scenario("stop-the-presses", { villainSetId: "hammerhead", ... })` and played whole by the greedy driver
 * (testing/driver.ts, which knows no card names): Core's Spider-Man (Justice) and Captain Marvel (Leadership), standard
 * mode, the recommended modular sets (Tombstone and Tracksuit Mafia).
 *
 * - The loss is a plain seeded game: the driver spends the Daily Bugle supports' stamina counters on their abilities and
 *   the main scheme's choices until a Daily Bugle support is discarded ("leaves play": the players lose).
 * - The win starts the same game with Hammerhead on his last stage, one hit point from defeat and free of status cards:
 *   the greedy driver's first attack ends the game.
 *
 * Each game must end with no pending prompt, replay deep-equal from its log (`replay`) and command by command
 * (`sessionApply`), and run twice to the same end state.
 */
const SEATS = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];
const SUPPORTS = ["60153", "60154", "60155", "60156"];

function config(seed: number, players: number) {
  return wave11Scenario("stop-the-presses", {
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

const supportsInPlay = (s: GameState): number =>
  cardsInPlay(s).filter((i) => SUPPORTS.includes(inst(s, i).cardId as string)).length;

describe("Stop the Presses! against Hammerhead (standard), greedy driver", () => {
  it("setup: the Daily Bugle is in play and each player holds one support with 3 stamina counters", () => {
    const ready = settle(opening(7, 2), firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
    expect(supportsInPlay(ready)).toBe(2);
    expect(cardsInPlay(ready).some((i) => inst(ready, i).cardId === "60152")).toBe(true);
    expect(ready.removedFromGame).toHaveLength(2);
  });

  for (const [seed, players] of [
    [1, 1],
    [2, 2],
  ] as const) {
    it(`a loss, seed ${seed}, ${players} player(s): replays deep-equal and the same seed ends the same`, () => {
      const first = playGame(opening(seed, players));
      // The main scheme (stage 1) is the source: a Daily Bugle support left play, the cause (MC60 p. 21).
      expect(first.outcome).toMatchObject({
        result: "loss",
        reason: "cardAbility",
        sourceInstanceId: first.state.mainScheme.instanceId,
      });
      expect(supportsInPlay(first.state)).toBeLessThan(players);
      expect(playGame(opening(seed, players)).state).toEqual(first.state);
    });
  }

  it("a win, seed 3: Hammerhead on his last stage with one hit point left, the first hit defeats him; replays deep-equal", () => {
    const start = opening(3, 2, true);
    const villain = start.activeVillainId!;
    const first = playGame(start);
    expect(first.outcome).toEqual({ result: "win", reason: "villainDefeated" });
    expect(inst(first.state, villain).damage).toBeGreaterThanOrEqual(
      characterProfile(start, villain, WAVE11_DEPS)!.maxHp,
    );
    expect(supportsInPlay(first.state)).toBe(2);
    expect(playGame(opening(3, 2, true)).state).toEqual(first.state);
  });
});
