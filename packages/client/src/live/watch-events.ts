/** What a live watch reports to the replay's host (`replay/replay-host.ts`), as plain data: it crosses the replay worker's port. */
import type { ReplayInfo } from "../replay/replay-session.js";

export type LiveWatchEvent =
  /** The replay changed. `added`: commands new at the end (an append); `reset`: the whole log was read again. */
  | {
      readonly type: "info";
      readonly info: ReplayInfo;
      readonly change: "append" | "rewind" | "end" | "reset";
      readonly added: number;
    }
  /** Whether the host is in the room (and this side is connected to it), and how many are watching. */
  | { readonly type: "presence"; readonly hostConnected: boolean; readonly watchers: number }
  /** The room closed: the game is an ordinary replay from here. */
  | { readonly type: "closed"; readonly reason: "ended" | "idle" | "disabled" | "host" }
  /** Following stopped for good: the game could not be applied or read (a bad reset, too long a log). */
  | { readonly type: "failed" };

/** What the transport shows of a live game. */
export interface LiveState {
  readonly hostConnected: boolean;
  readonly watchers: number;
  /** The game ended (its outcome is known) or the room closed: no more commands come. */
  readonly over: boolean;
  /** Following stopped because the live feed could not be read: the strip says so. */
  readonly failed: boolean;
}

export const INITIAL_LIVE_STATE: LiveState = { hostConnected: false, watchers: 0, over: false, failed: false };
