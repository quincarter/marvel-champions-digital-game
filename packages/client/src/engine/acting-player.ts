/**
 * Who the game is waiting on.
 *
 * Both hosts use this to decide whose `legalActions` to compute ahead of time,
 * and the Board scene uses it to decide whose perspective to show — PLAN.md
 * Phase 4: "the board's perspective follows whoever must act."
 */

import type { GameState, PlayerId } from "@mc/engine";

/**
 * The player who must act right now: the one a pending choice is addressed to,
 * else the active player of a player turn. Null while the engine is inside a
 * step that needs no input (the villain phase between choices, end-of-phase
 * bookkeeping) or once the game is over.
 */
export function actingPlayer(state: StateLike): PlayerId | null {
  if (state.outcome) return null;
  if (state.pendingChoice) return state.pendingChoice.playerId;
  const { step } = state;
  if (step.phase === "player" && step.kind === "turn") return step.activePlayerId;
  return null;
}

/** The fields `actingPlayer` reads, so it works on a pool-less state too. */
type StateLike = Pick<GameState, "outcome" | "pendingChoice" | "step">;
