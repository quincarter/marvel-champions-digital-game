/**
 * A competitive game's end as this device reads it (issue #883): the game-over tone (a tie is its own neutral tone,
 * never "Where it went wrong") and the board's step label, which reads the same seats as the pause screen
 * (`SessionConfig.localSeats`; none in a hot-seat game).
 */
import { applyCommand, DEFAULT_DEPS, playerId, type GameOutcome, type GameState } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import type { SessionConfig } from "../engine/host.js";
import { emptyRecord } from "../engine/game-record.js";
import { boardModel } from "./board-model.js";
import { gameOverModel } from "./game-over-model.js";
import { pauseStatusOf } from "./pause-model.js";

const TEAM_TESTING = import.meta.glob("../../../engine/src/testing/team.ts");
interface TeamTesting {
  readonly competitiveGame: (options?: { readonly sizes?: readonly [number, number] }) => GameState;
}

const P1 = playerId("p1");
const config = (localSeats?: readonly string[]): SessionConfig => ({
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "x" }, { starterDeckId: "y" }] as SessionConfig["players"],
  seed: 1,
  ...(localSeats ? { localSeats } : {}),
});

let start: GameState;
beforeAll(async () => {
  const { competitiveGame } = (await Object.values(TEAM_TESTING)[0]!()) as TeamTesting;
  start = competitiveGame();
});

const ended = (outcome: GameOutcome): GameState => ({ ...start, outcome });
const teamsOutcome = (decision: "win" | "tie", one: "win" | "loss" | "tie", two: "win" | "loss" | "tie") =>
  ({
    result: "teams",
    reason: "competitiveEnded",
    decision,
    teams: [
      { teamId: start.teams![0]!.teamId, side: "registration", result: one, conditions: [] },
      { teamId: start.teams![1]!.teamId, side: "resistance", result: two, conditions: [] },
    ],
  }) as unknown as GameOutcome;

describe("the game-over tone of a competitive game", () => {
  test("a tie has its own tone, and is told as how it went, not where it went wrong", () => {
    const model = gameOverModel(ended(teamsOutcome("tie", "tie", "tie")), emptyRecord(), config(["p1"]), DEFAULT_DEPS);
    expect(model.tone).toBe("tie");
    expect(model.beatsHeading).toBe("How it ended");
  });

  test("this device's team winning is a win; the other team's device reads a loss", () => {
    const state = ended(teamsOutcome("win", "win", "loss"));
    expect(gameOverModel(state, emptyRecord(), config(["p1"]), DEFAULT_DEPS).tone).toBe("win");
    const loser = gameOverModel(state, emptyRecord(), config(["p2"]), DEFAULT_DEPS);
    expect(loser.tone).toBe("loss");
    expect(loser.beatsHeading).toBe("How it ended");
  });
});

describe("the board's step label reads the pause screen's seats", () => {
  test("hot seat (no local seats): a team's forfeit reads Conceded on both, never one seat's Victory or Defeat", () => {
    const result = applyCommand(start, { type: "concede", playerId: P1 });
    if (!result.ok) throw new Error(result.error.message);
    const board = boardModel(result.state, P1, DEFAULT_DEPS, null, "played", null);
    expect(board.stepLabel).toBe("Conceded");
    expect(board.stepLabel).toBe(pauseStatusOf(result.state, P1, config(), []).phaseLabel);
  });

  test("a room game: the device's own team result, on the board as on the pause screen", () => {
    const state = ended(teamsOutcome("win", "loss", "win"));
    const board = boardModel(state, P1, DEFAULT_DEPS, null, "played", ["p1"]);
    expect(board.stepLabel).toBe("Defeat");
    expect(board.stepLabel).toBe(pauseStatusOf(state, P1, config(["p1"]), []).phaseLabel);
  });

  test("a competitive win has no Table MVP row, which would sit under the phone's buttons", () => {
    const state = ended(teamsOutcome("win", "win", "loss"));
    const record = {
      ...emptyRecord(),
      seats: [{ playerId: P1, damage: 9, thwart: 0, cardsPlayed: 1, defeatedInRound: null, satOut: false }],
    } as unknown as ReturnType<typeof emptyRecord>;
    expect(gameOverModel(state, record, config(["p1"]), DEFAULT_DEPS).mvp).toBeNull();
  });
});
