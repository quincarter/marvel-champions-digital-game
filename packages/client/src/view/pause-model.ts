/**
 * The Pause screen's status line (docs/phase4-screen-gaps.md §3 "W4"): scenario ·
 * difficulty · round · phase · seat, read off the live game the same way the
 * Board's own chrome does — nothing here is a rules fact the engine doesn't
 * already publish, only wording it for a paused player.
 */
import type { GameState, PlayerId } from "@mc/engine";
import type { Scenario } from "@mc/content";
import type { SessionConfig } from "../engine/host.js";
import { playerName } from "./names.js";

export interface PauseStatus {
  readonly scenarioName: string;
  readonly difficultyLabel: string;
  readonly round: number;
  readonly phaseLabel: string;
  readonly seatLabel: string;
}

const DIFFICULTY_LABEL: Record<SessionConfig["difficulty"], string> = {
  standard: "Standard",
  expert: "Expert",
  extreme: "Extreme",
};

/**
 * Mirrors `board-model.ts`'s own `phaseOf` switch, worded for a status line rather
 * than a step label.
 *
 * `GameOutcome` has no `"conceded"` result yet (docs/phase4-screen-gaps.md §2 "S5.9"
 * — the engine's `concede` command is landing in a parallel worktree). Once it does,
 * this switch needs a third arm; see `scenes/pause.ts`'s own concede note for where
 * that lands alongside it.
 */
function phaseLabelOf(state: GameState): string {
  if (state.outcome) return state.outcome.result === "win" ? "Victory" : "Defeat";
  switch (state.step.phase) {
    case "setup":
      return "Setup";
    case "player":
      return "Player phase";
    case "villain":
      return "Villain phase";
    default:
      return "Game over";
  }
}

export function pauseStatusOf(
  game: GameState,
  perspectiveId: PlayerId,
  config: SessionConfig | null,
  scenarios: readonly Scenario[],
): PauseStatus {
  const scenario = config ? scenarios.find((candidate) => candidate.id === config.scenarioId) : undefined;
  return {
    scenarioName: scenario?.name ?? config?.scenarioId ?? "This game",
    difficultyLabel: config ? DIFFICULTY_LABEL[config.difficulty] : "—",
    round: game.round,
    phaseLabel: phaseLabelOf(game),
    seatLabel: playerName(game, perspectiveId),
  };
}
