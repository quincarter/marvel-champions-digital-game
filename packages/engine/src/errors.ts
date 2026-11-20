import type { Command } from "./commands.js";
import type { DeckProblem } from "./deck.js";
import type { AbilityId } from "@mc/content";
import type { InstanceId, PlayerId } from "./ids.js";

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
  /**
   * The setup asks for a game mode this engine does not play yet: `GameSetupConfig.gameMode: "competitive"`
   * (docs/phase7-wave10.md §1.9). Raised by `createGame` before anything else is judged, so the message never depends
   * on what else is wrong. `message` is written to be shown verbatim.
   */
  | "mode_unavailable"
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
  /**
   * `endTurn` while the ending player has a "Forced Action" they could trigger (RRG 1.8 "Action", p. 6: it "must be
   * resolved before the player phase can end"; docs/phase7-wave9.md §3.53). `EngineError.forcedActions` names them.
   */
  | "forced_action_outstanding"
  /** `externalEvent` or `remotePower` in a game whose pod has no remote coordinator (docs/phase7-wave9.md §3.68). */
  | "no_remote_coordinator"
  /** `externalEvent` whose `sequence` is not the next one: a re-send already applied, or a gap the host must fill. */
  | "external_event_out_of_order"
  /** An action while this group has stopped play after the shared scheme's completion (MC55 p. 21; `PodState.halted`). */
  | "pod_halted"
  /** An action while this group waits for the coordinator to answer its shared event (`PodState.awaiting`). */
  | "pod_waiting"
  | "internal_error";

export interface EngineError {
  readonly code: EngineErrorCode;
  readonly message: string;
  readonly command: Command | null;
  /** Present only on `forced_action_outstanding`: the abilities the player must trigger first. */
  readonly forcedActions?: readonly { readonly instanceId: InstanceId; readonly abilityId: AbilityId }[];
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
