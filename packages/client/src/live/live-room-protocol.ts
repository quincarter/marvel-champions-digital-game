/**
 * The messages of the live-room worker (`workers/live-room.worker.ts`), plain data only. The worker owns the room's
 * socket and the publisher (`live-publisher.ts`); the main thread posts events and reads status, and the engine worker
 * streams the game over a port, as it does for Discord presence.
 */
import type { Command, GameOutcome } from "@mc/engine";
import type { LiveGame, LiveStatus } from "./live-publisher.js";

/** Main thread to the live-room worker. */
export type LiveRoomIn =
  | {
      readonly kind: "init";
      readonly enabled: boolean;
      /** `syncServiceUrl()`, read on main where the build's env is. */
      readonly syncUrl: string | null;
      /** The web version's address a watch link hangs off (the page's own, or the web version in the apps). */
      readonly watchBase: string;
      /** The engine worker's end of the channel; the game arrives on it. */
      readonly gamePort: MessagePort;
      /** The presence worker's end, to post status to (Discord's "Watch live" button, a later task). */
      readonly presencePort?: MessagePort;
    }
  | { readonly kind: "enabled"; readonly on: boolean };

/** The live-room worker to main (and, as `LiveStatusMessage`, to the presence worker). */
export interface LiveRoomOut {
  readonly kind: "status";
  readonly status: LiveStatus;
}

/** The status as the presence worker receives it over its port. */
export interface LiveStatusMessage {
  readonly kind: "live";
  readonly status: LiveStatus;
}

/** Engine worker to the live-room worker, over the game port. Posted only while the setting is on. */
export type LiveGameMessage =
  /** A game began, resumed, or the setting was switched on mid-game. A different `gameKey` is a new room. */
  | { readonly kind: "game"; readonly gameKey: string; readonly game: LiveGame }
  /** Command number `count` was applied. `checksum` is `replayChecksum` of the state after it, when one is due. */
  | {
      readonly kind: "command";
      readonly gameKey: string;
      readonly command: Command;
      readonly count: number;
      readonly checksum?: string;
      readonly outcome?: GameOutcome;
    }
  | { readonly kind: "rewind"; readonly gameKey: string; readonly to: number };

/** The live-room worker to the engine worker, over the same port: whether to stream at all. */
export interface LiveEnabledMessage {
  readonly kind: "enabled";
  readonly on: boolean;
}
