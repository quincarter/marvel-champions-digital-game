import type { Command } from "./commands.js";
import type { DeckProblem } from "./deck.js";
import type { PlayerId } from "./ids.js";

export type EngineErrorCode =
  | "invalid_setup"
  /**
   * A seat's deck breaks the RRG deckbuilding rules (`validateDeck` in `./deck.ts`). Raised by
   * `createGame` when `GameSetupConfig.requireLegalDecks` is set. The per-seat reasons are in
   * `EngineError.illegalDecks`.
   *
   * Distinct from `invalid_setup` (a malformed config) and from `duplicate_unique_card` (a
   * table-level conflict between otherwise legal choices), so a client can route it to
   * "fix this deck".
   */
  | "illegal_deck"
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
  /** Present only on `illegal_deck`: each illegal seat's problems, to render verbatim. */
  readonly illegalDecks?: readonly IllegalDeck[];
}

/** One seat whose deck `createGame` refused. */
export interface IllegalDeck {
  readonly seatIndex: number;
  readonly playerId: PlayerId;
  readonly problems: readonly DeckProblem[];
}

export class EngineInvariantError extends Error {}

export const engineError = (code: EngineErrorCode, message: string, command: Command | null = null): EngineError => ({
  code,
  message,
  command,
});
