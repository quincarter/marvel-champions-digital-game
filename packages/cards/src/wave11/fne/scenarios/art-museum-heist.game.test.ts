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
 * The Art Museum Heist scenario against Hammerhead (docs/phase7-wave11-scenarios.md section S7, task S7), built by
 * `wave11Scenario("art-museum-heist", { villainSetId: "hammerhead", ... })` and played whole by the greedy driver
 * (testing/driver.ts, which knows no card names): Core's Spider-Man (Justice) and Captain Marvel (Leadership), standard
 * mode, the recommended modular sets (Cops and The Owl).
 *
 * - The loss is a plain seeded game: the greedy driver cannot keep the museum's pieces off the villain, and the main
 *   scheme (target 9 per hero, accelerating by 1 per hero per piece on the villain) completes.
 * - The win starts the same game with Hammerhead already on his last stage, one hit point from defeat, no tough card:
 *   the greedy driver's first attack ends the game.
 *
 * Each game must end with no pending prompt, replay deep-equal from its log (`replay`) and command by command
 * (`sessionApply`), and run twice to the same end state.
 */
const SEATS = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];
const ARTS = ["60122", "60123", "60124", "60125"];

function config(seed: number, players: number) {
  return wave11Scenario("art-museum-heist", {
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

const artOnVillain = (s: GameState): string[] => {
  const villain = s.activeVillainId!;
  return inst(s, villain)
    .attachments.map((i) => inst(s, i as InstanceId).cardId as string)
    .filter((c) => ARTS.includes(c));
};

describe("Art Museum Heist against Hammerhead (standard), greedy driver", () => {
  it("setup: the villain starts with one Art attachment; the other three are in the encounter deck", () => {
    const created = opening(7, 2);
    const ready = settle(created, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
    expect(artOnVillain(ready)).toHaveLength(1);
    const inDeck = Object.values(ready.instances).filter(
      (i) => ARTS.includes(i.cardId as string) && i.home.kind === "encounterDeck" && !i.attachedTo,
    );
    expect(inDeck).toHaveLength(3);
  });

  for (const [seed, players] of [
    [1, 1],
    [2, 2],
  ] as const) {
    it(`a loss, seed ${seed}, ${players} player(s): the main scheme completes; replays deep-equal and the same seed ends the same`, () => {
      const first = playGame(opening(seed, players));
      expect(first.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
      expect(playGame(opening(seed, players)).state).toEqual(first.state);
    });
  }

  it("a win, seed 3: Hammerhead on his last stage with one hit point left is defeated; replays deep-equal", () => {
    const start = opening(3, 2, true);
    const villain = start.activeVillainId!;
    const first = playGame(start);
    expect(first.outcome).toEqual({ result: "win", reason: "villainDefeated" });
    // The hit that ended it: his damage reached his hit points.
    expect(inst(first.state, villain).damage).toBeGreaterThanOrEqual(
      characterProfile(start, villain, WAVE11_DEPS)!.maxHp,
    );
    expect(playGame(opening(3, 2, true)).state).toEqual(first.state);
  });
});
