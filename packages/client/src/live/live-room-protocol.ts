/**
 * The messages of the live-room worker (`workers/live-room.worker.ts`), plain data only. The worker owns the room's
 * socket and the publisher (`live-publisher.ts`); the main thread posts events and reads status, and the engine worker
 * streams the game over a port, as it does for Discord presence.
 */
import type { Command, GameOutcome } from "@mc/engine";
import type { ProposalRefusal, RoomBuild, RoomDevice, ServerMessage } from "@mc/sync-worker/room-protocol";
import type { LiveGame, LiveStatus } from "./live-publisher.js";
import type { LobbyPod, LobbySeatSpec, LobbySettingsPatch, LobbyTableSpec, RoomState } from "./room-state.js";

/** Main thread to the live-room worker. */
export type LiveRoomIn =
  | {
      readonly kind: "init";
      readonly enabled: boolean;
      /** `syncServiceUrl()`, read on main where the build's env is. */
      readonly syncUrl: string | null;
      /** The web version's address a watch link hangs off (the page's own, or the web version in the apps). */
      readonly watchBase: string;
      /** The engine worker's end of the channel; the game arrives on it. Absent where there is no engine worker. */
      readonly gamePort?: MessagePort;
      /** This build, as rooms compare it (`hello.build`): `CLIENT_VERSION` and `POOL_VERSION`, read on main. */
      readonly build?: RoomBuild;
      /** This device's platform and form (`platform/room-device.ts`), read on main; shown in the room's roster. */
      readonly device?: RoomDevice;
      /** The saved "Online name", the host's name for a lobby room resumed after a reload (`room-host` and `room-join` update it). */
      readonly onlineName?: string;
      /** The presence worker's end, to post status to (Discord's "Watch live" button, a later task). */
      readonly presencePort?: MessagePort;
    }
  | { readonly kind: "enabled"; readonly on: boolean }
  // Rooms and the lobby (issue #880). Each is one call of `platform/room.ts`; the answer is a `room` state.
  | { readonly kind: "room-host"; readonly name: string }
  /** `target` is a room code or a room id. */
  | { readonly kind: "room-join"; readonly target: string; readonly name: string }
  | { readonly kind: "room-leave" }
  | { readonly kind: "room-lobby"; readonly settings?: LobbySettingsPatch; readonly seats?: readonly LobbySeatSpec[] }
  | {
      readonly kind: "room-seat";
      readonly op: "request" | "release" | "assign" | "deny" | "take-over" | "give-back";
      readonly seat: string;
      readonly participant?: string;
    }
  | { readonly kind: "room-say"; readonly text: string }
  // Epic Multiplayer (issue #882). Each is one call of `platform/room.ts`.
  /** Organizer: Epic mode with these tables, pods and seats (a `lobby-set`). */
  | {
      readonly kind: "room-epic";
      readonly tables: readonly LobbyTableSpec[];
      readonly pods: readonly LobbyPod[];
      readonly seats: readonly LobbySeatSpec[];
    }
  /** Organizer: makes `participant` (or nobody, `null`) the host of `table`. */
  | { readonly kind: "room-table-host"; readonly table: string; readonly participant: string | null }
  /** The tables whose logs this device receives. */
  | { readonly kind: "room-follow-tables"; readonly tables: "all" | readonly string[] }
  /** Organizer: starts the game (the signal every table host starts its own group on). */
  | { readonly kind: "room-epic-start" }
  /** Organizer: gives up a table whose host left (the game goes on without it). */
  | { readonly kind: "room-epic-drop"; readonly table: string }
  /** Host only (issue #881): the answer to a seat holder's request (`RoomState.requests`), once the host has done what it asks. */
  | { readonly kind: "room-answer"; readonly id: string; readonly accepted: boolean }
  /** Guest only (issue #881): asks the host to undo or change something; the answer arrives as `RoomState.myRequest`. */
  | { readonly kind: "room-ask"; readonly what: "undo" | "adjust"; readonly note: string }
  /** Guest only: dismisses the answer to the last request. */
  | { readonly kind: "room-ask-clear" }
  /** A guest's watcher (the replay worker) takes the room's game over this port: `RoomFeedOut` in, `RoomFeedIn` back. */
  | { readonly kind: "room-follow"; readonly port: MessagePort }
  | { readonly kind: "room-unfollow" };

/** The live-room worker to main (and, as `LiveStatusMessage`, to the presence worker). */
export type LiveRoomOut =
  | { readonly kind: "status"; readonly status: LiveStatus }
  | { readonly kind: "room"; readonly state: RoomState };

/** The room worker to a guest's watcher, over the follow port: what a room socket would have delivered. */
export type RoomFeedOut =
  | { readonly kind: "server"; readonly message: ServerMessage }
  | { readonly kind: "connection"; readonly connected: boolean }
  /** The room session is over (left, replaced, gone): the watcher stops following. A closed room arrives as a `closed` message. */
  | { readonly kind: "gone" };

/** A guest's watcher to the room worker: the log had a gap, send the game again. */
export type RoomFeedIn = { readonly kind: "resync" };

/** The status as the presence worker receives it over its port. */
export interface LiveStatusMessage {
  readonly kind: "live";
  readonly status: LiveStatus;
}

/** Engine worker to the live-room worker, over the game port. Posted only while the setting is on. */
export type LiveGameMessage =
  /** A game began, resumed, or the setting was switched on mid-game. A different `gameKey` is a new room. */
  | { readonly kind: "game"; readonly gameKey: string; readonly game: LiveGame; readonly room?: string }
  /** Command number `count` was applied. `checksum` is `replayChecksum` of the state after it, when one is due. */
  | {
      readonly kind: "command";
      readonly gameKey: string;
      readonly command: Command;
      readonly count: number;
      readonly checksum?: string;
      readonly outcome?: GameOutcome;
    }
  | { readonly kind: "rewind"; readonly gameKey: string; readonly to: number }
  /** A seat holder's proposal was turned down (issue #881): the room sends it to `to` (a participant id) alone. */
  | {
      readonly kind: "refuse";
      readonly gameKey: string;
      readonly to: string;
      readonly reason: ProposalRefusal;
      readonly base: number;
    }
  /** The game now on the table is not watchable (or there is none): leave the previous game's room. */
  | { readonly kind: "none" };

/**
 * The live-room worker to the engine worker, over the same port: `enabled` says the worker is up (the engine then
 * posts the current game if it is watchable), `resync` asks for the whole game again after a gap in its log.
 */
export type LiveControlMessage =
  | { readonly kind: "enabled"; readonly on: boolean }
  | { readonly kind: "resync" }
  /**
   * A seat holder's proposal for the engine worker to judge (issue #881). `players` are the engine players behind the
   * seats the room says the proposer may act for; `command` is untrusted and `base` the log length it was built on.
   */
  | {
      readonly kind: "proposal";
      readonly gameKey: string;
      readonly from: string;
      readonly players: readonly string[];
      readonly command: unknown;
      readonly base: number;
      /** The proposer's state identity at `base` (`replayChecksum`); absent means the proposal cannot be judged current. */
      readonly stamp?: string;
    };
