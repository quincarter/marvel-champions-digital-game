/**
 * What the achievements need to know about a finished game, kept on its save row (`SaveMeta.summary`).
 *
 * Everything else an achievement reads (outcome, scenario, heroes, round) is already on the row; these are the counts
 * it isn't: why a loss happened, how many heroes fell, how a winning hero stood at the end, and whether an ally was
 * ever played. Derived from the engine's final state and the game record (`game-record.ts`, itself folded from the
 * engine's events), never decided here. Plain data, so it stores and structured-clones as is.
 *
 * Pure: no storage, no Phaser. A game still being played has no summary (null).
 */
import { remainingHitPoints, type EngineDeps, type GameState } from "@mc/engine";
import type { GameRecord } from "./game-record.js";

/** Why a game was lost, in the terms the "Read the Room" and "Respawn Pending" achievements care about. */
export type LossReason = "playersDefeated" | "schemeCompleted" | "conceded" | "other";

/** A seat standing when the game was won. */
export interface WinningSeat {
  /** The seat's identity card id (the hero a "Win with X" achievement names). */
  readonly identityCardId: string;
  /** Hit points left on the identity at the win; null when the engine can't say. */
  readonly hitPoints: number | null;
  /** True when the seat ended in hero form, false in alter-ego form. */
  readonly inHeroForm: boolean;
}

export interface GameSummary {
  /** Null for a win. */
  readonly lossReason: LossReason | null;
  /** Identity defeats during the game: seats eliminated by play, not seats that sat the scenario out. */
  readonly heroesDefeated: number;
  /** The seats still standing at a win; empty for any other result. */
  readonly winners: readonly WinningSeat[];
  /** Allies played by any seat, over the whole game. */
  readonly alliesPlayed: number;
}

const lossReasonOf = (outcome: NonNullable<GameState["outcome"]>): LossReason | null => {
  if (outcome.result === "win") return null;
  if (outcome.result === "conceded") return "conceded";
  if (outcome.result !== "loss") return "other";
  if (outcome.reason === "mainSchemeCompleted") return "schemeCompleted";
  if (outcome.reason === "allPlayersDefeated") return "playersDefeated";
  return "other";
};

/** The summary of a finished game, or null while the game is still being played. */
export function summarizeGame(state: GameState, record: GameRecord, deps?: EngineDeps): GameSummary | null {
  const outcome = state.outcome;
  if (!outcome) return null;
  const won = outcome.result === "win";
  return {
    lossReason: lossReasonOf(outcome),
    heroesDefeated: record.seats.filter((seat) => seat.defeatedInRound !== null).length,
    winners: won
      ? state.players
          .filter((player) => !player.eliminated)
          .map((player) => ({
            identityCardId: player.identity.cardId as string,
            hitPoints: remainingHitPoints(state, player.identity.instanceId, deps) ?? null,
            inHeroForm: player.identity.form === "hero",
          }))
      : [],
    alliesPlayed: record.seats.reduce((sum, seat) => sum + (seat.alliesPlayed ?? 0), 0),
  };
}
