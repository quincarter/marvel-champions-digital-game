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

import type { ChoiceId, Command, EngineErrorCode, GameEvent, GameState, IllegalDeck, PlayerId } from "@mc/engine";
import { actingPlayer } from "../engine/acting-player.js";
import { emptyRecord, type GameRecord } from "../engine/game-record.js";
import type { SaveMeta } from "../engine/game-storage.js";
import type { EngineHost, EngineUpdate, LegalActionsFor, SavedGame, SessionConfig } from "../engine/host.js";
import type { BackOutTrailEntry } from "../view/back-out.js";

export type SessionStatus = "idle" | "starting" | "playing" | "failed";

export interface SessionState {
  readonly status: SessionStatus;
  /** The host's command count for `game`; -1 before the first update. */
  readonly version: number;
  readonly game: GameState | null;
  /** The events of the most recent command — what the Board scene animates. */
  readonly lastEvents: readonly GameEvent[];
  /** Prefetched legal actions for the player who must act. */
  readonly legal: LegalActionsFor | null;
  /**
   * Whose side of the table the board shows. It follows whoever must act, and
   * holds on the last actor while the engine is between choices, so the board
   * doesn't blank out mid villain phase.
   */
  readonly perspectiveId: PlayerId | null;
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
  /**
   * Every command this store has dispatched since the game started or was resumed, one entry per command, in
   * order — what `view/back-out.ts`'s `backOutTargetOf` reads to decide whether "Back out" applies to the choice
   * on screen right now. Reset to empty on `start`/`resume` (a resumed game's earlier commands are gone from
   * memory, so nothing from before a resume is ever offered a back-out — the safe default when this store can't
   * see what those commands revealed). Truncated, not reset, by `rewindTo` itself, to the same length as the
   * rewound command count, so a second back-out right after the first still has an accurate trail.
   */
  readonly commandTrail: readonly BackOutTrailEntry[];
}

const INITIAL: SessionState = {
  status: "idle",
  version: -1,
  game: null,
  lastEvents: [],
  legal: null,
  perspectiveId: null,
  inFlight: false,
  error: null,
  setupError: null,
  record: emptyRecord(),
  saveError: null,
  config: null,
  commandTrail: [],
};

export type SessionListener = (state: SessionState) => void;

export class SessionStore {
  #state: SessionState = INITIAL;
  readonly #listeners = new Set<SessionListener>();
  readonly #host: EngineHost;
  readonly #unsubscribeHost: () => void;

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
  resume(gameId: string): Promise<void> {
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
      const result = await this.#host.dispatch(command);
      if (!result.ok) {
        this.#set({ ...this.#state, inFlight: false, error: result.error.message });
        return false;
      }
      // The host's update already landed through #absorb, which cleared inFlight; append this command to the
      // trail after, so it lines up with `commandTrail.length === version` the same way `#absorb` already holds.
      this.#set({
        ...this.#state,
        commandTrail: [
          ...this.#state.commandTrail,
          { playerId: command.playerId, command, events: result.update.events },
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
    this.#set({
      status: "playing",
      version: update.version,
      game: update.state,
      lastEvents: update.events,
      legal: update.legal,
      perspectiveId: toAct ?? this.#state.perspectiveId ?? update.state.firstPlayerId,
      inFlight: false,
      error: null,
      setupError: null,
      record: update.record,
      saveError: update.saveError,
      config: update.config,
      commandTrail: options.commandTrail ?? this.#state.commandTrail,
    });
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
 * the store shouldn't have to import `engine/session-core.js` to recognise it
 * — its own `code`/`illegalDecks` shape is all that matters here.
 */
function setupFailureOf(cause: unknown): SessionState["setupError"] {
  if (!cause || typeof cause !== "object") return null;
  const code = (cause as { code?: unknown }).code;
  const illegalDecks = (cause as { illegalDecks?: unknown }).illegalDecks;
  if (typeof code !== "string" || !Array.isArray(illegalDecks) || illegalDecks.length === 0) return null;
  return { code: code as EngineErrorCode, illegalDecks: illegalDecks as readonly IllegalDeck[] };
}
