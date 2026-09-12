/**
 * The engine, driven. Both hosts run exactly this — the worker on its own
 * thread, the local host in-thread — so a game behaves identically in Vitest
 * and in the browser.
 *
 * It owns the one `GameSession` and its log, and after every state change it
 * computes `legalActions` for the player who must act, so highlighting is ready
 * before the player looks (PLAN.md Phase 4, "legal moves are computed ahead of
 * time"). It never touches the DOM, Phaser, or `postMessage`.
 */

import { CORE_DEPS, coreScenario } from "@mc/cards";
import {
  createGame,
  legalActions as queryLegalActions,
  sessionApply,
  startSession,
  type Command,
  type EngineError,
  type GameEvent,
  type GameSession,
  type GameState,
  type LegalActions,
  type PlayerId,
} from "@mc/engine";
import { actingPlayer } from "./acting-player.js";
import type { CardPool, LegalActionsFor, SavedGame, SessionConfig, StateWithoutPool } from "./host.js";

/** An update as it crosses a thread boundary: no card pool, so it stays ~68 KB. */
export interface Snapshot {
  readonly version: number;
  readonly state: StateWithoutPool;
  readonly events: readonly GameEvent[];
  readonly legal: LegalActionsFor | null;
}

export type CoreDispatch =
  | { readonly ok: true; readonly snapshot: Snapshot }
  | { readonly ok: false; readonly error: EngineError };

/** Splits the card pool off a state; the host re-attaches it on the other side. */
const stripPool = (state: GameState): StateWithoutPool => {
  const { cardPool: _cardPool, ...rest } = state;
  return rest;
};

export class EngineSessionCore {
  #session: GameSession | null = null;
  /** The command count, which is also the version every update is stamped with. */
  #version = 0;

  /** Builds the Core scenario and runs RRG setup. Throws with the engine's message. */
  start(config: SessionConfig): { readonly cardPool: CardPool; readonly snapshot: Snapshot } {
    const setup = createGame(
      coreScenario(config.scenarioId, {
        difficulty: config.difficulty,
        players: config.players,
        seed: config.seed,
        ...(config.modularSetIds ? { modularSetIds: config.modularSetIds } : {}),
        ...(config.firstPlayerIndex !== undefined ? { firstPlayerIndex: config.firstPlayerIndex } : {}),
      }),
      CORE_DEPS,
    );
    if (!setup.ok) throw new Error(`setup failed: ${setup.error.message}`);

    this.#session = startSession(setup.state);
    this.#version = 0;
    return {
      cardPool: setup.state.cardPool,
      snapshot: this.#snapshot(setup.events),
    };
  }

  dispatch(command: Command): CoreDispatch {
    const session = this.#require();
    const result = sessionApply(session, command, CORE_DEPS);
    if (!result.ok) return { ok: false, error: result.error };
    this.#session = result.session;
    this.#version += 1;
    return { ok: true, snapshot: this.#snapshot(result.events) };
  }

  legalActions(playerId: PlayerId): LegalActions {
    return queryLegalActions(this.#require().state, playerId, CORE_DEPS);
  }

  save(): SavedGame {
    const { log } = this.#require();
    return { initialState: log.initialState, commands: log.commands };
  }

  get version(): number {
    return this.#version;
  }

  #snapshot(events: readonly GameEvent[]): Snapshot {
    const { state } = this.#require();
    const toAct = actingPlayer(state);
    return {
      version: this.#version,
      state: stripPool(state),
      events,
      legal: toAct ? { playerId: toAct, actions: queryLegalActions(state, toAct, CORE_DEPS) } : null,
    };
  }

  #require(): GameSession {
    if (!this.#session) throw new Error("the engine session has not been started");
    return this.#session;
  }
}
