/**
 * The engine, driven. Both hosts run exactly this — the worker on its own
 * thread, the local host in-thread — so a game behaves identically in Vitest
 * and in the browser.
 *
 * It owns the one `GameSession` and its log, and after every state change it
 * computes `legalActions` for the player who must act, so highlighting is ready
 * before the player looks (PLAN.md Phase 4, "legal moves are computed ahead of
 * time"). It never touches the DOM, Phaser, or `postMessage`.
 *
 * **Persistence.** With a `GameStorage` it also keeps the game on disk, as a
 * log: the setup config and baseline when a game starts, then each command as
 * it lands. Resuming replays that log through the pure engine, so a game that
 * survives a refresh is the same game to the command, and its `GameRecord` is
 * folded from the same events it would have produced live. The record is never
 * written anywhere — only the log is — so the two can't drift apart.
 *
 * **Setup failures keep their engine error code.** `createGame` refuses an
 * illegal deck with `illegal_deck` and its own per-seat `illegalDecks`
 * (PLAN.md Phase 9: "a client can route it to 'fix this deck'"). Throwing a
 * plain `Error` here would flatten that down to a message string before the
 * client ever saw it, so `start`/`resume` throw `SetupError` instead, which
 * keeps `code` and `illegalDecks` alongside the message. `engine.worker.ts`
 * forwards those two fields on its `failed` reply so a worker-hosted game
 * loses nothing `LocalEngineHost` (same thread, no serialization) keeps for free.
 */

import { CORE_DEPS, coreScenario } from "@mc/cards";
import {
  applyCommand,
  createGame,
  legalActions as queryLegalActions,
  sessionApply,
  startSession,
  type Command,
  type EngineError,
  type EngineErrorCode,
  type GameEvent,
  type GameSession,
  type GameState,
  type IllegalDeck,
  type LegalActions,
  type PlayerId,
} from "@mc/engine";
import { actingPlayer } from "./acting-player.js";
import { emptyRecord, recordEvents, type GameRecord } from "./game-record.js";
import { isCurrentSchema, SAVE_SCHEMA, type GameStorage, type SaveMeta, type SaveStatus } from "./game-storage.js";
import type { CardPool, LegalActionsFor, SavedGame, SessionConfig, StateWithoutPool } from "./host.js";

/** An update as it crosses a thread boundary: no card pool, so it stays ~68 KB. */
export interface Snapshot {
  readonly version: number;
  readonly state: StateWithoutPool;
  readonly events: readonly GameEvent[];
  readonly legal: LegalActionsFor | null;
  /** What the game-over screen reports, folded from every command so far. */
  readonly record: GameRecord;
  /** The setup this game came from, so a rematch can reuse it — for a resumed game too. */
  readonly config: SessionConfig | null;
  /**
   * Set once a write to storage has failed. The game plays on — nothing about
   * the rules depends on the disk — but it may not survive a refresh, and the
   * player should be told rather than find out by losing it.
   */
  readonly saveError: string | null;
}

export type CoreDispatch =
  | { readonly ok: true; readonly snapshot: Snapshot }
  | { readonly ok: false; readonly error: EngineError };

/**
 * A setup (`start`/`resume`) refusal, carrying the engine's own `code` and — for
 * `illegal_deck` — which seat and why, rather than only a flattened message. A
 * plain `{ code, illegalDecks }` payload rides alongside this over the worker
 * boundary (`protocol.ts`'s `failed` reply) since a class instance's own fields
 * don't reliably survive structured clone; `WorkerEngineHost` reconstructs a
 * `SetupError` from those two fields so the main thread sees the same shape
 * whether the game runs local or in the worker.
 */
export class SetupError extends Error {
  readonly code: EngineErrorCode;
  readonly illegalDecks: readonly IllegalDeck[] | undefined;

  constructor(engineError: EngineError) {
    super(engineError.message);
    this.name = "SetupError";
    this.code = engineError.code;
    this.illegalDecks = engineError.illegalDecks;
  }
}

export interface CoreOptions {
  /** Omit for a game that lives only as long as the page. */
  readonly storage?: GameStorage | null;
  readonly now?: () => number;
  readonly newId?: () => string;
}

/** Splits the card pool off a state; the host re-attaches it on the other side. */
const stripPool = (state: GameState): StateWithoutPool => {
  const { cardPool: _cardPool, ...rest } = state;
  return rest;
};

const scenarioFor = (config: SessionConfig) =>
  coreScenario(config.scenarioId, {
    difficulty: config.difficulty,
    players: config.players,
    seed: config.seed,
    ...(config.modularSetIds ? { modularSetIds: config.modularSetIds } : {}),
    ...(config.firstPlayerIndex !== undefined ? { firstPlayerIndex: config.firstPlayerIndex } : {}),
  });

const statusOf = (state: GameState): SaveStatus =>
  state.outcome ? (state.outcome.result === "win" ? "won" : "lost") : "active";

const describeCause = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

export class EngineSessionCore {
  #session: GameSession | null = null;
  /** The command count, which is also the version every update is stamped with. */
  #version = 0;
  #record: GameRecord = emptyRecord();
  readonly #storage: GameStorage | null;
  readonly #now: () => number;
  readonly #newId: () => string;
  /** The stored game this session writes to; null when there is no storage or its creation failed. */
  #gameId: string | null = null;
  /**
   * Every write waits for the one before it, so the stored log is in command
   * order whatever the storage does internally.
   */
  #writes: Promise<void> = Promise.resolve();
  #saveError: string | null = null;
  #config: SessionConfig | null = null;

  constructor(options: CoreOptions = {}) {
    this.#storage = options.storage ?? null;
    this.#now = options.now ?? (() => Date.now());
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  /** Builds the Core scenario and runs RRG setup. Throws `SetupError` with the engine's own code and message. */
  async start(config: SessionConfig): Promise<{ readonly cardPool: CardPool; readonly snapshot: Snapshot }> {
    const setup = createGame(scenarioFor(config), CORE_DEPS);
    if (!setup.ok) throw new SetupError({ ...setup.error, message: `setup failed: ${setup.error.message}` });

    this.#session = startSession(setup.state);
    this.#config = config;
    this.#version = 0;
    this.#record = recordEvents(emptyRecord(), setup.events, setup.state);
    this.#writes = Promise.resolve();
    this.#saveError = null;
    this.#gameId = null;

    if (this.#storage) {
      const id = this.#newId();
      const at = this.#now();
      const meta: SaveMeta = {
        id,
        schema: SAVE_SCHEMA,
        config,
        createdAt: at,
        updatedAt: at,
        status: "active",
        round: setup.state.round,
        commandCount: 0,
        outcome: null,
      };
      try {
        // Awaited, unlike the command writes: a game that isn't recorded yet
        // has nothing for its first command to append to.
        await this.#storage.create(meta, stripPool(setup.state));
        this.#gameId = id;
      } catch (cause) {
        this.#saveError = describeCause(cause);
      }
    }

    return { cardPool: setup.state.cardPool, snapshot: this.#snapshot(setup.events) };
  }

  /**
   * Picks a stored game back up by replaying its log.
   *
   * The card pool isn't stored — it reloads from the bundle — so the scenario
   * is set up again to get it, and the *stored* baseline is what the commands
   * replay against. If any command no longer applies (a card changed under an
   * old save), the game is marked `incompatible` and never offered again,
   * rather than resuming into a state the saved commands never produced.
   */
  async resume(gameId: string): Promise<{ readonly cardPool: CardPool; readonly snapshot: Snapshot }> {
    const storage = this.#storage;
    if (!storage) throw new Error("there is no saved-games storage to resume from");
    const stored = await storage.load(gameId);
    if (!stored) throw new Error("that saved game is no longer there");
    // A save from an older schema is retired deliberately, before any replay is attempted: its baseline state is a
    // shape this engine no longer has, even if its commands would happen to apply.
    if (!isCurrentSchema(stored.meta)) {
      await storage.setStatus(gameId, "incompatible");
      throw new Error(
        `this saved game was made by an older version of the game (save format ${stored.meta.schema}; this build reads ${SAVE_SCHEMA}) and can't be continued`,
      );
    }

    const fresh = createGame(scenarioFor(stored.meta.config), CORE_DEPS);
    if (!fresh.ok) {
      await storage.setStatus(gameId, "incompatible");
      throw new SetupError({ ...fresh.error, message: `this saved game can no longer be set up: ${fresh.error.message}` });
    }

    const initialState: GameState = { ...stored.initialState, cardPool: fresh.state.cardPool };
    // Setup's own events aren't stored; setup is deterministic from the config,
    // so a fresh setup emits the same ones (the scheme's starting threat among them).
    let record = recordEvents(emptyRecord(), fresh.events, initialState);
    let state = initialState;
    for (const [index, command] of stored.commands.entries()) {
      const result = applyCommand(state, command, CORE_DEPS);
      if (!result.ok) {
        await storage.setStatus(gameId, "incompatible");
        throw new Error(
          `this saved game no longer replays (command ${index + 1} of ${stored.commands.length}: ${result.error.message})`,
        );
      }
      state = result.state;
      record = recordEvents(record, result.events, state);
    }

    this.#session = { state, log: { initialState, commands: stored.commands } };
    this.#config = stored.meta.config;
    this.#version = stored.commands.length;
    this.#record = record;
    this.#gameId = gameId;
    this.#writes = Promise.resolve();
    this.#saveError = null;
    // No events: a resumed game arrives at its position; it doesn't re-animate getting there.
    return { cardPool: fresh.state.cardPool, snapshot: this.#snapshot([]) };
  }

  dispatch(command: Command): CoreDispatch {
    const session = this.#require();
    const result = sessionApply(session, command, CORE_DEPS);
    if (!result.ok) return { ok: false, error: result.error };
    this.#session = result.session;
    this.#version += 1;
    this.#record = recordEvents(this.#record, result.events, result.session.state);
    this.#persist(command, this.#version - 1, result.session.state);
    return { ok: true, snapshot: this.#snapshot(result.events) };
  }

  legalActions(playerId: PlayerId): LegalActions {
    return queryLegalActions(this.#require().state, playerId, CORE_DEPS);
  }

  /**
   * The stored game to offer as "Continue", or null. A game saved under an older `SAVE_SCHEMA` is retired on the
   * way — marked `incompatible` and skipped — so it is never offered and then fails to replay.
   */
  async latestSave(): Promise<SaveMeta | null> {
    const storage = this.#storage;
    if (!storage) return null;
    // Each pass retires one game, so this ends when the newest active game is current or none is left.
    for (;;) {
      const latest = await storage.latestActive();
      if (!latest || isCurrentSchema(latest)) return latest;
      await storage.setStatus(latest.id, "incompatible");
    }
  }

  save(): SavedGame {
    const { log } = this.#require();
    return { initialState: log.initialState, commands: log.commands };
  }

  /** Resolves once every write queued so far has settled. */
  flushed(): Promise<void> {
    return this.#writes;
  }

  get version(): number {
    return this.#version;
  }

  #persist(command: Command, seq: number, state: GameState): void {
    const storage = this.#storage;
    const gameId = this.#gameId;
    // After a failed write every later command would be out of order, so stop.
    if (!storage || !gameId || this.#saveError) return;
    const progress = {
      round: state.round,
      commandCount: seq + 1,
      updatedAt: this.#now(),
      status: statusOf(state),
      outcome: state.outcome,
    };
    this.#writes = this.#writes
      .then(() => storage.append(gameId, seq, command, progress))
      .catch((cause: unknown) => {
        // The first failure is the cause; the out-of-order rejections that
        // follow it are only consequences, so they don't overwrite it.
        this.#saveError ??= describeCause(cause);
      });
  }

  #snapshot(events: readonly GameEvent[]): Snapshot {
    const { state } = this.#require();
    const toAct = actingPlayer(state);
    return {
      version: this.#version,
      state: stripPool(state),
      events,
      legal: toAct ? { playerId: toAct, actions: queryLegalActions(state, toAct, CORE_DEPS) } : null,
      record: this.#record,
      saveError: this.#saveError,
      config: this.#config,
    };
  }

  #require(): GameSession {
    if (!this.#session) throw new Error("the engine session has not been started");
    return this.#session;
  }
}
