/**
 * The chat's pop-out window (desktop only): a second window that shows a room's chat while the lobby (or the game) keeps
 * the screen. The room worker stays the only socket; it owns a BroadcastChannel named for the room and the pop-out
 * talks to it there (BroadcastChannel works in every current browser, unlike SharedWorker, and in a worker).
 *
 * Everything here is plain data and small classes with injected clocks, so the protocol, the heartbeat and the relay are
 * tested without a browser (`chat-popout-protocol.test.ts`).
 */
import type { RoomState } from "./room-state.js";

/** The pop-out beats this often while open; the room side beats back at the same pace so the window notices a dead tab. */
export const POPOUT_BEAT_MS = 2000;
/** No beat for this long and the other side is gone (a window that crashed or lost its tab says no `bye`). */
export const POPOUT_TIMEOUT_MS = 3 * POPOUT_BEAT_MS + 500;

/** One channel per room, so two rooms (or two tabs in different rooms) never hear each other. */
export const popoutChannelName = (roomId: string): string => `mc-room-chat:${roomId}`;

export interface PopoutLine {
  readonly name: string;
  readonly text: string;
  readonly mine: boolean;
}

/** What the pop-out shows, from the room's state: everything it draws and nothing it could use to act. */
export interface PopoutSnapshot {
  readonly code: string;
  readonly lines: readonly PopoutLine[];
  /** Lines that arrived live since the pop-out opened are the window's own business; this is the room's running count. */
  readonly live: number;
  /** The host switched chat off for the room. */
  readonly chatOn: boolean;
  /** The room is over (closed or the socket gave up): the window says so and offers to close. */
  readonly ended: boolean;
}

/** The pop-out window to the room worker. */
export type PopoutToRoom =
  | { readonly kind: "hello" }
  | { readonly kind: "beat" }
  | { readonly kind: "bye" }
  | { readonly kind: "say"; readonly text: string };

/** The room worker to the pop-out window. */
export type RoomToPopout =
  | { readonly kind: "snapshot"; readonly snapshot: PopoutSnapshot }
  | { readonly kind: "beat" }
  /** The player brought the chat back to the lobby: the window closes. */
  | { readonly kind: "recall" }
  /** This device left the room: the window says so and offers to close. */
  | { readonly kind: "left" };

export function popoutSnapshotOf(state: RoomState): PopoutSnapshot {
  return {
    code: state.code ?? "",
    lines: state.chat.map((line) => ({ name: line.name ?? "?", text: line.text, mine: line.mine })),
    live: state.chatLive,
    chatOn: state.settings?.chat !== false,
    ended: state.connection === "ended",
  };
}

/** Whether the other side is still there: it must beat within `timeoutMs` of the last sign. */
export class Heartbeat {
  readonly #timeoutMs: number;
  #last: number | null = null;

  constructor(timeoutMs: number = POPOUT_TIMEOUT_MS) {
    this.#timeoutMs = timeoutMs;
  }

  beat(now: number): void {
    this.#last = now;
  }

  stop(): void {
    this.#last = null;
  }

  /** False before the first beat, after `stop`, and once `timeoutMs` has passed without one. */
  alive(now: number): boolean {
    return this.#last !== null && now - this.#last <= this.#timeoutMs;
  }
}

/** The part of a BroadcastChannel the relay uses. */
export interface PopoutChannel<In, Out> {
  postMessage(message: Out): void;
  onmessage: ((event: { readonly data: In }) => void) | null;
  close(): void;
}

export interface PopoutRelayDeps {
  readonly open: (name: string) => PopoutChannel<PopoutToRoom, RoomToPopout>;
  /** Sends a line through the lobby's own path (`room-say`): the room trims, caps and rate limits it. */
  readonly say: (text: string) => void;
  /** The pop-out opened or went away (closed, recalled, or silent past the timeout). */
  readonly onOpenChange: (open: boolean) => void;
  readonly now: () => number;
  /** Runs `fn` every `ms` until the returned function is called. */
  readonly every: (fn: () => void, ms: number) => () => void;
}

/**
 * The room worker's end of the pop-out channel. `onState` feeds it each `RoomState`; it keeps a channel open while a room
 * is joined, answers a window's `hello` with the current snapshot, forwards its lines to `say`, and tells the main thread
 * whether a window is open so the lobby can show "Chat is in its own window".
 */
export class ChatPopoutRelay {
  readonly #deps: PopoutRelayDeps;
  readonly #heartbeat = new Heartbeat();
  #roomId: string | null = null;
  #channel: PopoutChannel<PopoutToRoom, RoomToPopout> | null = null;
  #snapshot: PopoutSnapshot | null = null;
  #open = false;
  #stopTicking: (() => void) | null = null;

  constructor(deps: PopoutRelayDeps) {
    this.#deps = deps;
  }

  get isOpen(): boolean {
    return this.#open;
  }

  onState(state: RoomState): void {
    if (state.role === "none" || state.roomId === null || state.roomId === "") {
      this.#leave();
      return;
    }
    if (state.roomId !== this.#roomId) {
      this.#leave();
      this.#roomId = state.roomId;
      const channel = this.#deps.open(popoutChannelName(state.roomId));
      channel.onmessage = (event) => this.#hear(event.data);
      this.#channel = channel;
    }
    this.#snapshot = popoutSnapshotOf(state);
    if (this.#open) this.#channel?.postMessage({ kind: "snapshot", snapshot: this.#snapshot });
  }

  /** Brings the chat back to the lobby: the window is told to close. */
  recall(): void {
    if (!this.#open) return;
    this.#channel?.postMessage({ kind: "recall" });
    this.#setOpen(false);
  }

  /** Drops the channel (the worker is going away). */
  close(): void {
    this.#leave();
  }

  #leave(): void {
    if (this.#open) this.#channel?.postMessage({ kind: "left" });
    this.#setOpen(false);
    if (this.#channel) {
      this.#channel.onmessage = null;
      this.#channel.close();
    }
    this.#channel = null;
    this.#roomId = null;
    this.#snapshot = null;
  }

  #hear(message: PopoutToRoom): void {
    switch (message.kind) {
      case "hello":
        this.#heartbeat.beat(this.#deps.now());
        this.#setOpen(true);
        if (this.#snapshot) this.#channel?.postMessage({ kind: "snapshot", snapshot: this.#snapshot });
        return;
      case "beat":
        if (!this.#open) return;
        this.#heartbeat.beat(this.#deps.now());
        this.#channel?.postMessage({ kind: "beat" });
        return;
      case "bye":
        this.#setOpen(false);
        return;
      case "say":
        if (this.#open && typeof message.text === "string") this.#deps.say(message.text);
        return;
    }
  }

  #setOpen(open: boolean): void {
    if (open === this.#open) return;
    this.#open = open;
    this.#stopTicking?.();
    this.#stopTicking = null;
    if (open) {
      // A window that crashed says no `bye`: the lobby takes its chat back once the beats stop.
      this.#stopTicking = this.#deps.every(() => this.#check(), POPOUT_BEAT_MS);
    } else {
      this.#heartbeat.stop();
    }
    this.#deps.onOpenChange(open);
  }

  #check(): void {
    if (this.#open && !this.#heartbeat.alive(this.#deps.now())) this.#setOpen(false);
  }
}
