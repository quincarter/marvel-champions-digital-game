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
 * The Kingpin scenario (docs/phase7-wave11-scenarios.md section S7, task S12), built by `wave11Scenario("kingpin",
 * ...)`
 * and played whole by the greedy driver (testing/driver.ts, which knows no card names): Core's Spider-Man (Justice)
 * and Captain Marvel (Leadership), standard mode, the Kingpin set with Tombstone and Tracksuit Mafia.
 *
 * - The loss is a plain seeded game: Kingpin stays untouchable on his first side (no hero can damage him), so the
 *   driver can only wear the table down until the main scheme or the heroes give out.
 * - The win starts the same game with Public Support at 2[per_hero]+2 counters and Kingpin one hit point from defeat.
 * He
 *   cannot be hurt on his first side, so the game has to get through its first villain phase, where Public Support
 *   flips him and advances the main scheme to 2A (Endgame: every minion gains guard); the driver's attack after that
 *   defeats the villain on his final stage.
 *
 * Each game must end with no pending prompt, replay deep-equal from its log (`replay`) and command by command
 * (`sessionApply`), and run twice to the same end state.
 */
const SEATS = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];

function config(seed: number, players: number) {
  return wave11Scenario("kingpin", { players: SEATS.slice(0, players), seed, difficulty: "standard" } as never);
}

function opening(seed: number, players: number, nearlyDefeated = false): GameState {
  const created = createGame(config(seed, players), WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  if (!nearlyDefeated) return created.state;
  const ready = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
  const villain = ready.activeVillainId!;
  const support = Object.keys(ready.instances).find((i) => inst(ready, i as never).cardId === "60163a")! as never;
  const primed = patchInstance(ready, support, { counters: { support: 2 * players + 2 } });
  const maxHp = characterProfile(primed, villain, WAVE11_DEPS)!.maxHp;
  return patchInstance(primed, villain, { damage: maxHp - 1, statuses: { stunned: 0, confused: 0, tough: 0 } });
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

describe("Kingpin (standard), greedy driver", () => {
  it("setup: Kingpin is untouchable on his first side with Public Support in play on its Low side", () => {
    const ready = settle(opening(5, 2), firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
    const villain = ready.activeVillainId!;
    expect(ready.villains.find((v) => v.instanceId === villain)!.side).toBe("A");
    const support = Object.keys(ready.instances).find((i) => inst(ready, i as never).cardId === "60163a");
    expect(support).toBeDefined();
    expect(inst(ready, support as never).flipped).toBe(false);
  });

  for (const [seed, players] of [
    [1, 1],
    [2, 2],
  ] as const) {
    it(`a loss, seed ${seed}, ${players} player(s): replays deep-equal and the same seed ends the same`, () => {
      const first = playGame(opening(seed, players));
      expect(first.outcome.result).toBe("loss");
      expect(playGame(opening(seed, players)).state).toEqual(first.state);
    });
  }

  it("a win, seed 2, 1 player: Public Support flips Kingpin, then his last hit point is taken; replays deep-equal", () => {
    const start = opening(2, 1, true);
    const villain = start.activeVillainId!;
    const first = playGame(start);
    expect(first.outcome).toEqual({ result: "win", reason: "villainDefeated" });
    // The villain phase flipped him and advanced the main scheme before the blow could land.
    expect(first.state.villains.find((v) => v.instanceId === villain)!.side).toBe("B");
    expect(first.state.mainScheme.stageIndex).toBe(1);
    // The hit that ended it: his damage reached his hit points.
    expect(inst(first.state, villain).damage).toBeGreaterThanOrEqual(
      characterProfile(start, villain, WAVE11_DEPS)!.maxHp,
    );
    expect(playGame(opening(2, 1, true)).state).toEqual(first.state);
  });
});
