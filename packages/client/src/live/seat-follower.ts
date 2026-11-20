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
import { SeatCore, type SeatPlayer, type SeatSnapshot } from "./seat-core.js";
import type { SeatBackend, SeatEvent, SeatFeedPropose } from "./seat-protocol.js";
import { WatchFeed, type WatchAction } from "./watch-feed.js";

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
  readonly openTimeoutMs?: number;
  readonly waitTimeoutMs?: number;
  readonly setTimer?: (run: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

type Opened = { readonly cardPool: CardPool; readonly snapshot: SeatSnapshot };

export class SeatFollower implements SeatBackend {
  readonly #o: SeatFollowerOptions;
  readonly #core: SeatCore;
  readonly #feed = new WatchFeed(FIRST_TABLE);
  #chain: Promise<void> = Promise.resolve();
  #opening: { resolve: (opened: Opened) => void; reject: (error: Error) => void } | null = null;
  #timer: unknown = null;
  #disposed = false;
  #listener: ((event: SeatEvent) => void) | null = null;
  #presence: SeatEvent | null = null;

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
        else if (!data.connected) this.#queue(this.#feed.onDisconnected());
      };
      feed.start?.();
    });
  }

  propose(command: Command, base: number): void {
    this.#o.feed.postMessage({ kind: "propose", command, base });
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
      this.#emit({ type: "refused", base: message.base, reason: message.reason });
      return;
    }
    this.#queue(this.#feed.onMessage(message));
  }

  #queue(actions: readonly WatchAction[]): void {
    if (actions.length === 0 || this.#disposed) return;
    this.#chain = this.#chain.then(async () => {
      for (const action of actions) {
        if (this.#disposed) return;
        try {
          this.#apply(action);
        } catch (cause) {
          const error = cause instanceof Error ? cause : new Error(String(cause));
          if (this.#opening) this.#failOpening(error);
          else this.#fail();
        }
      }
    });
  }

  #apply(action: WatchAction): void {
    switch (action.kind) {
      case "open":
      case "reset": {
        const opened = this.#core.open(
          { header: action.header, commands: action.commands, checksums: action.checksums, packs: this.#o.packs },
          action.kind,
        );
        this.#clearTimer();
        if (action.kind === "open") {
          const opening = this.#opening;
          this.#opening = null;
          opening?.resolve(opened);
          if (this.#presence) this.#emit(this.#presence);
        } else this.#update(opened.snapshot);
        return;
      }
      case "append": {
        if (!this.#core.opened) return;
        this.#update(this.#core.append(action.commands, action.checksums ?? undefined));
        return;
      }
      case "rewind":
        if (!this.#core.opened) return;
        this.#update(this.#core.rewind(action.to));
        return;
      case "end":
        if (this.#core.opened) this.#emit({ type: "over", reason: "ended" });
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

  #update(snapshot: SeatSnapshot): void {
    this.#emit({ type: "update", snapshot, divergedAt: this.#core.divergedAt });
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
