/**
 * One store, one dispatch.
 *
 * A plain TypeScript store with no Phaser imports: it holds the latest
 * read-only copy of the game and is the only thing scenes subscribe to. Every
 * command leaves through `dispatch`, which hands it to the `EngineHost`
 * (PLAN.md Phase 4). The store never decides legality and never mutates a game
 * state — it only records what the host published.
 *
 * Saved games live behind the host too: the host writes each command as it
 * lands, and `resume` asks it to replay a stored log. The store only carries
 * what the host reports about that — the game's `record` and any `saveError`.
 */

import {
  type ChoiceId,
  type Command,
  type EngineErrorCode,
  type GameEvent,
  type IllegalDeck,
  type PlayerId,
  type SealedGameState,
} from "@mc/engine";
import { sealForTable } from "../view/hidden-reverse.js";
import { runBeforeResume } from "./resume-hook.js";
import { hasOffTurnAction } from "../view/highlights.js";
import { actingPlayer } from "../engine/acting-player.js";
import { emptyRecord, type GameRecord } from "../engine/game-record.js";
import type { SaveMeta } from "../engine/game-storage.js";
import type { EngineHost, EngineUpdate, LegalActionsFor, SavedGame, SessionConfig } from "../engine/host.js";
import type { BackOutTrailEntry } from "../view/back-out.js";
import type { PaymentState } from "../view/payment-model.js";
import type { JudgedPayment } from "../view/payment-verdict.js";

export type SessionStatus = "idle" | "starting" | "playing" | "failed";

export interface SessionState {
  readonly status: SessionStatus;
  /** The host's command count for `game`; -1 before the first update. */
  readonly version: number;
  /**
   * The game as the table may read it: sealed (`sealForTable`), so it has no hidden pile's cards, no hidden reverse
   * and no sealed campaign value. Every engine query and preview accepts it as a `GameState`.
   */
  readonly game: SealedGameState | null;
  /** The events of the most recent command — what the Board scene animates. */
  readonly lastEvents: readonly GameEvent[];
  /**
   * A resumed game's first state only: every event of the game so far, oldest first, so the Board's log opens with
   * the recent lines instead of empty. Empty for a new game and after the first command.
   */
  readonly resumedHistory: readonly GameEvent[];
  /** Prefetched legal actions for the player who must act. */
  readonly legal: LegalActionsFor | null;
  /**
   * Whose side of the table the board shows. It follows whoever must act, and
   * holds on the last actor while the engine is between choices, so the board
   * doesn't blank out mid villain phase.
   */
  readonly perspectiveId: PlayerId | null;
  /**
   * The other seats that hold an Action to offer during the active player's turn (an Action ability or an Action
   * event; RRG 1.8 "Player Turn", pp. 34-35), as the engine lists them. Filled a moment after each update, and empty
   * in a one-seat game, so nothing is queried there.
   */
  readonly offTurnSeats: readonly PlayerId[];
  /**
   * The seat the board is showing on someone else's turn, or null while it shows whoever must act. Set by
   * `takeOffTurnSeat`; `legal` and `perspectiveId` then belong to that seat. Every new update clears it.
   */
  readonly offTurnSeat: PlayerId | null;
  /**
   * True while a command is in flight. The game is turn-based, so locking board
   * input here is invisible, and tweens keep running on the free main thread.
   */
  readonly inFlight: boolean;
  /** The last rejection or host failure, for the advisory banner. Cleared on the next success. */
  readonly error: string | null;
  /**
   * Set when `start`/`resume` failed with `illegal_deck` (`SetupError`,
   * `engine/session-core.ts`) — which seat, and why, so a caller (Title) can
   * route the player to fix that specific deck instead of only showing
   * `error`'s flattened text. Null for every other failure, and cleared on the
   * next attempt.
   */
  readonly setupError: { readonly code: EngineErrorCode; readonly illegalDecks: readonly IllegalDeck[] } | null;
  /** The game so far, as the host folded it from every command. What Game Over reports. */
  readonly record: GameRecord;
  /**
   * Set once the host could not save. Unlike `error` this is not cleared by the
   * next command: the game may no longer survive a refresh, and that stays true.
   */
  readonly saveError: string | null;
  /** The setup the current game came from, whether it was started or resumed. What a rematch reuses. */
  readonly config: SessionConfig | null;
  /** The id the current game is stored under (null before a game or when it isn't saved): what device sync must not overwrite. */
  readonly gameId: string | null;
  /**
   * Every command this store has dispatched since the game started or was resumed, one entry per command, in
   * order — what `view/back-out.ts`'s `backOutTargetOf` reads to decide whether "Back out" applies to the choice
   * on screen right now. Reset to empty on `start`; on `resume` it is rebuilt from the replay (each
   * command's events and RNG draw counts, `EngineUpdate.trail`), so it is as long as `version` and as accurate as a
   * live game's (its turn boundaries and reveals stop Undo just the same). Truncated, not reset, by `rewindTo` itself, to the same length as the
   * rewound command count, so a second back-out right after the first still has an accurate trail.
   */
  readonly commandTrail: readonly BackOutTrailEntry[];
}

const INITIAL: SessionState = {
  status: "idle",
  version: -1,
  game: null,
  lastEvents: [],
  resumedHistory: [],
  legal: null,
  perspectiveId: null,
  offTurnSeats: [],
  offTurnSeat: null,
  inFlight: false,
  error: null,
  setupError: null,
  record: emptyRecord(),
  saveError: null,
  config: null,
  gameId: null,
  commandTrail: [],
};

export type SessionListener = (state: SessionState) => void;

export class SessionStore {
  #state: SessionState = INITIAL;
  readonly #listeners = new Set<SessionListener>();
  readonly #host: EngineHost;
  readonly #unsubscribeHost: () => void;
  /** The host's prefetched legal actions for whoever must act, kept while the board shows an off-turn seat. */
  #activeLegal: LegalActionsFor | null = null;

  constructor(host: EngineHost) {
    this.#host = host;
    this.#unsubscribeHost = host.subscribe((update) => this.#absorb(update));
  }

  get state(): SessionState {
    return this.#state;
  }

  /** Subscribes and immediately delivers the current state. Returns an unsubscribe. */
  subscribe(listener: SessionListener): () => void {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  }

  start(config: SessionConfig): Promise<void> {
    return this.#begin(() => this.#host.start(config));
  }

  /**
   * Picks a saved game back up. A save that no longer replays fails here with
   * the host's reason, and the host has already retired it, so it isn't offered again.
   */
  async resume(gameId: string): Promise<void> {
    // Device sync pulls in a newer copy of this game first (`store/resume-hook.ts`); a no-op when sync is off.
    await runBeforeResume(gameId);
    return this.#begin(() => this.#host.resume(gameId));
  }

  /** The saved game to offer as "Continue", or null. A storage failure is treated as "none". */
  async latestSave(): Promise<SaveMeta | null> {
    try {
      return await this.#host.latestSave();
    } catch {
      return null;
    }
  }

  /** Every resumable game in progress, newest first, without guided lesson saves (the title's list). A storage failure is "none". */
  async activeSaves(): Promise<readonly SaveMeta[]> {
    try {
      return await this.#host.activeSaves();
    } catch {
      return [];
    }
  }

  /** Drops a game from the in-progress list ("abandoned"; it counts as played). Rejects when the write fails. */
  retireSave(gameId: string): Promise<void> {
    return this.#host.retireSave(gameId);
  }

  /** Every saved game (W9's per-deck record and last played, `view/results-history.ts`). A storage failure is treated as "none recorded". */
  async listSaves(): Promise<readonly SaveMeta[]> {
    try {
      return await this.#host.listSaves();
    } catch {
      return [];
    }
  }

  /**
   * The single door out. A rejected command is reported and changes nothing —
   * the engine is the judge, so the client shows its message rather than
   * second-guessing it.
   */
  async dispatch(command: Command): Promise<boolean> {
    if (this.#state.inFlight) return false;
    this.#set({ ...this.#state, inFlight: true });
    try {
      const drawsBefore = this.#state.game?.rng.draws;
      const result = await this.#host.dispatch(command);
      if (!result.ok) {
        this.#set({ ...this.#state, inFlight: false, error: result.error.message });
        return false;
      }
      const drawsAfter = this.#state.game?.rng.draws;
      // The host's update already landed through #absorb, which cleared inFlight; append this command to the
      // trail after, so it lines up with `commandTrail.length === version` the same way `#absorb` already holds.
      this.#set({
        ...this.#state,
        commandTrail: [
          ...this.#state.commandTrail,
          {
            playerId: command.playerId,
            command,
            events: result.update.events,
            ...(drawsBefore !== undefined && drawsAfter !== undefined
              ? { rngDraws: { before: drawsBefore, after: drawsAfter } }
              : {}),
          },
        ],
      });
      return true;
    } catch (cause) {
      this.#set({ ...this.#state, inFlight: false, status: "failed", error: message(cause) });
      return false;
    }
  }

  /**
   * Answers the open choice. Issued as the player the engine names, never as
   * "the human", so a multi-handed solo game's command log is identical to the
   * same game played by four people (PLAN.md Phase 4, hero seats).
   */
  async resolveChoice(selectedOptionIds: readonly string[]): Promise<boolean> {
    const choice = this.#state.game?.pendingChoice;
    if (!choice) return false;
    return this.dispatch({
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId as ChoiceId,
      selectedOptionIds,
    });
  }

  save(): Promise<SavedGame> {
    return this.#host.save();
  }

  /**
   * "Back out" (`view/back-out.ts`): truncates the command log to its first `commandCount` commands and adopts the
   * state that leaves the game in. Forces the update through even though its `version` is *lower* than the one
   * already showing — `#absorb`'s own out-of-order guard exists for a stale worker reply racing a newer command,
   * which is never what this is: the caller (the choice scene's Back out button) has already checked this rewind
   * is legal (`view/back-out.ts`'s own rule) before ever calling this.
   */
  async rewindTo(commandCount: number): Promise<boolean> {
    if (this.#state.inFlight) return false;
    this.#set({ ...this.#state, inFlight: true });
    try {
      const update = await this.#host.rewindTo(commandCount);
      // The trail has one entry per command dispatched so far, in the same order `commandTrail.length ===
      // version` already holds elsewhere in this class — truncating it to the rewound version keeps that true.
      this.#absorb(update, { force: true, commandTrail: this.#state.commandTrail.slice(0, update.version) });
      return true;
    } catch (cause) {
      this.#set({ ...this.#state, inFlight: false, error: message(cause) });
      return false;
    }
  }

  dispose(): void {
    this.#unsubscribeHost();
    this.#listeners.clear();
  }

  /**
   * Shows another seat's side of the table during the active player's turn, with that seat's legal Actions
   * (`notYourTurn`). Only a seat `offTurnSeats` named; the next update puts the board back on whoever must act.
   */
  async takeOffTurnSeat(playerId: PlayerId): Promise<boolean> {
    const { game, version } = this.#state;
    if (!game || this.#state.inFlight || !this.#state.offTurnSeats.includes(playerId)) return false;
    const actions = await this.#host.legalActions(playerId);
    if (this.#state.version !== version || !hasOffTurnAction(actions)) return false;
    this.#set({ ...this.#state, offTurnSeat: playerId, perspectiveId: playerId, legal: { playerId, actions } });
    return true;
  }

  /**
   * The engine's verdict on a pay step's picks (issue #258), judged where the engine runs: off the main thread on the
   * worker host. Tagged with the version it was judged at, so a caller can drop one the game has moved past.
   */
  judgePayment(playerId: PlayerId, payment: PaymentState): Promise<JudgedPayment> {
    return this.#host.judgePayment(playerId, payment);
  }

  /** The same verdict at once, when the host runs the engine on this thread (tests, dev states); null otherwise. */
  judgePaymentNow(playerId: PlayerId, payment: PaymentState): JudgedPayment | null {
    return this.#host.judgePaymentNow?.(playerId, payment) ?? null;
  }

  /** Back to whoever must act, with the legal actions the host prefetched for them. */
  leaveOffTurnSeat(): void {
    const { game, offTurnSeat } = this.#state;
    if (!game || offTurnSeat === null) return;
    this.#set({
      ...this.#state,
      offTurnSeat: null,
      perspectiveId: actingPlayer(game) ?? game.firstPlayerId,
      legal: this.#activeLegal,
    });
  }

  /** Starting and resuming share one shape: reset, ask the host, report its failure verbatim. */
  async #begin(open: () => Promise<EngineUpdate>): Promise<void> {
    this.#set({ ...INITIAL, status: "starting" });
    try {
      await open();
      this.#set({ ...this.#state, status: "playing" });
    } catch (cause) {
      this.#set({ ...this.#state, status: "failed", error: message(cause), setupError: setupFailureOf(cause) });
    }
  }

  #absorb(
    update: EngineUpdate,
    options: { readonly force?: boolean; readonly commandTrail?: readonly BackOutTrailEntry[] } = {},
  ): void {
    // An out-of-order reply for an older command must never overwrite newer state — except a forced absorb
    // (`rewindTo`'s own doc comment), whose entire point is going backwards.
    if (!options.force && update.version < this.#state.version) return;
    const toAct = actingPlayer(update.state);
    this.#activeLegal = update.legal;
    this.#set({
      status: "playing",
      version: update.version,
      // Sealed again here, whatever host produced the update: idempotent.
      game: sealForTable(update.state),
      lastEvents: update.events,
      resumedHistory: update.history ?? [],
      legal: update.legal,
      perspectiveId: toAct ?? this.#state.perspectiveId ?? update.state.firstPlayerId,
      offTurnSeats: [],
      offTurnSeat: null,
      inFlight: false,
      error: null,
      setupError: null,
      record: update.record,
      saveError: update.saveError,
      config: update.config,
      gameId: update.gameId !== undefined ? update.gameId : this.#state.gameId,
      // A resumed game's first update carries the replayed commands' own trail, so `commandTrail.length === version`
      // holds from the first frame and a trail index is always a command count (`rewindTo`'s argument).
      commandTrail: options.commandTrail ?? update.trail ?? this.#state.commandTrail,
    });
    void this.#findOffTurnSeats(update);
  }

  /**
   * Asks the engine which other seats hold an Action during the active player's turn. A one-seat game, a pending
   * choice or any step but a player turn asks nothing. A reply for an older update is dropped.
   */
  async #findOffTurnSeats(update: EngineUpdate): Promise<void> {
    const { state } = update;
    const { step } = state;
    if (state.outcome || state.pendingChoice || state.players.length < 2) return;
    if (step.phase !== "player" || step.kind !== "turn") return;
    const found: PlayerId[] = [];
    try {
      for (const player of state.players) {
        if (player.playerId === step.activePlayerId || player.eliminated) continue;
        if (hasOffTurnAction(await this.#host.legalActions(player.playerId))) found.push(player.playerId);
      }
    } catch {
      return;
    }
    if (this.#state.version !== update.version || this.#state.offTurnSeat !== null || found.length === 0) return;
    this.#set({ ...this.#state, offTurnSeats: found });
  }

  #set(next: SessionState): void {
    this.#state = next;
    for (const listener of [...this.#listeners]) listener(next);
  }
}

const message = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

/**
 * Duck-typed rather than an `instanceof SetupError` check: a worker-hosted
 * game rejects with a plain reconstructed `SetupError` (`worker-host.ts`), but
 * the store shouldn't have to import `engine/session-core.js` to recognize it
 * — its own `code`/`illegalDecks` shape is all that matters here.
 */
function setupFailureOf(cause: unknown): SessionState["setupError"] {
  if (!cause || typeof cause !== "object") return null;
  const code = (cause as { code?: unknown }).code;
  const illegalDecks = (cause as { illegalDecks?: unknown }).illegalDecks;
  if (typeof code !== "string" || !Array.isArray(illegalDecks) || illegalDecks.length === 0) return null;
  return { code: code as EngineErrorCode, illegalDecks: illegalDecks as readonly IllegalDeck[] };
}
