/**
 * The in-thread `EngineHost`, for Vitest and for debugging without a worker.
 *
 * Its methods are async to match the interface, but they resolve on the
 * microtask queue, so a test can `await host.dispatch(...)` and read the
 * store synchronously afterwards.
 *
 * It keeps games in memory by default. Pass the same `GameStorage` to two
 * hosts and the second can resume what the first played — the in-thread
 * stand-in for "refresh the page".
 */

import type { Command, LegalActions, PlayerId } from "@mc/engine";
import { MemoryGameStorage, type GameStorage, type SaveMeta } from "./game-storage.js";
import type {
  CardPool,
  DispatchResult,
  EngineHost,
  EngineUpdate,
  SavedGame,
  SessionConfig,
  UpdateListener,
} from "./host.js";
import { EngineSessionCore, type Snapshot } from "./session-core.js";

export class LocalEngineHost implements EngineHost {
  readonly #core: EngineSessionCore;
  readonly #listeners = new Set<UpdateListener>();
  #cardPool: CardPool | null = null;

  constructor(storage: GameStorage = new MemoryGameStorage()) {
    this.#core = new EngineSessionCore({ storage });
  }

  async start(config: SessionConfig): Promise<EngineUpdate> {
    return this.#begin(await this.#core.start(config));
  }

  async resume(gameId: string): Promise<EngineUpdate> {
    return this.#begin(await this.#core.resume(gameId));
  }

  async dispatch(command: Command): Promise<DispatchResult> {
    const result = this.#core.dispatch(command);
    if (!result.ok) return { ok: false, error: result.error };
    const update = this.#hydrate(result.snapshot);
    this.#publish(update);
    return { ok: true, update };
  }

  async legalActions(playerId: PlayerId): Promise<LegalActions> {
    return this.#core.legalActions(playerId);
  }

  subscribe(listener: UpdateListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async save(): Promise<SavedGame> {
    return this.#core.save();
  }

  latestSave(): Promise<SaveMeta | null> {
    return this.#core.latestSave();
  }

  /** Resolves once every queued write has settled — so a test can "refresh" after it. */
  flushed(): Promise<void> {
    return this.#core.flushed();
  }

  dispose(): void {
    this.#listeners.clear();
  }

  #begin(started: { readonly cardPool: CardPool; readonly snapshot: Snapshot }): EngineUpdate {
    this.#cardPool = started.cardPool;
    const update = this.#hydrate(started.snapshot);
    this.#publish(update);
    return update;
  }

  /** Re-attaches the card pool so consumers get a complete `GameState`. */
  #hydrate(snapshot: Snapshot): EngineUpdate {
    if (!this.#cardPool) throw new Error("the engine session has not been started");
    return {
      version: snapshot.version,
      state: { ...snapshot.state, cardPool: this.#cardPool },
      events: snapshot.events,
      legal: snapshot.legal,
      record: snapshot.record,
      saveError: snapshot.saveError,
      config: snapshot.config,
    };
  }

  #publish(update: EngineUpdate): void {
    for (const listener of [...this.#listeners]) listener(update);
  }
}
