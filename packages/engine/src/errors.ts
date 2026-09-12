import type { Command } from "./commands.js";

export type EngineErrorCode =
  | "invalid_setup"
  /**
   * RRG "Unique Icon": a card cannot enter play while it matches a card already in play
   * (see `./unique.ts` for the RRG 1.8 match predicate). Raised by `createGame` when two
   * seats pick matching identities, by `playCard`, and by the cost pick of an ability that
   * would put a matching card into play.
   *
   * Distinct from `invalid_setup` because it is a legal-but-conflicting *player* choice
   * rather than a malformed config, so a client can route it to "pick a different hero".
   * Distinct from `no_valid_target` because that code also carries `playRestrictions`
   * failures ("Max 1 per player"), which are a different, per-controller rule. Either way
   * `message` is written to be shown verbatim.
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
