/**
 * The `EngineHost` a replay is watched through (issue #693). The board and its store take it in place of the live host
 * while a replay is up (`replay-mode.ts`), so the table draws a replayed game exactly as it draws a live one; this host
 * only ever publishes positions of the replay, and refuses every command: nothing done on a replay can reach a game.
 *
 * The transport (play, pause, step, seek) drives it through `seek`, `step` and `stepBack`. A step forward publishes that
 * command's events, so the board animates it as it was played; a seek publishes the history up to there and no events,
 * so the board redraws at the new position without animating the way there. Seeks while one is in flight are coalesced:
 * only the newest target is fetched next, so dragging the seek bar never queues up a backlog.
 *
 * The rebuilding runs in the replay worker (`WorkerReplayBackend`), which `dispose` terminates.
 */
import type { Command, LegalActions, PlayerId } from "@mc/engine";
import type { SaveMeta } from "../engine/game-storage.js";
import type {
  CardPool,
  DispatchResult,
  EngineHost,
  EngineUpdate,
  SavedGame,
  SessionConfig,
  UpdateListener,
} from "../engine/host.js";
import type { Snapshot } from "../engine/session-core.js";
import { INITIAL_LIVE_STATE, type LiveState, type LiveWatchEvent } from "../live/watch-events.js";
import { followPlan, isFollowing } from "../live/watch-follow.js";
import type { PackRuntime } from "../packs/pack-runtime.js";
import type { PaymentState } from "../view/payment-model.js";
import type { JudgedPayment } from "../view/payment-verdict.js";
import {
  ReplayCore,
  ReplayOpenError,
  type ReplayExport,
  type ReplayLogExport,
  type ReplayOpenSource,
  type ReplayOpened,
} from "./replay-core.js";
import type { ReplayRequest, ReplayResponse } from "./replay-protocol.js";
import type { ReplayInfo } from "./replay-session.js";

/** Where a replay is rebuilt: the replay worker in the app, `ReplayCore` in-thread in the tests. */
export interface ReplayBackend {
  open(source: ReplayOpenSource): Promise<ReplayOpened>;
  snapshot(n: number, played: boolean): Promise<Snapshot>;
  exportFile(): Promise<ReplayExport>;
  exportLog(): Promise<ReplayLogExport>;
  dispose(): void;
  /** Follows a live game room (issue #876). Absent on a backend that cannot (it then refuses a watch). */
  watch?(roomId: string, syncUrl: string, packs: readonly PackRuntime[]): Promise<ReplayOpened>;
  /** Hears the live game's changes while one is followed. */
  onLive?(listener: (event: LiveWatchEvent) => void): void;
}

/** The replay rebuilt on the calling thread: the tests' backend, over the same `ReplayCore` the worker runs. */
export class LocalReplayBackend implements ReplayBackend {
  readonly #core: ReplayCore;

  readonly #watch: ((roomId: string, syncUrl: string) => Promise<ReplayOpened>) | null;

  /** `watch`: what a live watch opens with, in tests (the worker's socket is not there). */
  constructor(core: ReplayCore, watch: ((roomId: string, syncUrl: string) => Promise<ReplayOpened>) | null = null) {
    this.#core = core;
    this.#watch = watch;
  }

  watch(roomId: string, syncUrl: string): Promise<ReplayOpened> {
    if (!this.#watch) return Promise.reject(new Error("no live watch here"));
    return this.#watch(roomId, syncUrl);
  }

  open(source: ReplayOpenSource): Promise<ReplayOpened> {
    return this.#core.open(source);
  }

  async snapshot(n: number, played: boolean): Promise<Snapshot> {
    return this.#core.snapshot(n, played);
  }

  #liveListener: ((event: LiveWatchEvent) => void) | null = null;

  /** The tests' stand-in for the worker's socket: they hand the host the events a watch would have posted. */
  onLive(listener: (event: LiveWatchEvent) => void): void {
    this.#liveListener = listener;
  }

  emitLive(event: LiveWatchEvent): void {
    this.#liveListener?.(event);
  }

  exportFile(): Promise<ReplayExport> {
    return this.#core.exportFile();
  }

  async exportLog(): Promise<ReplayLogExport> {
    return this.#core.exportLog();
  }

  dispose(): void {}
}

type Pending = { readonly resolve: (response: ReplayResponse) => void; readonly reject: (error: Error) => void };

/** How long the worker may take to rebuild a replay, and to answer anything after: far past a real game's needs. */
export const OPEN_DEADLINE_MS = 60_000;
export const STEP_DEADLINE_MS = 20_000;

/** The replay worker, started when the replay opens and terminated when it closes. */
export class WorkerReplayBackend implements ReplayBackend {
  readonly #worker: Worker;
  readonly #pending = new Map<number, Pending>();
  #nextId = 1;
  #liveListener: ((event: LiveWatchEvent) => void) | null = null;

  constructor(
    factory: () => Worker = () =>
      new Worker(new URL("../workers/replay.worker.ts", import.meta.url), {
        type: "module",
        name: "replay",
      }),
  ) {
    this.#worker = factory();
    this.#worker.addEventListener("message", (event: MessageEvent<ReplayResponse>) => {
      if (event.data.kind === "live") {
        this.#liveListener?.(event.data.event);
        return;
      }
      const pending = this.#pending.get(event.data.id);
      if (!pending) return;
      this.#pending.delete(event.data.id);
      const response = event.data;
      if (response.kind === "failed") {
        pending.reject(
          response.code ? new ReplayOpenError(response.code, response.message) : new Error(response.message),
        );
      } else pending.resolve(response);
    });
    this.#worker.addEventListener("error", (event) => {
      const error = new Error(event.message || "the replay worker failed");
      for (const pending of this.#pending.values()) pending.reject(error);
      this.#pending.clear();
    });
  }

  async open(source: ReplayOpenSource): Promise<ReplayOpened> {
    const response = await this.#request({ kind: "open", id: this.#nextId++, source });
    if (response.kind !== "opened") throw new Error(`unexpected reply ${response.kind}`);
    return { cardPool: response.cardPool, info: response.info };
  }

  async watch(roomId: string, syncUrl: string, packs: readonly PackRuntime[]): Promise<ReplayOpened> {
    const response = await this.#request({ kind: "watch", id: this.#nextId++, roomId, syncUrl, packs });
    if (response.kind !== "opened") throw new Error(`unexpected reply ${response.kind}`);
    return { cardPool: response.cardPool, info: response.info };
  }

  onLive(listener: (event: LiveWatchEvent) => void): void {
    this.#liveListener = listener;
  }

  async snapshot(n: number, played: boolean): Promise<Snapshot> {
    const response = await this.#request({ kind: "snapshot", id: this.#nextId++, n, played });
    if (response.kind !== "snapshot") throw new Error(`unexpected reply ${response.kind}`);
    return response.snapshot;
  }

  async exportFile(): Promise<ReplayExport> {
    const response = await this.#request({ kind: "export", id: this.#nextId++ });
    if (response.kind !== "exported") throw new Error(`unexpected reply ${response.kind}`);
    return { bytes: response.bytes, name: response.name };
  }

  async exportLog(): Promise<ReplayLogExport> {
    const response = await this.#request({ kind: "exportLog", id: this.#nextId++ });
    if (response.kind !== "exportedLog") throw new Error(`unexpected reply ${response.kind}`);
    return { text: response.text, name: response.name };
  }

  dispose(): void {
    this.#worker.terminate();
    const error = new Error("the replay closed");
    for (const pending of this.#pending.values()) pending.reject(error);
    this.#pending.clear();
  }

  #request(request: ReplayRequest): Promise<ReplayResponse> {
    return new Promise((resolve, reject) => {
      // A replay that keeps the worker busy past its deadline (a file built to make the engine loop) is stopped: the
      // worker is terminated and the replay can't go on.
      const deadline = setTimeout(
        () => {
          this.#worker.terminate();
          const error = new ReplayOpenError("damaged", "the replay took too long to rebuild");
          for (const pending of this.#pending.values()) pending.reject(error);
          this.#pending.clear();
        },
        request.kind === "open" ? OPEN_DEADLINE_MS : STEP_DEADLINE_MS,
      );
      this.#pending.set(request.id, {
        resolve: (response) => {
          clearTimeout(deadline);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(deadline);
          reject(error);
        },
      });
      this.#worker.postMessage(request);
    });
  }
}

/** Where the replay stands, for the transport bar. */
export interface ReplayPositionState {
  /** Commands played so far: 0 is the table after setup, `info.length` the end. */
  readonly position: number;
  readonly info: ReplayInfo;
}

export type ReplayPositionListener = (state: ReplayPositionState) => void;

const REFUSED = "a replay can only be watched";

export class ReplayHost implements EngineHost {
  readonly #backend: ReplayBackend;
  readonly #listeners = new Set<UpdateListener>();
  readonly #positionListeners = new Set<ReplayPositionListener>();
  #cardPool: CardPool | null = null;
  #info: ReplayInfo | null = null;
  #position = 0;
  /** Every update this host publishes gets a newer version, whichever way the replay moved: the store drops older ones. */
  #published = 0;
  /** Moves asked for and not yet shown, in order. */
  readonly #queue: { readonly n: number; readonly played: boolean }[] = [];
  /** Where the replay stands once every queued move has landed: what the next step or step back counts from. */
  #target = 0;
  #busy: Promise<void> | null = null;
  #disposed = false;
  /** Set while a live game is followed (issue #876); null for an ordinary replay. */
  #live: LiveState | null = null;
  readonly #liveListeners = new Set<(state: LiveState | null) => void>();

  constructor(backend: ReplayBackend) {
    this.#backend = backend;
  }

  /** Follows a live game room (issue #876): the replay is the game so far, at its newest position, and keeps up. */
  async watch(roomId: string, syncUrl: string, packs: readonly PackRuntime[]): Promise<ReplayInfo> {
    const watch = this.#backend.watch;
    if (!watch || !this.#backend.onLive) throw new ReplayOpenError("setup", "this backend cannot follow a live game");
    this.#live = INITIAL_LIVE_STATE;
    this.#backend.onLive((event) => this.#onLive(event));
    const { cardPool, info } = await watch.call(this.#backend, roomId, syncUrl, packs);
    this.#cardPool = cardPool;
    this.#info = info;
    this.#position = info.length;
    this.#target = info.length;
    if (info.outcome) this.#live = { ...this.#live, over: true };
    return info;
  }

  /** The live game's state, or null when this is an ordinary replay. */
  get live(): LiveState | null {
    return this.#live;
  }

  /** Whether the viewer is at the newest position of a live game (a step back leaves it, `goLive` returns). */
  get following(): boolean {
    return this.#info !== null && isFollowing(this.#target, this.#info.length);
  }

  /** The transport's feed of the live game's state. Delivers the current state at once. */
  onLiveState(listener: (state: LiveState | null) => void): () => void {
    this.#liveListeners.add(listener);
    listener(this.#live);
    return () => this.#liveListeners.delete(listener);
  }

  /** Jumps to the newest position of a live game (the "Live" control), without animating the way there. */
  goLive(): Promise<void> {
    return this.seek(this.#require().length);
  }

  #setLive(state: LiveState): void {
    this.#live = state;
    for (const listener of [...this.#liveListeners]) listener(state);
  }

  #onLive(event: LiveWatchEvent): void {
    if (this.#disposed || !this.#live) return;
    if (event.type === "presence") {
      this.#setLive({ ...this.#live, hostConnected: event.hostConnected, watchers: event.watchers });
      return;
    }
    if (event.type === "closed") {
      this.#setLive({ ...this.#live, over: true, hostConnected: false });
      return;
    }
    const old = this.#info;
    if (!old) return;
    this.#info = event.info;
    const plan = followPlan({
      change: event.change,
      target: this.#target,
      oldLength: old.length,
      newLength: event.info.length,
      added: event.added,
    });
    if (event.change === "end" || event.change === "reset" || event.change === "rewind") {
      this.#setLive({ ...this.#live, over: event.info.outcome !== null });
    }
    // The bar learns the new length at once; a step or seek then publishes the table and the bar again.
    const info = event.info;
    for (const listener of [...this.#positionListeners]) listener({ position: this.#position, info });
    // A failed fetch of the new position leaves the viewer where they were: the next event moves them again.
    if (plan.kind === "step") void this.step().catch(() => undefined);
    else if (plan.kind === "seek") void this.seek(plan.to).catch(() => undefined);
  }

  /** Rebuilds the replay. Rejects with a `ReplayOpenError` when it can't be watched at all. */
  async open(source: ReplayOpenSource): Promise<ReplayInfo> {
    const { cardPool, info } = await this.#backend.open(source);
    this.#cardPool = cardPool;
    this.#info = info;
    this.#position = 0;
    this.#target = 0;
    return info;
  }

  get info(): ReplayInfo | null {
    return this.#info;
  }

  get position(): number {
    return this.#position;
  }

  /** The transport bar's feed: every move of the replay. Delivers the current position at once when open. */
  onPosition(listener: ReplayPositionListener): () => void {
    this.#positionListeners.add(listener);
    if (this.#info) listener({ position: this.#position, info: this.#info });
    return () => this.#positionListeners.delete(listener);
  }

  /** Shows the table after `n` commands (clamped), without animating the way there. */
  seek(n: number): Promise<void> {
    const info = this.#require();
    this.#target = Math.max(0, Math.min(Math.round(n), info.length));
    const last = this.#queue[this.#queue.length - 1];
    // A seek behind another seek not yet fetched replaces it: dragging the seek bar never queues up a backlog.
    if (last && !last.played) this.#queue[this.#queue.length - 1] = { n: this.#target, played: false };
    else this.#queue.push({ n: this.#target, played: false });
    return this.#run();
  }

  /**
   * Plays the next command as it was played. False at the end, where nothing moves. Moves are queued in order and
   * counted from where the queued ones leave the replay, so two quick steps play two commands, each once.
   */
  async step(): Promise<boolean> {
    const info = this.#require();
    if (this.#target >= info.length) return false;
    this.#target += 1;
    this.#queue.push({ n: this.#target, played: true });
    await this.#run();
    return true;
  }

  /** Goes back one command. False at the start. */
  async stepBack(): Promise<boolean> {
    if (this.#target <= 0) return false;
    await this.seek(this.#target - 1);
    return true;
  }

  /** The replay as a file's bytes and name: the file it was opened from, or a new one for a game of this device's. */
  exportFile(): Promise<ReplayExport> {
    this.#require();
    return this.#backend.exportFile();
  }

  /** The game's whole log as a text file's contents and name. */
  exportLog(): Promise<ReplayLogExport> {
    this.#require();
    return this.#backend.exportLog();
  }

  /** Publishes the replay's opening position (the store's `resume` calls this; the id is not read). */
  async resume(_gameId?: string): Promise<EngineUpdate> {
    this.#require();
    this.#target = this.#position;
    return this.#show(this.#position, false);
  }

  async start(_config: SessionConfig): Promise<EngineUpdate> {
    throw new Error(REFUSED);
  }

  async dispatch(command: Command): Promise<DispatchResult> {
    return { ok: false, error: { code: "internal_error", message: REFUSED, command } };
  }

  async rewindTo(_commandCount: number): Promise<EngineUpdate> {
    throw new Error(REFUSED);
  }

  async legalActions(_playerId: PlayerId): Promise<LegalActions> {
    return { kind: "gameOver" };
  }

  async judgePayment(_playerId: PlayerId, _payment: PaymentState): Promise<JudgedPayment> {
    throw new Error(REFUSED);
  }

  subscribe(listener: UpdateListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async save(): Promise<SavedGame> {
    throw new Error(REFUSED);
  }

  async latestSave(): Promise<SaveMeta | null> {
    return null;
  }

  async activeSaves(): Promise<readonly SaveMeta[]> {
    return [];
  }

  async retireSave(_gameId: string): Promise<void> {}

  async listSaves(): Promise<readonly SaveMeta[]> {
    return [];
  }

  async backfillSummaries(): Promise<number> {
    return 0;
  }

  dispose(): void {
    this.#disposed = true;
    this.#liveListeners.clear();
    this.#listeners.clear();
    this.#positionListeners.clear();
    this.#backend.dispose();
  }

  /** Works through the queued moves in order; resolves once none is left. After `dispose` a failed fetch is dropped. */
  #run(): Promise<void> {
    this.#busy ??= this.#drain();
    return this.#busy;
  }

  async #drain(): Promise<void> {
    try {
      for (let next = this.#queue.shift(); next && !this.#disposed; next = this.#queue.shift()) {
        await this.#show(next.n, next.played);
      }
    } catch (cause) {
      // The moves behind the one that failed are dropped, so the next one counts from where the replay really is.
      this.#queue.length = 0;
      this.#target = this.#position;
      if (!this.#disposed) throw cause;
    } finally {
      this.#busy = null;
    }
  }

  async #show(n: number, played: boolean): Promise<EngineUpdate> {
    const snapshot = await this.#backend.snapshot(n, played);
    const update = this.#hydrate(snapshot);
    if (this.#disposed) return update;
    this.#position = snapshot.version;
    for (const listener of [...this.#listeners]) listener(update);
    const info = this.#require();
    for (const listener of [...this.#positionListeners]) listener({ position: this.#position, info });
    return update;
  }

  #hydrate(snapshot: Snapshot): EngineUpdate {
    const pool = this.#cardPool;
    if (!pool) throw new Error("the replay is not open");
    this.#published += 1;
    return {
      version: this.#published,
      state: { ...snapshot.state, cardPool: pool },
      events: snapshot.events,
      legal: null,
      record: snapshot.record,
      saveError: null,
      config: snapshot.config,
      gameId: null,
      ...(snapshot.history ? { history: snapshot.history } : {}),
      ...(snapshot.states
        ? { states: snapshot.states.map(({ at, state }) => ({ at, state: { ...state, cardPool: pool } })) }
        : {}),
    };
  }

  #require(): ReplayInfo {
    if (!this.#info) throw new Error("the replay is not open");
    return this.#info;
  }
}
