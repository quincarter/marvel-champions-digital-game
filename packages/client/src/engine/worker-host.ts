/**
 * The `EngineHost` the game uses: the engine on its own thread.
 *
 * Why a worker at all (PLAN.md Phase 4): `legalActions` took 184 ms at the 95th
 * percentile in the 4-player Ultron game, about 11 frames at 60 fps. Copying
 * the state across costs about 0.4 ms without the card pool, which travels once.
 * The main thread stays free, so tweens keep running while a command is applied.
 */

import type { Command, LegalActions, PlayerId } from "@mc/engine";
import type { SaveMeta } from "./game-storage.js";
import type {
  CardPool,
  DispatchResult,
  EngineHost,
  EngineUpdate,
  SavedGame,
  SessionConfig,
  UpdateListener,
} from "./host.js";
import type { HostRequest, HostResponse } from "./protocol.js";
import { SetupError, type Snapshot } from "./session-core.js";

type Pending = {
  readonly resolve: (response: HostResponse) => void;
  readonly reject: (error: Error) => void;
};

/**
 * Builds the worker. Kept injectable so a test can pass a fake and the app can
 * pass Vite's `new Worker(new URL("./engine.worker.js", import.meta.url), { type: "module" })`.
 */
export type WorkerFactory = () => Worker;

export class WorkerEngineHost implements EngineHost {
  readonly #worker: Worker;
  readonly #listeners = new Set<UpdateListener>();
  readonly #pending = new Map<number, Pending>();
  #nextId = 1;
  #cardPool: CardPool | null = null;
  /** The newest version published. A late reply for an older one is dropped. */
  #version = -1;

  constructor(factory: WorkerFactory) {
    this.#worker = factory();
    this.#worker.addEventListener("message", this.#onMessage);
    this.#worker.addEventListener("error", this.#onError);
  }

  start(config: SessionConfig): Promise<EngineUpdate> {
    return this.#begin({ kind: "start", id: this.#id(), config });
  }

  resume(gameId: string): Promise<EngineUpdate> {
    return this.#begin({ kind: "resume", id: this.#id(), gameId });
  }

  async dispatch(command: Command): Promise<DispatchResult> {
    const response = await this.#request({ kind: "dispatch", id: this.#id(), command });
    if (response.kind !== "dispatched") throw new Error(`unexpected reply ${response.kind}`);
    if (!response.result.ok) return { ok: false, error: response.result.error };
    const update = this.#hydrate(response.result.snapshot);
    this.#publish(update);
    return { ok: true, update };
  }

  async legalActions(playerId: PlayerId): Promise<LegalActions> {
    const response = await this.#request({ kind: "legalActions", id: this.#id(), playerId });
    if (response.kind !== "legalActions") throw new Error(`unexpected reply ${response.kind}`);
    return response.actions;
  }

  subscribe(listener: UpdateListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async save(): Promise<SavedGame> {
    const response = await this.#request({ kind: "save", id: this.#id() });
    if (response.kind !== "save") throw new Error(`unexpected reply ${response.kind}`);
    if (!this.#cardPool) throw new Error("the engine session has not been started");
    return {
      initialState: { ...response.save.initialState, cardPool: this.#cardPool },
      commands: response.save.commands,
    };
  }

  async latestSave(): Promise<SaveMeta | null> {
    const response = await this.#request({ kind: "latestSave", id: this.#id() });
    if (response.kind !== "latestSave") throw new Error(`unexpected reply ${response.kind}`);
    return response.meta;
  }

  async listSaves(): Promise<readonly SaveMeta[]> {
    const response = await this.#request({ kind: "listSaves", id: this.#id() });
    if (response.kind !== "listSaves") throw new Error(`unexpected reply ${response.kind}`);
    return response.saves;
  }

  dispose(): void {
    this.#worker.removeEventListener("message", this.#onMessage);
    this.#worker.removeEventListener("error", this.#onError);
    for (const { reject } of this.#pending.values()) reject(new Error("the engine host was disposed"));
    this.#pending.clear();
    this.#listeners.clear();
    this.#worker.terminate();
  }

  /** Starting and resuming both answer `started`: a new card pool and a game from version 0 or N. */
  async #begin(request: HostRequest): Promise<EngineUpdate> {
    const response = await this.#request(request);
    if (response.kind !== "started") throw new Error(`unexpected reply ${response.kind}`);
    this.#cardPool = response.cardPool;
    // A new game (or a different one) starts its own version count.
    this.#version = -1;
    const update = this.#hydrate(response.snapshot);
    this.#publish(update);
    return update;
  }

  #id(): number {
    return this.#nextId++;
  }

  #request(request: HostRequest): Promise<HostResponse> {
    return new Promise<HostResponse>((resolve, reject) => {
      this.#pending.set(request.id, { resolve, reject });
      this.#worker.postMessage(request);
    });
  }

  readonly #onMessage = (event: MessageEvent<HostResponse>): void => {
    const response = event.data;
    const pending = this.#pending.get(response.id);
    if (!pending) return;
    this.#pending.delete(response.id);
    if (response.kind === "failed") {
      // Reconstructed from plain fields, not a cloned `SetupError` instance
      // (a class's own fields don't reliably survive structured clone) — see
      // `protocol.ts`'s `failed` reply and `session-core.ts`'s `SetupError`.
      pending.reject(
        response.code
          ? new SetupError({ code: response.code, message: response.message, command: null, ...(response.illegalDecks ? { illegalDecks: response.illegalDecks } : {}) })
          : new Error(response.message),
      );
    } else pending.resolve(response);
  };

  readonly #onError = (event: ErrorEvent): void => {
    const error = new Error(event.message || "the engine worker failed");
    for (const { reject } of this.#pending.values()) reject(error);
    this.#pending.clear();
  };

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

  /** Drops an update the store has already moved past (an out-of-order reply). */
  #publish(update: EngineUpdate): void {
    if (update.version < this.#version) return;
    this.#version = update.version;
    for (const listener of [...this.#listeners]) listener(update);
  }
}
