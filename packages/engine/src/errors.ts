import type { Command } from "./commands.js";

export type EngineErrorCode =
  | "invalid_setup"
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
