/**
 * A seated guest's end of the room, for the seat worker (issue #881): it follows the room's game over the room worker's
 * feed port, like a watcher (`watch-controller.ts`, the same `WatchFeed`), but into a `SeatCore` that holds the whole
 * engine session, and it carries the guest's proposals out over the same port. The worker owns the port and the
 * rebuilding, so the main thread never parses a room message or applies a command: it receives `SeatEvent`s.
 *
 * A `SeatFollower` is also the in-thread `SeatBackend` the tests run (the worker is only message plumbing around it).
 */
import type { Command, LegalActions, PlayerId } from "@mc/engine";
import type { ServerMessage } from "@mc/sync-worker/room-protocol";
import { FIRST_TABLE } from "@mc/sync-worker/room-protocol";
import type { CardPool } from "../engine/host.js";
import type { PackRuntime } from "../packs/pack-runtime.js";
import { ReplayOpenError } from "../replay/replay-core.js";
import type { PaymentState } from "../view/payment-model.js";
import type { JudgedPayment } from "../view/payment-verdict.js";
import { WATCH_OPEN_TIMEOUT_MS, WATCH_WAIT_TIMEOUT_MS } from "./watch-controller.js";
import type { RoomFeedIn, RoomFeedOut } from "./live-room-protocol.js";
import type { RoomPlayRecord } from "../engine/room-play.js";
import { logPrint, writeGuestFinished, type SeatFinishDeps } from "./seat-finish.js";
import { SeatCore, type SeatPlayer, type SeatSnapshot } from "./seat-core.js";
import type { SeatBackend, SeatEvent, SeatFeedPropose } from "./seat-protocol.js";
import { WatchFeed, type WatchAction } from "./watch-feed.js";

/** The room's own refusals of a `propose` (it never reached the host). */
const PROPOSAL_ROOM_REFUSALS: ReadonlySet<string> = new Set([
  "not-seated",
  "build-mismatch",
  "out-of-order",
  "rate-limited",
  "no-such-participant",
  "too-large",
  "bad-message",
  "not-allowed",
]);

/** The room worker's end of the feed, as a watcher gets it (`room-follow`), which also carries a seat's proposals. */
export interface SeatFeedPort {
  onmessage: ((event: { readonly data: unknown }) => void) | null;
  postMessage(message: RoomFeedIn | SeatFeedPropose): void;
  start?(): void;
  close(): void;
}

export interface SeatFollowerOptions {
  readonly feed: SeatFeedPort;
  readonly packs: readonly PackRuntime[];
  readonly core?: SeatCore;
  /** Where a guest's finished row is written (#909); without it, `finish` writes nothing. */
  readonly finishDeps?: SeatFinishDeps;
  /** The admitted game's identity (`RoomPlayRecord.gameKey`): the stored result for it is reconciled at join (#909). */
  readonly gameKey?: string;
  readonly openTimeoutMs?: number;
  readonly waitTimeoutMs?: number;
  readonly setTimer?: (run: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

type Opened = { readonly cardPool: CardPool; readonly snapshot: SeatSnapshot };

/** The most unanswered proposals a follower remembers for a late room refusal. */
const MAX_OUTSTANDING = 64;

/** Timed retries of a guest's final write after a storage failure (a later room message retries at once, beyond these). */
const MAX_FINISH_RETRIES = 6;
const FINISH_RETRY_BASE_MS = 500;
const FINISH_RETRY_MAX_MS = 15_000;

export class SeatFollower implements SeatBackend {
  readonly #o: SeatFollowerOptions;
  readonly #core: SeatCore;
  readonly #feed = new WatchFeed(FIRST_TABLE);
  #chain: Promise<void> = Promise.resolve();
  /** The proposals sent and not yet answered by the log or a refusal (id to `base`): what a room refusal can be about. */
  readonly #outstanding = new Map<number, number>();
  #opening: { resolve: (opened: Opened) => void; reject: (error: Error) => void } | null = null;
  #timer: unknown = null;
  #disposed = false;
  /** The log epoch of the table as the room last said it (`log`, `rewind`); undefined from an older room. */
  #epoch: number | undefined;
  #listener: ((event: SeatEvent) => void) | null = null;
  #presence: SeatEvent | null = null;
  /** A guest's record waiting for the room's authoritative end of this admission's game (#909). */
  #finishing: RoomPlayRecord | null = null;
  /** The guest's record once asked to finish: a reopen can invalidate its row and the next end replace it. */
  #record: RoomPlayRecord | null = null;
  /** The room's end of the game (an `end`, or a `log` that carries an outcome) arrived, not reopened since. */
  #ended = false;
  /** How many reopens (a rewind, a command after the end, a log or welcome that is not the ended game) were seen. */
  #reopens = 0;
  /** A reopen invalidated a row: the next end replaces it even when it looks the same. */
  #replace = false;
  /** Fingerprint of the log the room's end was for: a reconnect `log` with the same content is the same game. */
  #endedPrint = "";
  /** What the room's welcome said of the table: false when it is running (not ended), null when not told. */
  #tableEnded: boolean | null = null;
  /** Every row write and invalidation runs through this chain, one at a time. */
  #io: Promise<void> = Promise.resolve();
  /** The pending retry of a failed final write, and how many timed ones ran since the last success. */
  #retryTimer: unknown = null;
  #retries = 0;
  /** Bumped when a record is (re)armed (a finish call, a reopen): a write that began earlier must not clear the newer one. */
  #armed = 0;
  /** Latched when the header, a rewind or the end says the host's game was adjusted (#909). */
  #adjusted = false;
  /** A row invalidation (reopen, join reconcile) not yet confirmed: kept and retried until the row is abandoned. */
  #invalidation: (() => Promise<void>) | null = null;

  constructor(options: SeatFollowerOptions) {
    this.#o = options;
    this.#core = options.core ?? new SeatCore();
  }

  onEvent(listener: (event: SeatEvent) => void): void {
    this.#listener = listener;
  }

  /** Starts following; settles once the game has arrived and is open, rejects when the room has none in time. */
  open(): Promise<Opened> {
    return new Promise((resolve, reject) => {
      this.#opening = { resolve, reject };
      this.#arm(this.#o.openTimeoutMs ?? WATCH_OPEN_TIMEOUT_MS);
      const feed = this.#o.feed;
      feed.onmessage = (event) => {
        const data = event.data as RoomFeedOut;
        if (data.kind === "server") this.#onServer(data.message);
        else if (data.kind === "gone") this.#fail();
        else if (!data.connected) this.#queue(this.#feed.onDisconnected(), this.#epoch);
      };
      feed.start?.();
    });
  }

  propose(command: Command, base: number, pid: number): void {
    this.#outstanding.set(pid, base);
    // Proposals nobody ever answered (a lost reply) would pile up: keep only the newest few, which the room still
    // remembers. The map keeps insertion order, so the first key is the oldest.
    while (this.#outstanding.size > MAX_OUTSTANDING) this.#outstanding.delete(this.#outstanding.keys().next().value!);
    this.#o.feed.postMessage({ kind: "propose", command, base, pid, stamp: this.#core.stampAt(base) });
  }

  async setPlayers(players: readonly SeatPlayer[]): Promise<SeatSnapshot> {
    this.#core.hold(players);
    // Behind whatever the room has delivered so far, so the answer is of the newest table.
    await this.#chain;
    return this.#core.republish();
  }

  async legalActions(playerId: PlayerId): Promise<LegalActions> {
    await this.#chain;
    return this.#core.legalActions(playerId);
  }

  async judgePayment(playerId: PlayerId, payment: PaymentState): Promise<JudgedPayment> {
    await this.#chain;
    return this.#core.judgePayment(playerId, payment);
  }

  /**
   * The room's game ended for this device's record (#909): writes a guest's finished row, one per admitted game, and
   * only on the room's authoritative `end` (it carries the adjusted flag). Until that has arrived, and this seat has
   * applied the last command, it waits and writes then; a reopen of the game sets the row aside and the next end
   * replaces it. Known limit: a host that never sends the end leaves the guest without a row.
   */
  async finish(record: RoomPlayRecord): Promise<boolean> {
    if (!this.#o.finishDeps || record.role !== "guest") return false;
    await this.#chain;
    this.#finishing = record;
    this.#record = record;
    this.#armed++;
    return this.#tryFinish(false);
  }

  /** Runs `job` after every earlier write or invalidation, so two of them never overlap (one row per admission). */
  #serial<T>(job: () => Promise<T>): Promise<T> {
    const run = this.#io.then(job, job);
    this.#io = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /** `deferred`: not the answer to a `finish` call, so a `saved` event tells the main thread a row changed. */
  #tryFinish(deferred = true): Promise<boolean> {
    return this.#serial(async () => {
      const record = this.#finishing;
      const deps = this.#o.finishDeps;
      // Only the room's end of this admission's game commits a row: it carries the adjusted flag, which a locally
      // terminal last command does not. Until it arrives the record stays waiting.
      if (!record || !deps || !this.#ended) return false;
      this.#cancelRetry();
      const armed = this.#armed;
      try {
        // A row not yet set aside must not be judged or kept by this write: the invalidation settles first.
        await this.#drainInvalidation();
        const result = await writeGuestFinished(this.#core, record, deps, this.#adjusted, this.#replace);
        // The record stays pending until the write is confirmed (or there is nothing to write): a failure, or a game not
        // over here yet, leaves it for the next try. Writes are serialized, so two tries never overlap.
        if (result !== "waiting" && this.#armed === armed && this.#finishing === record) this.#finishing = null;
        this.#retries = 0;
        if (result === "written" && this.#ended) this.#replace = false;
        // A write that replaced the row (the reopen set `#replace`) makes an invalidation still pending moot.
        if (result === "written" && this.#armed === armed) this.#invalidation = null;
        if (result === "written" && deferred) this.#emit({ type: "saved" });
        return result === "written";
      } catch {
        // A rejected list, load or write: still dirty. The final room message may already be behind us, so nothing else
        // would retry it; a bounded backoff does.
        this.#scheduleRetry();
        return false;
      }
    });
  }

  #scheduleRetry(): void {
    if (this.#retryTimer !== null || this.#retries >= MAX_FINISH_RETRIES || (!this.#finishing && !this.#invalidation)) {
      return;
    }
    const delay = Math.min(FINISH_RETRY_BASE_MS * 2 ** this.#retries, FINISH_RETRY_MAX_MS);
    this.#retries++;
    const setTimer = this.#o.setTimer ?? ((run, after) => setTimeout(run, after));
    this.#retryTimer = setTimer(() => {
      this.#retryTimer = null;
      if (this.#invalidation) void this.#runInvalidation();
      if (this.#finishing) void this.#tryFinish();
    }, delay);
  }

  /** Runs the pending invalidation, if any; throws when it fails (it stays pending). Call inside `#serial`. */
  async #drainInvalidation(): Promise<void> {
    const job = this.#invalidation;
    if (!job) return;
    await job();
    if (this.#invalidation === job) this.#invalidation = null;
  }

  /** Keeps `job` pending and runs it now, serialized; a failure schedules the same bounded backoff as the final write. */
  #queueInvalidation(job: () => Promise<void>): void {
    this.#invalidation = job;
    void this.#runInvalidation();
  }

  #runInvalidation(): Promise<void> {
    return this.#serial(async () => {
      try {
        await this.#drainInvalidation();
        if (!this.#invalidation) this.#retries = 0;
      } catch {
        this.#scheduleRetry();
      }
    });
  }

  #cancelRetry(): void {
    if (this.#retryTimer === null) return;
    (this.#o.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)))(this.#retryTimer);
    this.#retryTimer = null;
  }

  /**
   * The room reopened the game this guest may have a finished row for (a rewind, a same-count rewind, a command after
   * the end, or a log that differs from the ended game): the row no longer stands. It is set `abandoned` (no reader
   * counts that as a win or a loss) behind any write in flight, and the record waits for the next end, which replaces
   * the row in place.
   */
  #reopened(): void {
    this.#reopens++;
    if (!this.#ended) return;
    this.#ended = false;
    const record = this.#record;
    const deps = this.#o.finishDeps;
    if (!record || !deps) return;
    this.#finishing = record;
    this.#armed++;
    // Whatever row exists is stale: the next end replaces it even when it looks the same.
    this.#replace = true;
    this.#queueInvalidation(async () => {
      const row = (await deps.storage.list()).find(
        (meta) => meta.roomPlay?.role === "guest" && meta.roomPlay.gameKey === record.gameKey,
      );
      if (!row || row.status === "abandoned") return;
      await deps.storage.setStatus(row.id, "abandoned", deps.now());
      this.#emit({ type: "saved" });
    });
  }

  /**
   * A fresh follower joining an admission this device already has a stored result for (it saved a win, reloaded, and the
   * host has since undone it): a result stands only when the room's log is the stored row's log and the table is not
   * running. A different log, or a table the room says is running, sets the row aside (`abandoned`), and the record of
   * the stored row waits to replace it at the next end. Needs no state from an earlier follower.
   */
  #reconcileJoin(commands: readonly Command[], hasOutcome: boolean): void {
    const deps = this.#o.finishDeps;
    const gameKey = this.#o.gameKey;
    if (!deps || gameKey === undefined) return;
    const running = !hasOutcome && this.#tableEnded === false;
    const print = logPrint(commands);
    // The stored-row lookup is asynchronous: a reopen that lands while it is pending finds no record to invalidate.
    const reopensAtJoin = this.#reopens;
    this.#queueInvalidation(async () => {
      const row = (await deps.storage.list()).find(
        (meta) => meta.roomPlay?.role === "guest" && meta.roomPlay.gameKey === gameKey,
      );
      if (!row?.roomPlay) return;
      const stored = await deps.storage.load(row.id);
      if (stored && logPrint(stored.commands) === print && !running) {
        // The stored result stands, and this follower adopts it: a later reopen (a rewind, a new command, a different
        // log, an active welcome) must be able to set the row aside through the normal path, which needs the record.
        this.#record ??= row.roomPlay;
        // A reopen that arrived while the row was being found had no record to invalidate: do it now, and if the room
        // has ended the game again since, the next write replaces the row.
        if (this.#reopens !== reopensAtJoin) {
          const endedAgain = this.#ended;
          this.#ended = true;
          this.#reopened();
          if (endedAgain) {
            this.#ended = true;
            void this.#tryFinish();
          }
        }
        return;
      }
      this.#replace = true;
      this.#record ??= row.roomPlay;
      this.#finishing ??= this.#record;
      this.#armed++;
      if (row.status === "abandoned") return;
      await deps.storage.setStatus(row.id, "abandoned", deps.now());
      this.#emit({ type: "saved" });
    });
  }

  dispose(): void {
    this.#disposed = true;
    this.#o.feed.onmessage = null;
    try {
      this.#o.feed.close();
    } catch {
      // already closed
    }
    this.#clearTimer();
    const opening = this.#opening;
    this.#opening = null;
    opening?.reject(new ReplayOpenError("missing"));
  }

  #onServer(message: ServerMessage): void {
    if (message.ch === "game" && message.kind === "proposal-refused" && message.table === FIRST_TABLE) {
      if (message.pid !== undefined) this.#outstanding.delete(message.pid);
      this.#emit({
        type: "refused",
        base: message.base,
        reason: message.reason,
        ...(message.pid === undefined ? {} : { pid: message.pid }),
      });
      return;
    }
    if (message.ch === "game" && message.kind === "proposal-accepted" && message.table === FIRST_TABLE) {
      if (message.pid !== undefined) this.#outstanding.delete(message.pid);
      this.#emit({
        type: "accepted",
        base: message.base,
        ...(typeof message.epoch === "number" ? { epoch: message.epoch } : {}),
        ...(message.pid === undefined ? {} : { pid: message.pid }),
      });
      return;
    }
    // The room itself turned the proposal down (not seated, other build, rate limit, no host): it never reached the host,
    // so no `proposal-refused` is coming; the seat fails at once rather than after its wait. Only a refusal that names a
    // proposal of mine counts: a refused chat line or seat request carries no `pid` and is not about any of them.
    if (
      message.ch === "room" &&
      message.kind === "refused" &&
      message.pid !== undefined &&
      PROPOSAL_ROOM_REFUSALS.has(message.reason)
    ) {
      const base = this.#outstanding.get(message.pid);
      if (base === undefined) return;
      this.#outstanding.delete(message.pid);
      this.#emit({ type: "refused", base, reason: message.reason, pid: message.pid });
      return;
    }
    if (message.ch === "room" && message.kind === "welcome") {
      const table = message.tables.find((t) => t.id === FIRST_TABLE);
      if (table) this.#tableEnded = table.ended;
    }
    // The log epoch the room says the table's log is in (a `log` or `rewind` carries it; an older room sends none).
    if (
      message.ch === "game" &&
      message.table === FIRST_TABLE &&
      (message.kind === "log" || message.kind === "rewind")
    ) {
      this.#epoch = typeof message.epoch === "number" ? message.epoch : undefined;
    }
    if (message.ch === "game" && message.kind === "end" && message.table === FIRST_TABLE) this.#tableEnded = true;
    this.#queue(this.#feed.onMessage(message), this.#epoch);
  }

  /** `tableEnded`: what the room said of the table when these arrived (the welcome and the end, in arrival order). */
  #queue(
    actions: readonly WatchAction[],
    epoch: number | undefined,
    tableEnded: boolean | null = this.#tableEnded,
  ): void {
    if (actions.length === 0 || this.#disposed) return;
    this.#chain = this.#chain.then(async () => {
      for (const action of actions) {
        if (this.#disposed) return;
        try {
          this.#apply(action, epoch, tableEnded);
        } catch (cause) {
          const error = cause instanceof Error ? cause : new Error(String(cause));
          if (this.#opening) this.#failOpening(error);
          else this.#fail();
        }
      }
    });
  }

  #apply(action: WatchAction, epoch: number | undefined, tableEnded: boolean | null): void {
    switch (action.kind) {
      case "open":
      case "reset": {
        if ((action.header as { readonly adjusted?: unknown }).adjusted === true) this.#adjusted = true;
        const opened = this.#core.open(
          { header: action.header, commands: action.commands, checksums: action.checksums, packs: this.#o.packs },
          action.kind,
        );
        // A reconnect's `log` carries no outcome (the `end` frame is separate): the same ended game again (same log)
        // leaves the row alone. A different log is a reopened game.
        // The welcome of the reconnect is authoritative: a table it says is running is not the ended game, even when
        // the log is byte for byte the same (the host reopened it with a same-count rewind while this seat was away).
        if (
          action.kind === "reset" &&
          this.#ended &&
          tableEnded !== false &&
          logPrint(action.commands) === this.#endedPrint
        ) {
          // still the ended game
        } else if (action.outcome != null) {
          this.#ended = true;
          this.#endedPrint = logPrint(action.commands);
        } else this.#reopened();
        if (action.kind === "open") this.#reconcileJoin(action.commands, action.outcome != null);
        this.#clearTimer();
        if (action.kind === "open") {
          const opening = this.#opening;
          this.#opening = null;
          opening?.resolve(opened);
          // The open's own answer has no room for it: the epoch of the log just opened follows as an event.
          if (epoch !== undefined) this.#emit({ type: "epoch", epoch });
          if (this.#presence) this.#emit(this.#presence);
        } else this.#update(opened.snapshot, epoch);
        return;
      }
      case "append": {
        if (!this.#core.opened) return;
        if (action.commands.length > 0) this.#reopened();
        // `#outstanding` stays: the room may still refuse a proposal the log moved past, by its `pid`.
        this.#update(this.#core.append(action.commands, action.checksums ?? undefined), epoch);
        return;
      }
      case "rewind":
        if (action.adjusted === true) this.#adjusted = true;
        if (!this.#core.opened) return;
        this.#reopened();
        this.#update(this.#core.rewind(action.to), epoch);
        return;
      case "end":
        if (action.adjusted === true) this.#adjusted = true;
        this.#ended = true;
        this.#endedPrint = logPrint(this.#core.finishedInput()?.commands ?? []);
        if (this.#core.opened) this.#emit({ type: "over", reason: "ended" });
        if (this.#finishing) void this.#tryFinish();
        return;
      case "resync":
        // A gap in the log: the room worker sends the whole game again over the same port.
        this.#o.feed.postMessage({ kind: "resync" });
        return;
      case "waiting":
        if (this.#opening) this.#arm(this.#o.waitTimeoutMs ?? WATCH_WAIT_TIMEOUT_MS);
        return;
      case "refused":
        if (this.#opening) this.#failOpening(new ReplayOpenError("full"));
        else this.#fail();
        return;
      case "presence": {
        const event: SeatEvent = { type: "presence", hostConnected: action.hostConnected, watchers: action.watchers };
        this.#presence = event;
        if (!this.#opening) this.#emit(event);
        return;
      }
      case "closed":
        if (this.#opening) return this.#failOpening(new ReplayOpenError("missing"));
        this.#emit({ type: "over", reason: "closed" });
        return;
    }
  }

  #update(snapshot: SeatSnapshot, epoch: number | undefined): void {
    this.#emit({
      type: "update",
      snapshot,
      divergedAt: this.#core.divergedAt,
      ...(epoch === undefined ? {} : { epoch }),
    });
    if (this.#invalidation) void this.#runInvalidation();
    if (this.#finishing) void this.#tryFinish();
  }

  #emit(event: SeatEvent): void {
    if (!this.#disposed) this.#listener?.(event);
  }

  #fail(): void {
    if (this.#disposed) return;
    this.dispose();
    this.#listener?.({ type: "failed" });
  }

  #failOpening(error: Error): void {
    const opening = this.#opening;
    if (!opening) return;
    this.#opening = null;
    this.#clearTimer();
    this.dispose();
    opening.reject(error);
  }

  #arm(ms: number): void {
    this.#clearTimer();
    const setTimer = this.#o.setTimer ?? ((run, after) => setTimeout(run, after));
    this.#timer = setTimer(() => this.#failOpening(new ReplayOpenError("missing")), ms);
  }

  #clearTimer(): void {
    if (this.#timer === null) return;
    (this.#o.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)))(this.#timer);
    this.#timer = null;
  }
}
