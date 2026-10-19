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

vi.setConfig({ testTimeout: 900_000 });

/**
 * The Protection Racket scenario against Hammerhead (docs/phase7-wave11-scenarios.md section S7, task S9), built by
 * `wave11Scenario("protection-racket", { villainSetId: "hammerhead", mainSchemePicks, ... })` and played whole by the
 * greedy driver (testing/driver.ts, which knows no card names): Core's Spider-Man (Justice) and Captain Marvel
 * (Leadership), one main scheme each, the recommended modular sets.
 *
 * - The loss is a plain seeded game: the schemes (target 10 each, accelerating by 1 each round) outrun the greedy
 *   driver and one completes (the elimination half of every 1B is proven in `protection-racket.test.ts`).
 * - The win starts the same game with Hammerhead already on his last stage, one hit point from defeat, no tough card.
 * - The expert game draws the two schemes from the seed (no picks), and plays to whatever end it reaches.
 *
 * Each game must end with no pending prompt, replay deep-equal from its log (`replay`) and command by command
 * (`sessionApply`), and run twice to the same end state.
 */
const SEATS = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];
const SCHEMES = ["60134a", "60135a", "60136a", "60137a", "60138a"];

function config(seed: number, players: number, picks: readonly string[], difficulty: "standard" | "expert") {
  return wave11Scenario("protection-racket", {
    villainSetId: "hammerhead",
    players: SEATS.slice(0, players),
    seed,
    difficulty,
    ...(difficulty === "standard" ? { mainSchemePicks: picks.slice(0, players) } : {}),
  } as never);
}

function opening(
  seed: number,
  players: number,
  picks: readonly string[],
  difficulty: "standard" | "expert" = "standard",
  nearlyDefeated = false,
): GameState {
  const base = config(seed, players, picks, difficulty);
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
  const run = playToOutcome(initial, WAVE11_DEPS, { maxCommands: 6000 });
  const s = run.session.state;
  expect(run.outcome, `no outcome after ${run.commands} commands, round ${run.rounds}`).not.toBeNull();
  expect(s.pendingChoice, "a prompt is still open at the end").toBeNull();
  const replayed = replay(run.session.log, WAVE11_DEPS);
  if (!replayed.ok) throw new Error(`replay failed: ${replayed.error.message}`);
  expect(replayed.state, "replay diverged").toEqual(s);
  expect(walk(run.session), "the command-by-command walk diverged").toEqual(s);
  return { state: s, outcome: run.outcome! };
}

/** The card ids of the main schemes in play, one per player, in seat order. */
const schemesOf = (s: GameState) => [s.mainScheme, ...(s.extraMainSchemes ?? [])];
const schemesInPlay = (s: GameState): string[] =>
  schemesOf(s)
    .sort((a, b) => String(a.playArea).localeCompare(String(b.playArea)))
    .map((m) => inst(s, m.instanceId as InstanceId).cardId as string);

describe("Protection Racket against Hammerhead, greedy driver", () => {
  it("setup: each seat holds its own pick; the other three are set aside", () => {
    const s = settle(opening(5, 2, ["60137a", "60138a"]), firstLegal, (st) => st.step.phase === "player", WAVE11_DEPS);
    expect(schemesInPlay(s)).toEqual(["60137a", "60138a"]);
    expect(s.encounterSetAside.map((i) => inst(s, i).cardId as string).sort()).toEqual(["60134a", "60135a", "60136a"]);
  });

  for (const [seed, picks] of [
    [1, ["60134a", "60136a"]],
    [2, ["60135a", "60137a"]],
  ] as const) {
    it(`a loss, seed ${seed}, 2 players (${picks.join(" + ")}): replays deep-equal and the same seed ends the same`, () => {
      const first = playGame(opening(seed, 2, picks));
      // The greedy driver cannot keep up with two schemes accelerating by 1 a round: one reaches its target of 10.
      expect(first.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
      const completed = schemesOf(first.state).filter(
        (m) => inst(first.state, m.instanceId as InstanceId).threat >= 10,
      );
      expect(completed.length, "a scheme reached its target threat").toBeGreaterThanOrEqual(1);
      expect(playGame(opening(seed, 2, picks)).state).toEqual(first.state);
    });
  }

  it("a win, seed 3: Hammerhead on his last stage with one hit point left is defeated; replays deep-equal", () => {
    const start = opening(3, 2, ["60137a", "60138a"], "standard", true);
    const villain = start.activeVillainId!;
    const first = playGame(start);
    expect(first.outcome).toEqual({ result: "win", reason: "villainDefeated" });
    expect(inst(first.state, villain).damage).toBeGreaterThanOrEqual(
      characterProfile(start, villain, WAVE11_DEPS)!.maxHp,
    );
    expect(playGame(opening(3, 2, ["60137a", "60138a"], "standard", true)).state).toEqual(first.state);
  });

  it("expert mode, seed 4: the two schemes are drawn at random from the five, and the game plays to an end", () => {
    const start = opening(4, 2, [], "expert");
    const ready = settle(start, firstLegal, (st) => st.step.phase === "player", WAVE11_DEPS);
    const drawn = schemesInPlay(ready);
    expect(new Set(drawn).size, "two different schemes").toBe(2);
    for (const code of drawn) expect(SCHEMES).toContain(code);
    // The draw comes from the seed: other seeds give other pairs, the same seed the same pair.
    const pairs = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8])
      pairs.add(
        schemesInPlay(
          settle(opening(seed, 2, [], "expert"), firstLegal, (st) => st.step.phase === "player", WAVE11_DEPS),
        ).join(),
      );
    expect(pairs.size).toBeGreaterThan(1);
    expect(
      schemesInPlay(settle(opening(4, 2, [], "expert"), firstLegal, (st) => st.step.phase === "player", WAVE11_DEPS)),
    ).toEqual(drawn);
    const first = playGame(start);
    expect(["win", "loss"]).toContain(first.outcome.result);
    expect(playGame(opening(4, 2, [], "expert")).state).toEqual(first.state);
  });
});
