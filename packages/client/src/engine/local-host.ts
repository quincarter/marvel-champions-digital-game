/**
 * The in-thread `EngineHost`, for Vitest and for debugging without a worker.
 *
 * Its methods are async to match the interface, but they resolve on the
 * microtask queue, so a test can `await host.dispatch(...)` and read the
 * store synchronously afterwards.
 */

import type { Command, LegalActions, PlayerId } from "@mc/engine";
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
  readonly #core = new EngineSessionCore();
  readonly #listeners = new Set<UpdateListener>();
  #cardPool: CardPool | null = null;

  async start(config: SessionConfig): Promise<EngineUpdate> {
    const { cardPool, snapshot } = this.#core.start(config);
    this.#cardPool = cardPool;
    const update = this.#hydrate(snapshot);
    this.#publish(update);
    return update;
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

  dispose(): void {
    this.#listeners.clear();
  }

  /** Re-attaches the card pool so consumers get a complete `GameState`. */
  #hydrate(snapshot: Snapshot): EngineUpdate {
    if (!this.#cardPool) throw new Error("the engine session has not been started");
    return {
      version: snapshot.version,
      state: { ...snapshot.state, cardPool: this.#cardPool },
      events: snapshot.events,
      legal: snapshot.legal,
    };
  }

  #publish(update: EngineUpdate): void {
    for (const listener of [...this.#listeners]) listener(update);
  }
}
