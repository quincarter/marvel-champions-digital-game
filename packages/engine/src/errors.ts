import type { Command } from "./commands.js";

export type EngineErrorCode =
  | "invalid_setup"
  /**
   * RRG "Unique": "The players as a group are permitted to have only one copy of each
   * unique card (by title) in play." Distinct from `invalid_setup` because it is the one
   * setup failure caused by a legal-but-conflicting *player* choice rather than by a
   * malformed config, so a client can route it to a "pick a different hero" prompt and
   * show `message` verbatim.
   */
  | "duplicate_unique_card"
  | "game_over"
  | "choice_pending"
  | "no_choice_pending"
  | "invalid_choice"
  | "wrong_phase"
  | "not_active_player"
  | "unknown_player"
  | "unknown_instance"
  | "unknown_card"
  | "card_not_in_zone"
  | "wrong_form"
  | "already_changed_form"
  | "already_exhausted"
  | "no_valid_target"
  | "insufficient_resources"
  | "card_type_not_playable"
  | "unknown_ability"
  | "limit_reached"
  | "internal_error";

export interface EngineError {
  readonly code: EngineErrorCode;
  readonly message: string;
  readonly command: Command | null;
}

export class EngineInvariantError extends Error {}

export const engineError = (
  code: EngineErrorCode,
  message: string,
  command: Command | null = null,
): EngineError => ({ code, message, command });
