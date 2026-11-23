/**
 * The messages of the live-room worker (`workers/live-room.worker.ts`), plain data only. The worker owns the room's
 * socket and the publisher (`live-publisher.ts`); the main thread posts events and reads status, and the engine worker
 * streams the game over a port, as it does for Discord presence.
 */
import type { Command, GameOutcome } from "@mc/engine";
import type {
  DeckRefusalCode,
  HostActivityStep,
  TablePlan,
  RoomBuild,
  RoomDeck,
  RoomDevice,
  ServerMessage,
} from "@mc/sync-worker/room-protocol";
import type { LiveGame, LiveStatus } from "./live-publisher.js";
import type { LobbySeatSpec, LobbySettingsPatch, RoomState, SeatDeckEntry } from "./room-state.js";

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
  /**
   * Back into the room named by the address's `#room=<CODE>` after a reload: as the host when this device holds that
   * room's host token (`live-room-store.ts`), otherwise as a guest with its stored seat tokens.
   */
  | { readonly kind: "room-rejoin"; readonly code: string; readonly name: string }
  /** `closeRoom`: a host who confirmed closing the lobby for everyone asks the room to shut down first. */
  | { readonly kind: "room-leave"; readonly closeRoom?: boolean }
  | { readonly kind: "room-lobby"; readonly settings?: LobbySettingsPatch; readonly seats?: readonly LobbySeatSpec[] }
  | {
      readonly kind: "room-seat";
      readonly op: "request" | "release" | "assign" | "deny";
      readonly seat: string;
      readonly participant?: string;
    }
  | { readonly kind: "room-say"; readonly text: string }
  /** Host only: the setup step the host is in (`idle` clears it), shown to everyone as a status line. */
  | { readonly kind: "room-activity"; readonly step: HostActivityStep; readonly scenario?: string }
  /** Host only: the table the host picked, as ids (`null` clears it), shown to everyone in the lobby. */
  | { readonly kind: "room-table-plan"; readonly plan: TablePlan | null }
  /** My deck for a seat I hold, or (host only) a preset for any seat. */
  | { readonly kind: "room-deck"; readonly seat: string; readonly deck: RoomDeck }
  /** Host only: the full deck of every seat (answered with a `room-decks` carrying the same `id`). */
  | { readonly kind: "room-decks-request"; readonly id: number }
  /** Host only: tells a seat's holder why their deck was refused at Start. */
  | {
      readonly kind: "room-deck-refuse";
      readonly seat: string;
      readonly code: DeckRefusalCode;
      readonly reason: string;
    }
  /** A guest's watcher (the replay worker) takes the room's game over this port: `RoomFeedOut` in, `RoomFeedIn` back. */
  | { readonly kind: "room-follow"; readonly port: MessagePort }
  | { readonly kind: "room-unfollow" }
  /** Brings the chat back from its pop-out window (`live/chat-popout-protocol.ts`): the window is told to close. */
  | { readonly kind: "chat-popout-recall" }
  /** This tab is opening a pop-out window with `token`: its relay listens on that token's channel only. */
  | { readonly kind: "chat-popout-arm"; readonly token: string };

/** The live-room worker to main (and, as `LiveStatusMessage`, to the presence worker). */
export type LiveRoomOut =
  | { readonly kind: "status"; readonly status: LiveStatus }
  | { readonly kind: "room"; readonly state: RoomState }
  /** The answer to a `room-decks-request`: the lists, or null when the room did not answer or this is not the host. */
  | { readonly kind: "room-decks"; readonly id: number; readonly decks: readonly SeatDeckEntry[] | null }
  /** The room refused the host's game start as its lobby had changed (`lobby-changed`); the room dropped that game. */
  | { readonly kind: "room-start-refused" }
  /** The chat's pop-out window opened or went away (closed, brought back, or its heartbeat stopped). */
  | { readonly kind: "chat-popout"; readonly open: boolean };

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
  /** The game now on the table is not watchable (or there is none): leave the previous game's room. */
  | { readonly kind: "none" };

/**
 * The live-room worker to the engine worker, over the same port: `enabled` says the worker is up (the engine then
 * posts the current game if it is watchable), `resync` asks for the whole game again after a gap in its log.
 */
export type LiveControlMessage = { readonly kind: "enabled"; readonly on: boolean } | { readonly kind: "resync" };
