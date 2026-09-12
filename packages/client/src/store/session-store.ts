/**
 * One store, one dispatch.
 *
 * A plain TypeScript store with no Phaser imports: it holds the latest
 * read-only copy of the game and is the only thing scenes subscribe to. Every
 * command leaves through `dispatch`, which hands it to the `EngineHost`
 * (PLAN.md Phase 4). The store never decides legality and never mutates a game
 * state — it only records what the host published.
 */

import type { ChoiceId, Command, GameEvent, GameState, PlayerId } from "@mc/engine";
import { actingPlayer } from "../engine/acting-player.js";
import type { EngineHost, EngineUpdate, LegalActionsFor, SavedGame, SessionConfig } from "../engine/host.js";

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

  async start(config: SessionConfig): Promise<void> {
    this.#set({ ...INITIAL, status: "starting" });
    try {
      await this.#host.start(config);
      this.#set({ ...this.#state, status: "playing" });
    } catch (cause) {
      this.#set({ ...this.#state, status: "failed", error: message(cause) });
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
      // The host's update already landed through #absorb, which cleared inFlight.
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

  dispose(): void {
    this.#unsubscribeHost();
    this.#listeners.clear();
  }

  #absorb(update: EngineUpdate): void {
    // An out-of-order reply for an older command must never overwrite newer state.
    if (update.version < this.#state.version) return;
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
    });
  }

  #set(next: SessionState): void {
    this.#state = next;
    for (const listener of [...this.#listeners]) listener(next);
  }
}

const message = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));
