/**
 * The messages of the live-room worker (`workers/live-room.worker.ts`), plain data only. The worker owns the room's
 * socket and the publisher (`live-publisher.ts`); the main thread posts events and reads status, and the engine worker
 * streams the game over a port, as it does for Discord presence.
 */
import type { Command, GameOutcome, PodInboundEvent, PodOutbound, SharedPodState } from "@mc/engine";
import type {
  DeckRefusalCode,
  ProposalRefusal,
  HostActivityStep,
  VillainCursorState,
  TablePlan,
  RoomBuild,
  RoomDeck,
  RoomDevice,
  ServerMessage,
} from "@mc/sync-worker/room-protocol";
import type { LiveGame, LiveStatus } from "./live-publisher.js";
import type {
  LobbyPod,
  LobbySeatSpec,
  LobbySettingsPatch,
  LobbyTableSpec,
  RoomState,
  SeatDeckEntry,
} from "./room-state.js";

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
  /** `closeRoom`: a host who confirmed closing the lobby for everyone asks the room to shut down first. */
  | { readonly kind: "room-leave"; readonly closeRoom?: boolean }
  | {
      readonly kind: "room-lobby";
      readonly settings?: LobbySettingsPatch;
      readonly seats?: readonly LobbySeatSpec[];
      /** Compare and swap: the lobby revision the change was worked out against; the room refuses it if it moved on. */
      readonly ifRev?: number;
    }
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
  /** Table host: ends a wait for the pod coordinator that has stuck (`RoomState.epic.podStuck`). */
  | { readonly kind: "room-pod-release" }
  /** Host only (issue #881): the answer to a seat holder's request (`RoomState.requests`), once the host has done what it asks. */
  | { readonly kind: "room-answer"; readonly id: string; readonly accepted: boolean }
  /** Guest only (issue #881): asks the host to undo or change something; the answer arrives as `RoomState.myRequest`. */
  | { readonly kind: "room-ask"; readonly what: "undo" | "adjust"; readonly note: string }
  /** Guest only: dismisses the answer to the last request. */
  | { readonly kind: "room-ask-clear" }
  /** Host only: the setup step the host is in (`idle` clears it), shown to everyone as a status line. */
  | { readonly kind: "room-activity"; readonly step: HostActivityStep; readonly scenario?: string }
  /** Host only: where my villain phase screen is, for guests' screens to follow (relayed, memory only). */
  | {
      readonly kind: "room-villain-cursor";
      readonly key: string;
      readonly at: number;
      readonly state: VillainCursorState;
    }
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
  | { readonly kind: "room-follow"; readonly port: MessagePort; readonly feedId?: number }
  /** `feedId` names the feed to close: a closed old watch never closes the one that replaced it. */
  | { readonly kind: "room-unfollow"; readonly feedId?: number }
  /** Dev builds only: damage to the shared villain from this table's group, as if its engine had emitted it. */
  | { readonly kind: "room-dev-shared-damage"; readonly amount: number }
  /** Epic: watch `table` in place of the one watched now (the watch view then opens its feed again). */
  | { readonly kind: "room-watch-table"; readonly table: string };

/** The live-room worker to main (and, as `LiveStatusMessage`, to the presence worker). */
export type LiveRoomOut =
  | { readonly kind: "status"; readonly status: LiveStatus }
  | { readonly kind: "room"; readonly state: RoomState }
  /** The answer to a `room-decks-request`: the lists, or null when the room did not answer or this is not the host. */
  | { readonly kind: "room-decks"; readonly id: number; readonly decks: readonly SeatDeckEntry[] | null }
  /** The room refused the host's game start as its lobby had changed (`lobby-changed`); the room dropped that game. */
  | { readonly kind: "room-start-refused" }
  /** A guest's room was closed mid-game: the game it held, sent just ahead of the room's ended state. */
  | {
      readonly kind: "room-salvage";
      readonly header: unknown;
      readonly commands: readonly unknown[];
      readonly adjusted?: true;
    };

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
  | {
      readonly kind: "game";
      readonly gameKey: string;
      readonly game: LiveGame;
      readonly room?: string;
      /** Epic Multiplayer: a group of a pod with a remote coordinator (`EngineSessionCore.livePodGame`). */
      readonly pod?: LivePodGame;
    }
  /** Command number `count` was applied. `checksum` is `replayChecksum` of the state after it, when one is due. */
  | {
      readonly kind: "command";
      readonly gameKey: string;
      readonly command: Command;
      readonly count: number;
      readonly checksum?: string;
      readonly outcome?: GameOutcome;
      /** Epic Multiplayer: what this command told the pod, and the inbound events the group has applied by now. */
      readonly pod?: {
        readonly outbound: readonly PodOutbound[];
        readonly inboundSeq: number;
        readonly awaiting?: boolean;
      };
    }
  | { readonly kind: "rewind"; readonly gameKey: string; readonly to: number }
  /** A seat holder's proposal was turned down (issue #881): the room sends it to `to` (a participant id) alone. */
  | {
      readonly kind: "refuse";
      readonly gameKey: string;
      readonly to: string;
      readonly reason: ProposalRefusal;
      readonly base: number;
      readonly pid?: number;
    }
  /** A seat holder's proposal was applied (issue #881): the room tells `to` alone, ahead of the command's own echo. */
  | {
      readonly kind: "accept";
      readonly gameKey: string;
      readonly to: string;
      readonly base: number;
      readonly pid?: number;
    }
  /** The game now on the table is not watchable (or there is none): leave the previous game's room. */
  | { readonly kind: "none" };

/** A group of an Epic pod, as its engine announces it to the pod link when the game begins or resumes. */
export interface LivePodGame {
  readonly groupId: string;
  readonly inboundSeq: number;
  readonly shared: SharedPodState | null;
  readonly players: number;
  /** Every outbound event the saved log produced (a replay), so a reloaded host re-sends what the coordinator lacks. */
  readonly outbox?: readonly PodOutbound[];
  /** The engine waits for the coordinator's `sharedAck`. */
  readonly awaiting?: boolean;
}

/**
 * The live-room worker to the engine worker, over the same port: `enabled` says the worker is up (the engine then
 * posts the current game if it is watchable), `resync` asks for the whole game again after a gap in its log.
 */
export type LiveControlMessage =
  | { readonly kind: "enabled"; readonly on: boolean }
  | { readonly kind: "resync" }
  /**
   * The pod coordinator's inbound event `sequence` for this table's group (Epic Multiplayer): the engine worker applies it
   * as a `Command externalEvent` at its next boundary, in order, once each.
   */
  | { readonly kind: "pod-release"; readonly gameKey: string }
  | {
      readonly kind: "pod-inbound";
      readonly gameKey: string;
      readonly sequence: number;
      readonly event: PodInboundEvent;
    }
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
      /** The proposer's id for the proposal, echoed in a refusal of it. */
      readonly pid?: number;
      /** The proposer's state identity at `base` (`replayChecksum`); absent means the proposal cannot be judged current. */
      readonly stamp?: string;
    };
