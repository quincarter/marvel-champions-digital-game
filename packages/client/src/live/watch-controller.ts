/**
 * Follows a live game room for the replay worker (issue #876, docs/live-game-rooms.md section 5, item 4). The worker owns
 * the socket and the rebuilding, so the main thread never parses a room message or applies a command: it receives
 * `LiveWatchEvent`s. A `WatchFeed` turns room messages into actions, applied here in order to a `ReplayCore`.
 */
import type { Command, GameOutcome } from "@mc/engine";
import type { RoomCapability, RoomDevice, ServerMessage } from "@mc/sync-worker/room-protocol";
import type { PackRuntime } from "../packs/pack-runtime.js";
import { ReplayOpenError, type ReplayOpened, type ReplayOpenSource } from "../replay/replay-core.js";
import type { ReplayInfo } from "../replay/replay-session.js";
import type { RoomFeedIn, RoomFeedOut } from "./live-room-protocol.js";
import { RoomSocket, type RoomSocketDeps } from "./room-socket.js";
import type { LiveWatchEvent } from "./watch-events.js";
import { WatchFeed, type WatchAction } from "./watch-feed.js";

/** The slice of `ReplayCore` a live watch drives. */
export interface LiveWatchCore {
  open(source: ReplayOpenSource): Promise<ReplayOpened>;
  liveAppend(commands: readonly Command[], checksums?: Readonly<Record<string, string>>): ReplayInfo;
  liveRewind(to: number, adjusted?: boolean): ReplayInfo;
  liveEnd(outcome: GameOutcome | null, adjusted?: boolean): ReplayInfo;
}

/**
 * A guest's feed from the room worker (issue #880), in place of a socket of its own: the same room messages, relayed
 * over a `MessagePort`. The worker answers `{ kind: "resync" }` with the whole game again.
 */
export interface LiveFeedPort {
  onmessage: ((event: { readonly data: unknown }) => void) | null;
  postMessage(message: RoomFeedIn): void;
  start?(): void;
  close(): void;
}

export interface LiveWatcherOptions {
  readonly core: LiveWatchCore;
  /** The room's socket address and id, for a watcher that opens its own socket (a `#watch=` link). */
  readonly baseUrl: string;
  readonly roomId: string;
  /** Set for a guest of a lobby room: the room worker's feed is used and no socket is opened. */
  readonly feed?: LiveFeedPort;
  readonly packs: readonly PackRuntime[];
  readonly emit: (event: LiveWatchEvent) => void;
  readonly deps?: RoomSocketDeps;
  /** This device's platform and form, said in the watcher's own hello. */
  readonly device?: RoomDevice;
  /** How long to wait for the room to answer with the game before calling it gone. */
  readonly openTimeoutMs?: number;
  /** How long to wait for a host that has not started the game yet. */
  readonly waitTimeoutMs?: number;
}

/** A room that has not sent its game by then is closed, unknown, or unreachable. */
export const WATCH_OPEN_TIMEOUT_MS = 15_000;
/** A room that exists but whose host has not started the game yet is waited for this long instead. */
export const WATCH_WAIT_TIMEOUT_MS = 45_000;
const CAPS: readonly RoomCapability[] = ["watch"];

export class LiveWatcher {
  readonly #o: LiveWatcherOptions;
  readonly #feed = new WatchFeed();
  #socket: RoomSocket | null = null;
  #chain: Promise<void> = Promise.resolve();
  #info: ReplayInfo | null = null;
  #opening: { resolve: (opened: ReplayOpened) => void; reject: (error: Error) => void } | null = null;
  #timer: unknown = null;
  #disposed = false;
  /** The newest presence the room reported, held while the game is still being opened. */
  #presence: LiveWatchEvent | null = null;

  constructor(options: LiveWatcherOptions) {
    this.#o = options;
  }

  /** Connects and settles once the game has arrived and is open; rejects with `missing` when the room is not there. */
  open(): Promise<ReplayOpened> {
    return new Promise((resolve, reject) => {
      this.#opening = { resolve, reject };
      this.#arm(this.#o.openTimeoutMs ?? WATCH_OPEN_TIMEOUT_MS);
      this.#connect();
    });
  }

  dispose(): void {
    this.#disposed = true;
    if (this.#o.feed) {
      this.#o.feed.onmessage = null;
      this.#o.feed.close();
    }
    this.#socket?.close();
    this.#socket = null;
    this.#clearTimer();
    // A watcher closed while still opening settles its open, so nothing waits on it.
    const opening = this.#opening;
    this.#opening = null;
    opening?.reject(new ReplayOpenError("missing"));
  }

  /** (Re)starts the clock after which an open that has no game is called gone. */
  #arm(ms: number): void {
    this.#clearTimer();
    const setTimer = this.#o.deps?.setTimer ?? ((run, ms) => setTimeout(run, ms));
    this.#timer = setTimer(() => this.#failOpening(new ReplayOpenError("missing")), ms);
  }

  #connect(): void {
    const feed = this.#o.feed;
    if (feed) {
      // Already listening on a resync: the worker sends the game again over the same port.
      if (feed.onmessage) {
        feed.postMessage({ kind: "resync" });
        return;
      }
      feed.onmessage = (event) => {
        const data = event.data as RoomFeedOut;
        if (data.kind === "server") this.#queue(this.#feed.onMessage(data.message));
        else if (data.kind === "gone") this.#failFollowing();
        else if (!data.connected) this.#queue(this.#feed.onDisconnected());
      };
      feed.start?.();
      return;
    }
    this.#socket?.close();
    const socket = new RoomSocket({
      baseUrl: this.#o.baseUrl,
      roomId: this.#o.roomId,
      caps: CAPS,
      ...(this.#o.device ? { device: this.#o.device } : {}),
      ...(this.#o.deps ? { deps: this.#o.deps } : {}),
      onGone: () => {
        // The room cannot be reached for good: before the game opened that is "gone", after it the feed is lost.
        if (this.#opening) this.#failOpening(new ReplayOpenError("missing"));
        else this.#failFollowing();
      },
      onConnection: (connected) => {
        if (!connected) this.#queue(this.#feed.onDisconnected());
      },
      onMessage: (message: ServerMessage) => this.#queue(this.#feed.onMessage(message)),
    });
    this.#socket = socket;
    socket.connect();
  }

  #queue(actions: readonly WatchAction[]): void {
    if (actions.length === 0 || this.#disposed) return;
    this.#chain = this.#chain.then(async () => {
      for (const action of actions) {
        if (this.#disposed) return;
        try {
          await this.#apply(action);
        } catch (cause) {
          const error = cause instanceof Error ? cause : new Error(String(cause));
          if (this.#opening) this.#failOpening(error);
          else this.#failFollowing();
        }
      }
    });
  }

  async #apply(action: WatchAction): Promise<void> {
    const { core, emit } = this.#o;
    switch (action.kind) {
      case "open":
      case "reset": {
        const opened = await core.open({
          kind: "live",
          header: action.header,
          commands: action.commands,
          checksums: action.checksums,
          outcome: (action.outcome ?? null) as GameOutcome | null,
          packs: this.#o.packs,
        });
        this.#info = opened.info;
        this.#clearTimer();
        if (action.kind === "open") {
          this.#opening?.resolve(opened);
          this.#opening = null;
          if (this.#presence) emit(this.#presence);
        } else emit({ type: "info", info: opened.info, change: "reset", added: 0 });
        return;
      }
      case "append": {
        if (!this.#info) return;
        const before = this.#info.length;
        this.#info = core.liveAppend(action.commands, action.checksums);
        emit({ type: "info", info: this.#info, change: "append", added: this.#info.length - before });
        return;
      }
      case "rewind":
        if (!this.#info) return;
        this.#info = core.liveRewind(action.to, action.adjusted === true);
        emit({ type: "info", info: this.#info, change: "rewind", added: 0 });
        return;
      case "end":
        if (!this.#info) return;
        this.#info = core.liveEnd((action.outcome ?? null) as GameOutcome | null, action.adjusted === true);
        emit({ type: "info", info: this.#info, change: "end", added: 0 });
        return;
      case "resync":
        // A gap in the log: reconnecting makes the room send the whole log again.
        this.#connect();
        return;
      case "waiting":
        // The room is there but the host has not started the game: wait longer before calling it gone.
        if (this.#opening) this.#arm(this.#o.waitTimeoutMs ?? WATCH_WAIT_TIMEOUT_MS);
        return;
      case "refused":
        if (this.#opening) this.#failOpening(new ReplayOpenError("full"));
        else this.#failFollowing();
        return;
      case "presence":
        this.#presence = { type: "presence", hostConnected: action.hostConnected, watchers: action.watchers };
        if (!this.#opening) emit(this.#presence);
        return;
      case "closed":
        if (this.#opening) return this.#failOpening(new ReplayOpenError("missing"));
        emit({ type: "closed", reason: action.reason });
        return;
    }
  }

  /** Following broke after the game was open (a reset that could not be read, a log past the cap): say so and stop. */
  #failFollowing(): void {
    if (this.#disposed) return;
    this.dispose();
    this.#o.emit({ type: "failed" });
  }

  #failOpening(error: Error): void {
    const opening = this.#opening;
    if (!opening) return;
    this.#opening = null;
    this.#clearTimer();
    this.dispose();
    opening.reject(error);
  }

  #clearTimer(): void {
    if (this.#timer === null) return;
    (this.#o.deps?.clearTimer ?? ((handle) => clearTimeout(handle as ReplayHandle)))(this.#timer);
    this.#timer = null;
  }
}

type ReplayHandle = ReturnType<typeof setTimeout>;
