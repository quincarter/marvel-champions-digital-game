/**
 * The organizer's pod coordinator (Epic Multiplayer, issue #882; docs/live-game-rooms.md section 10): the engine's pure
 * `PodCoordinatorState` reducer behind the room's pod channel. It runs in the live-room worker (never on the main
 * thread), on the organizer's device, and is as plain as `PodLink`: messages in, messages out, the socket injected.
 *
 * - `receive(table, seq, event)` is a table host's `pod:event`. Sequence 0 is a `PodSync` (the table says where it
 *   stands): the coordinator answers with a `PodSyncAck` (how many of the table's events it has) and re-sends the inbound
 *   events the table has not applied (`inboundSince`). Any other sequence is an engine event applied once (a duplicate
 *   changes nothing; a gap is answered with the same ack, so the table re-sends from the first missing one).
 * - What the reducer decides (`delivered`) goes to each group as `pod:inbound { table, seq, event }`; the organizer's
 *   own table is reached through `local` instead of the socket. The shared state is broadcast as `pod:state` after each
 *   change and on request.
 * - Its log (`CoordinatorLogEntry[]`) is saved after each change (`EpicLogStore`) with the setup, so a reload rebuilds
 *   the coordinator with `replayCoordinator`; the new coordinator has a new epoch, which makes every table sync again.
 *   Nothing the log explains is told to a table (or the organizer's screens) until a save that includes it has
 *   committed. A rejected save is not swallowed: what depends on it is held in order, the save is retried with a
 *   growing wait, and `onSaveStatus` says so (`stuck` after `SAVE_STUCK_AFTER` failures in a row).
 * - Messages to the room are paced (a burst, then a steady rate, below the room's pod limit) so a long re-send after a
 *   reconnect is not refused as `rate-limited`.
 */
import {
  createPodCoordinator,
  inboundSince,
  markGroupDropped,
  receiveOutbound,
  replayCoordinator,
  type CoordinatorLogEntry,
  type GroupId,
  type PodCoordinatorGroupSetup,
  type PodCoordinatorSetup,
  type PodCoordinatorState,
  type PodDelivery,
  type PodInboundEvent,
  type PodOutboundEvent,
  type SharedPodState,
} from "@mc/engine";
import { POD_BURST, POD_PER_SECOND, ROOM_IDLE_MS, ROOM_PROTOCOL_VERSION } from "@mc/sync-worker/room-protocol";
import type { ClientMessage } from "@mc/sync-worker/room-protocol";
import {
  isPodSync,
  isTaggedEvent,
  podStateWireOf,
  POD_LINK_SEQ,
  type PodStateWire,
  type PodSyncAck,
} from "./pod-wire.js";

// ---------------------------------------------------------------------------------------------------------------
// The coordinator's log, kept with the organizer's game

export interface EpicLogRecord {
  readonly roomId: string;
  readonly setup: PodCoordinatorSetup;
  readonly log: readonly CoordinatorLogEntry[];
  readonly savedAt: number;
  /** The epoch the coordinator had: a restored one starts well past it, so tables always see a restart. */
  readonly epoch?: number;
}

export interface EpicLogStore {
  load(roomId: string): Promise<EpicLogRecord | null>;
  save(record: EpicLogRecord): Promise<void>;
  clear(roomId: string): Promise<void>;
}

export const epicLogFresh = (record: EpicLogRecord, now: number): boolean => now - record.savedAt < ROOM_IDLE_MS;

export class MemoryEpicLogStore implements EpicLogStore {
  readonly records = new Map<string, EpicLogRecord>();
  async load(roomId: string): Promise<EpicLogRecord | null> {
    return this.records.get(roomId) ?? null;
  }
  async save(record: EpicLogRecord): Promise<void> {
    this.records.set(record.roomId, record);
  }
  async clear(roomId: string): Promise<void> {
    this.records.delete(roomId);
  }
}

const DB_NAME = "mc-epic-pod";
const STORE = "logs";

export class IdbEpicLogStore implements EpicLogStore {
  #db: Promise<IDBDatabase> | null = null;

  #open(): Promise<IDBDatabase> {
    this.#db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "roomId" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("could not open the pod log store"));
    });
    return this.#db;
  }

  async #run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.#open();
    return new Promise((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("pod log store request failed"));
    });
  }

  async load(roomId: string): Promise<EpicLogRecord | null> {
    return ((await this.#run("readonly", (s) => s.get(roomId))) as EpicLogRecord | undefined) ?? null;
  }
  async save(record: EpicLogRecord): Promise<void> {
    await this.#run("readwrite", (s) => s.put(record));
  }
  async clear(roomId: string): Promise<void> {
    await this.#run("readwrite", (s) => s.delete(roomId));
  }
}

// ---------------------------------------------------------------------------------------------------------------

export interface EpicCoordinatorOptions {
  readonly roomId: string;
  /** Every group of the game as the lobby set it (a table, its pod, its seat count), in the organizer's order. */
  readonly groups: readonly PodCoordinatorGroupSetup[];
  /** Puts a message on the room's socket; false when it could not be sent (it is dropped: syncs re-send what matters). */
  readonly send: (message: ClientMessage) => boolean;
  /** The organizer's own table, reached directly: what the coordinator tells it is handed here instead of sent. */
  readonly local?: {
    readonly table: string;
    readonly deliver: (sequence: number, event: PodInboundEvent | PodSyncAck) => void;
  };
  readonly store?: EpicLogStore;
  /** A new number for each coordinator, so tables notice a restart. Default: the clock and a random. */
  readonly epoch?: number;
  readonly now?: () => number;
  readonly setTimer?: (run: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
  /** The shared state changed (the organizer's own screens read it; everyone else gets it as `pod:state`). */
  readonly onState?: (state: PodStateWire) => void;
  /** The log's saving is failing (`failing`), or has failed `SAVE_STUCK_AFTER` times in a row (`stuck`), or recovered. */
  readonly onSaveStatus?: (status: EpicSaveStatus) => void;
}

export interface EpicSaveStatus {
  readonly failing: boolean;
  readonly stuck: boolean;
  /** Failed saves in a row; 0 once one commits. */
  readonly failures: number;
}

/** Failed saves in a row before the organizer is told the pod is stuck. */
export const SAVE_STUCK_AFTER = 3;
const SAVE_RETRY_MS = 500;
const SAVE_RETRY_MAX_MS = 15_000;

const DRAIN_MS = Math.ceil(1000 / POD_PER_SECOND) + 10;
/** Leaves room for the organizer's own `pod:state` broadcasts under the room's burst. */
const SEND_BURST = Math.max(4, POD_BURST - 6);

export class EpicCoordinator {
  readonly #options: EpicCoordinatorOptions;
  #state: PodCoordinatorState | null = null;
  readonly #setup: Omit<PodCoordinatorSetup, "shared">;
  #shared: SharedPodState | null = null;
  #epoch: number;
  readonly #queue: ClientMessage[] = [];
  #budget = SEND_BURST;
  #refilledAt: number;
  #timer: unknown = null;
  /** How many log entries are committed in the store: what may be told to others covers no more than this. */
  #savedLength = 0;
  /** What waits for a save: each item needs the log to be saved up to `needs` entries, and goes out in order. */
  readonly #outbox: { readonly needs: number; readonly send: () => void }[] = [];
  #writing: Promise<void> | null = null;
  #retry: unknown = null;
  #failures = 0;
  #disposed = false;

  constructor(options: EpicCoordinatorOptions) {
    this.#options = options;
    this.#setup = { groups: options.groups };
    this.#epoch = options.epoch ?? Math.floor(((options.now ?? Date.now)() % 1e9) * 1000 + Math.random() * 1000);
    this.#refilledAt = (options.now ?? Date.now)();
  }

  /**
   * A coordinator rebuilt from a saved log (an organizer that reloaded), or a fresh one when there is none the lobby
   * still matches. The state is replayed, not trusted: a log the reducer refuses starts over.
   */
  static async restore(options: EpicCoordinatorOptions): Promise<EpicCoordinator> {
    const coordinator = new EpicCoordinator(options);
    const record = await options.store?.load(options.roomId).catch(() => null);
    const now = (options.now ?? Date.now)();
    if (!record || !epicLogFresh(record, now) || !sameGroups(record.setup.groups, options.groups)) {
      if (record) void options.store?.clear(options.roomId).catch(() => {});
      return coordinator;
    }
    try {
      coordinator.#state = replayCoordinator(record.setup, record.log);
      coordinator.#shared = record.setup.shared;
      coordinator.#savedLength = record.log.length;
      coordinator.#epoch = Math.max(coordinator.#epoch, (record.epoch ?? 0) + 1000);
    } catch {
      void options.store?.clear(options.roomId).catch(() => {});
    }
    return coordinator;
  }

  /** Changes with each coordinator the organizer starts and each time it returns to the room: tables sync when it does. */
  get epoch(): number {
    return this.#epoch;
  }

  /** The organizer's socket is back: a new epoch, so every table host syncs again and re-sends what it lacks. */
  renewEpoch(): void {
    this.#epoch += 1;
  }

  /** The coordinator's state, or null before the first table has told it the shared record. */
  get state(): PodCoordinatorState | null {
    return this.#state;
  }

  /** The shared state as everyone is sent it, or null before there is one. */
  get wire(): PodStateWire | null {
    return this.#state ? podStateWireOf(this.#state, this.#epoch) : null;
  }

  /** Re-sends the shared state to everyone (the organizer's socket was welcomed again, or someone joined). */
  broadcast(): void {
    this.#later(this.#state?.log.length ?? 0, () => {
      const wire = this.wire;
      if (!wire) return;
      this.#options.onState?.(wire);
      this.#emit({ v: ROOM_PROTOCOL_VERSION, ch: "pod", kind: "state", state: wire });
    });
  }

  /** The log's saving as the organizer sees it. */
  get saveStatus(): EpicSaveStatus {
    return {
      failing: this.#failures > 0,
      stuck: this.#failures >= SAVE_STUCK_AFTER,
      failures: this.#failures,
    };
  }

  /**
   * Runs `send` once the log is saved up to `needs` entries (with a store), in the order asked: nothing is told to a
   * table before the log that explains it is on disk, so a reload never rebuilds a state older than what tables heard.
   * `needs` only grows, so an item that is ready has nothing waiting before it.
   */
  #later(needs: number, send: () => void): void {
    if (!this.#options.store || needs <= this.#savedLength) {
      this.#run(send);
      return;
    }
    this.#outbox.push({ needs, send });
  }

  #run(send: () => void): void {
    try {
      send();
    } catch {
      // A send that throws (the socket, the organizer's own table) is dropped like an unsent message: syncs re-send.
    }
  }

  #release(): void {
    while (this.#outbox.length > 0 && (this.#outbox[0] as { needs: number }).needs <= this.#savedLength) {
      this.#run((this.#outbox.shift() as { send: () => void }).send);
    }
  }

  /** A table host's `pod:event`. Nothing here throws: a message it cannot use is dropped. */
  receive(table: string, seq: number, event: unknown): void {
    if (!this.#options.groups.some((g) => g.groupId === table)) return;
    if (seq === POD_LINK_SEQ) {
      if (isPodSync(event)) this.#sync(table, event.inboundSeq, event.shared);
      return;
    }
    const state = this.#state;
    if (!state || !isTaggedEvent(event, "type")) return;
    const result = receiveOutbound(state, table as GroupId, { seq, event: event as PodOutboundEvent });
    if (!result.ok) {
      // A gap (or an event the reducer refuses): the table is told how many it has and re-sends from there.
      this.#ack(table, state);
      return;
    }
    if (result.duplicate) return;
    this.#apply(result.state, result.delivered);
  }

  /** The organizer gives up a table (plan Q-C (b)): the game goes on without it. */
  dropTable(table: string): void {
    const state = this.#state;
    if (!state) return;
    const result = markGroupDropped(state, table as GroupId);
    if (!result.ok || result.duplicate) return;
    this.#apply(result.state, result.delivered);
  }

  dispose(): void {
    if (this.#timer !== null) (this.#options.clearTimer ?? clearTimeout)(this.#timer as never);
    this.#timer = null;
    if (this.#retry !== null) (this.#options.clearTimer ?? clearTimeout)(this.#retry as never);
    this.#retry = null;
    this.#disposed = true;
    this.#queue.length = 0;
    this.#outbox.length = 0;
  }

  /** Settles once the save under way has finished (committed, or failed and waiting to retry: see `saveStatus`). */
  async flushed(): Promise<void> {
    await this.#writing;
  }

  /** Forgets the saved log (the game is over or the room closed). */
  async clearSaved(): Promise<void> {
    await this.#writing;
    await this.#options.store?.clear(this.#options.roomId).catch(() => {});
  }

  // -- internals --------------------------------------------------------------------------------------------------

  #sync(table: string, inboundSeq: number, shared: SharedPodState | null): void {
    if (!this.#state) {
      // The first table to speak gives the shared record (every group builds the same one from the game's counts).
      if (!shared) return;
      this.#shared = shared;
      this.#state = createPodCoordinator({ ...this.#setup, shared });
    }
    const state = this.#state;
    this.#ack(table, state);
    for (const entry of inboundSince(state, table as GroupId, inboundSeq))
      this.#deliver(table, entry.sequence, entry.event, state.log.length);
    this.broadcast();
  }

  #ack(table: string, state: PodCoordinatorState): void {
    const received = state.groups.find((g) => g.groupId === table)?.received ?? 0;
    this.#deliver(table, POD_LINK_SEQ, { kind: "podSyncAck", received }, state.log.length);
  }

  #apply(next: PodCoordinatorState, delivered: readonly PodDelivery[]): void {
    this.#state = next;
    this.#save();
    for (const delivery of delivered) {
      this.#deliver(delivery.groupId, delivery.sequence, delivery.event, next.log.length);
    }
    this.broadcast();
  }

  #deliver(table: string, sequence: number, event: PodInboundEvent | PodSyncAck, needs: number): void {
    this.#later(needs, () => {
      const local = this.#options.local;
      if (local && local.table === table) {
        local.deliver(sequence, event);
        return;
      }
      this.#emit({ v: ROOM_PROTOCOL_VERSION, ch: "pod", kind: "inbound", table, seq: sequence, event });
    });
  }

  /** Starts writing the log if no write is under way and no retry is waiting; a write covers the newest log. */
  #save(): void {
    if (!this.#options.store || this.#writing || this.#retry !== null || this.#disposed) return;
    this.#writing = this.#write().finally(() => {
      this.#writing = null;
    });
  }

  async #write(): Promise<void> {
    const store = this.#options.store;
    if (!store) return;
    while (!this.#disposed) {
      const state = this.#state;
      const shared = this.#shared;
      if (!state || !shared || state.log.length <= this.#savedLength) return;
      const record: EpicLogRecord = {
        roomId: this.#options.roomId,
        setup: { ...this.#setup, shared },
        log: state.log,
        savedAt: (this.#options.now ?? Date.now)(),
        epoch: this.#epoch,
      };
      try {
        await store.save(record);
      } catch {
        this.#failures += 1;
        this.#options.onSaveStatus?.(this.saveStatus);
        this.#scheduleRetry();
        return;
      }
      this.#savedLength = Math.max(this.#savedLength, record.log.length);
      if (this.#failures > 0) {
        this.#failures = 0;
        this.#options.onSaveStatus?.(this.saveStatus);
      }
      this.#release();
    }
  }

  #scheduleRetry(): void {
    if (this.#disposed || this.#retry !== null) return;
    const wait = Math.min(SAVE_RETRY_MAX_MS, SAVE_RETRY_MS * 2 ** Math.max(0, this.#failures - 1));
    const setTimer = this.#options.setTimer ?? ((run, ms) => setTimeout(run, ms));
    this.#retry = setTimer(() => {
      this.#retry = null;
      this.#save();
    }, wait);
  }

  #emit(message: ClientMessage): void {
    this.#queue.push(message);
    this.#drain();
  }

  #drain(): void {
    const now = (this.#options.now ?? Date.now)();
    this.#budget = Math.min(SEND_BURST, this.#budget + ((now - this.#refilledAt) / 1000) * POD_PER_SECOND);
    this.#refilledAt = now;
    while (this.#queue.length > 0 && this.#budget >= 1) {
      // A state broadcast that a newer one replaces is not worth a send of its own.
      const message = this.#queue.shift() as ClientMessage;
      if (
        message.ch === "pod" &&
        message.kind === "state" &&
        this.#queue.some((m) => m.ch === "pod" && m.kind === "state")
      )
        continue;
      this.#budget -= 1;
      this.#options.send(message);
    }
    if (this.#queue.length > 0 && this.#timer === null) {
      const setTimer = this.#options.setTimer ?? ((run, ms) => setTimeout(run, ms));
      this.#timer = setTimer(() => {
        this.#timer = null;
        this.#drain();
      }, DRAIN_MS);
    }
  }
}

const sameGroups = (a: readonly PodCoordinatorGroupSetup[], b: readonly PodCoordinatorGroupSetup[]): boolean =>
  a.length === b.length &&
  a.every((g, i) => g.groupId === b[i]?.groupId && g.podId === b[i]?.podId && g.players === b[i]?.players);
