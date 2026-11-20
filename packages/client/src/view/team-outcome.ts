/**
 * A finished game's result for the seats one device plays (issue #883).
 *
 * A cooperative game has one result for the whole table: the engine's `win`, `loss` or `conceded`. A competitive game
 * (Civil War, MC56 p. 17) ends with `result: "teams"`, one result per team, so each device reads the result of the
 * team its seats are on. Every reader of an outcome (the save's status, the game-over tone, the board and pause labels,
 * Discord presence, results history, past games and player stats) goes through this one mapping, so a competitive
 * win, loss or tie is counted the same way everywhere and a tie is never counted as a loss.
 *
 * Whose seats: `SessionConfig.localSeats` in a Competitive room game (the engine players this device holds), a
 * perspective player on the board. With no seat known, or seats on both teams (one person playing both sides at one
 * device), no single team's result is this device's: both teams losing is a loss, anything else reads as a tie, since
 * that person both won and lost.
 */

import type { GameOutcome, GameState } from "@mc/engine";

export type SeatResult = "win" | "loss" | "tie" | "conceded";

/** The result of `outcome` for the seats `viewer` (engine player ids) on one device. */
export function seatResultOf(
  outcome: GameOutcome,
  teams: GameState["teams"],
  viewer: readonly string[] | null | undefined,
): SeatResult {
  if (outcome.result !== "teams") return outcome.result;
  const held = new Set(
    (teams ?? [])
      .filter((team) => viewer?.some((id) => (team.playerIds as readonly string[]).includes(id)))
      .map((team) => team.teamId),
  );
  if (held.size === 1) {
    const [teamId] = held;
    return outcome.teams.find((team) => team.teamId === teamId)?.result ?? "tie";
  }
  return outcome.decision === "bothLose" ? "loss" : "tie";
}

/** `seatResultOf` for a state, or null while the game is still going. */
export const seatResultOfState = (
  state: Pick<GameState, "outcome" | "teams">,
  viewer: readonly string[] | null | undefined,
): SeatResult | null => (state.outcome ? seatResultOf(state.outcome, state.teams, viewer) : null);

/** The status line word for a finished game: three cooperative results, plus a competitive tie. */
export const seatResultLabel = (result: SeatResult): "Victory" | "Defeat" | "Conceded" | "Tie" =>
  result === "win" ? "Victory" : result === "conceded" ? "Conceded" : result === "tie" ? "Tie" : "Defeat";
