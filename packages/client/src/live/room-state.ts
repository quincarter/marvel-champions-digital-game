/**
 * What the UI knows of a live room (issue #880, docs/live-game-rooms.md section 8), as plain data. The room worker owns
 * the connection and builds this; `platform/room.ts` hands it to the screens (`onRoomState`). Nothing here is a socket,
 * a token or a secret: seat tokens and the host token stay in the worker and its IndexedDB.
 *
 * The UI words everything itself: `connection`, `problem` and `refusal` are codes, never sentences.
 */
import type { ReachableCard, SharedPodState } from "@mc/engine";
import type {
  ChatLine,
  LobbyMode,
  LobbyPod,
  HostActivityStep,
  DeckRefusalCode,
  LobbySeatSpec,
  LobbySettings,
  LobbySettingsPatch,
  LobbyTableSpec,
  RefusalReason,
  RoomBuild,
  RoomDeck,
  RoomDeckSummary,
  RoomDevice,
  TeamId,
  VillainCursorState,
  VillainPacing,
  TablePlan,
} from "@mc/sync-worker/room-protocol";

export type {
  TeamId,
  TablePlan,
  ChatLine,
  HostActivityStep,
  DeckRefusalCode,
  LobbyMode,
  LobbyPod,
  LobbySeatSpec,
  LobbySettings,
  LobbySettingsPatch,
  LobbyTableSpec,
  RefusalReason,
  RoomBuild,
  RoomDeck,
  RoomDeckSummary,
  RoomDevice,
  VillainCursorState,
  VillainPacing,
};

/** `none`: not in a room. `host`: made it, runs the game. `guest`: joined someone else's. */
export type RoomRole = "none" | "host" | "guest";

/**
 * `idle`: no room. `connecting`: making the room, looking up the code, or opening the socket for the first time.
 * `connected`: welcomed. `reconnecting`: the socket dropped after being up (it retries by itself; seats are kept).
 * `ended`: no more traffic, `problem` says why.
 */
export type RoomConnection = "idle" | "connecting" | "connected" | "reconnecting" | "ended";

/**
 * Why the room is `ended` or never came up:
 * - `no-name`: no online name set yet (ask for it, then call again);
 * - `no-service`: this build has no sync service; `unavailable`: it did not answer; `rate-limited`, `disabled`: the
 *   service said so (rooms are off, or too many made or looked up from this address);
 * - `not-found`: the code or link names no open room (wrong, expired or closed); `full`: the room has no space;
 * - `gone`: the room vanished or no longer honours the host token; `replaced`: another device took over as host;
 * - `closed-ended` / `closed-idle` / `closed-disabled`: the room closed itself (all games over, idle for 12 hours,
 *   switched off); `closed-host`: the host closed it.
 */
export type RoomProblem =
  | "no-name"
  | "no-service"
  | "unavailable"
  | "rate-limited"
  | "disabled"
  | "not-found"
  | "full"
  | "gone"
  | "replaced"
  | "closed-ended"
  | "closed-idle"
  | "closed-disabled"
  | "closed-host";

/**
 * How a build that is not the host's differs, from the one holding it: `hostNewer` it is behind and should update,
 * `hostOlder` it is ahead (the host should update), `rules` the version is the same but the rules code is not (a preview
 * against a release), `other` the versions differ but cannot be ordered (a dev build).
 */
export type BuildGap = "hostNewer" | "hostOlder" | "rules" | "other";

export interface RoomParticipant {
  /** Stable while connected; a reconnect is a new id (seats follow the seat token). */
  readonly id: string;
  readonly name: string;
  readonly role: "host" | "watcher";
  readonly me: boolean;
  /** Runs the same build as the host (both versions); false means it cannot take a seat. Always true for the host. */
  readonly buildMatches: boolean;
  /** How their build differs from the host's; absent while `buildMatches`. */
  readonly buildGap?: BuildGap;
  /** Where they play: platform and form (absent when their client sent none). Show it as an icon or a short label. */
  readonly device?: RoomDevice;
  /** Ids of the seats this participant holds. */
  readonly seats: readonly string[];
}

export interface RoomSeatRequest {
  readonly participant: string;
  readonly name: string;
}

/**
 * Why the host's engine refused the deck I put in a seat at Start (`deck-refused`). Only the seat's holder ever has one.
 * `code` is for the UI to word or pick an action from; `reason` is the engine's own sentence (English), shown as the
 * detail. It goes away when I change the seat's deck, give the seat up or lose it.
 */
export interface RoomDeckProblem {
  readonly code: DeckRefusalCode;
  readonly reason: string;
}

/** One seat's full deck, as the room gives it to the host alone (`seat-decks`). Never part of `RoomState`. */
export interface SeatDeckEntry {
  readonly seat: string;
  /** The holder's participant id (a deck preset on a free seat has none). */
  readonly holder?: string;
  /** The host chose it, and the holder has not replaced it. */
  readonly preset: boolean;
  readonly deck: RoomDeck;
}

export interface RoomSeat {
  readonly id: string;
  /** An optional label the host set for the seat; empty for the usual open seat (the hero is the deck's). */
  readonly label: string;
  /**
   * The seat's deck as everyone sees it: hero, aspects, deck name, card count and mod refs (never the card list), or
   * null while no deck has been chosen. `deck.preset` is true when the host chose it (the holder may replace it).
   */
  readonly deck: RoomDeckSummary | null;
  /** Why my deck in this seat was refused at Start; null for everyone else's seat and while nothing is wrong. */
  readonly deckProblem: RoomDeckProblem | null;
  /** The holder's participant id, or null when free. May name a participant no longer connected (`holderConnected`). */
  readonly holder: string | null;
  readonly holderName: string | null;
  /** False when the holder is not in the room now: the seat is theirs until released or taken back by the host. */
  readonly holderConnected: boolean;
  /** The holder runs another build than the host's: shown, but they cannot play. */
  readonly mismatch: boolean;
  /** I hold it. */
  readonly mine: boolean;
  /**
   * The engine player this seat's hero is (`p1`..`p4`), set by the host at Start; null before that. Read it with
   * `seatOfPlayer` rather than matching it by hand.
   */
  readonly player: string | null;
  /** The host acts for this seat (its holder was away), until it gives it back. Nobody else may act for it. */
  readonly takenOver: boolean;
  /** The holder chose to show this hand to the table (`LobbySeat.showsHand`); absent reads as hidden. */
  readonly showsHand?: boolean;
  /**
   * Held, but the holder is not connected or has left the seat (handover off): the game waits on it unless the host
   * takes it over. A seat nobody holds (`holder` null, `player` set, game started) is vacant: its player left and the
   * host may take it over or hand it on (`settings.handover` off forbids both).
   */
  readonly away: boolean;
  /** Who asked for it and awaits the host (what the host's approve and deny buttons act on). */
  readonly requests: readonly RoomSeatRequest[];
  readonly requestedByMe: boolean;
  /** Competitive rooms: the seat's team; null in any other room, and before the host puts the seat on a team. */
  readonly team?: TeamId | null;
}

/**
 * A seat's holder asked the host for something (Host control rooms only; a Strict room refuses requests). The host
 * answers with `answerRequest(id, accepted)`. Kept in memory by the room worker: it does not survive a reload.
 */
export interface RoomRequest {
  /** Pass this to `answerRequest`. Stable until answered. */
  readonly id: string;
  /** The asker's participant id and name. */
  readonly from: string;
  readonly name: string;
  /** `undo`: take back the active hero's last move. `adjust`: a Manual adjust for the table. */
  readonly what: "undo" | "adjust";
  /** What the asker wrote, cleaned and at most 140 characters; "" when none. */
  readonly note: string;
  /** The asker's id for the ask, echoed in the answer so it lands on that ask (absent from an older client). */
  readonly rid?: number;
}

/**
 * A seated guest's own request to the host (Host control rooms), and what became of it: `waiting` until the host
 * answers, then `accepted` or `declined`. `seq` rises with each ask, so asking twice still shows. In memory only.
 */
export interface RoomAsk {
  readonly what: "undo" | "adjust";
  readonly status: "waiting" | "accepted" | "declined";
  readonly seq: number;
}

export interface RoomHostActivity {
  readonly step: Exclude<HostActivityStep, "idle">;
  /** The scenario the host has picked, once it has. */
  readonly scenario?: string;
}

/**
 * Where the host's villain phase screen is, for a guest's screen to follow (`LobbySettings.villainPacing` `host`).
 * Presentation only; memory only. `key` names the phase (its round), `at` is how many beats the host has shown.
 */
export interface RoomVillainCursor {
  readonly key: string;
  readonly at: number;
  readonly state: VillainCursorState;
}

export interface RoomChatLine extends ChatLine {
  readonly mine: boolean;
}

/** The last thing the room turned down, for the UI to word. `seq` rises with each, so the same reason twice still shows. */
export interface RoomRefusal {
  readonly reason: RefusalReason;
  /** The seat the refused request named, when it named one. */
  readonly seat?: string;
  readonly seq: number;
}

/**
 * Where an Epic table stands, in words the UI shows beside its name (Epic Multiplayer, issue #882):
 * - `lobby`: its game has not started; `setup`, `player`, `villain`: the phase its group is in;
 * - `halted`: the group stopped play after the shared scheme's completion (MC55 p. 21) and waits for the others;
 * - `waiting`: its host is not connected (the table waits for them to come back; the organizer may `dropTable`);
 * - `dropped`: the organizer gave the table up and the game goes on without it (plan Q-C);
 * - `over`: its game ended.
 * `dropped` beats `over`, `over` beats `waiting`, `waiting` beats `halted`, which beats the phase.
 */
export type EpicTableStatus = "lobby" | "setup" | "player" | "villain" | "halted" | "waiting" | "dropped" | "over";

/** What I am at an Epic table: I run its game (`host`), I hold a seat there (`player`), or I may only watch it. */
export type EpicTableRole = "host" | "player" | "watcher";

export interface EpicTable {
  readonly id: string;
  readonly name: string;
  /** The id of the pod it is in (`EpicPod.id`). */
  readonly pod: string;
  /** The table's difficulty as the organizer set it (opaque JSON; the UI reads what it put there). */
  readonly difficulty: unknown;
  /** The participant who runs the table's game, or null while it has none. */
  readonly host: string | null;
  readonly hostName: string | null;
  readonly hostConnected: boolean;
  /** Ids of the seats at this table (`RoomState.seats`), in order. */
  readonly seats: readonly string[];
  readonly myRole: EpicTableRole;
  readonly status: EpicTableStatus;
  /** Its group's round, 0 before setup ends. */
  readonly round: number;
  /** The table has a game (its host started it). */
  readonly started: boolean;
  /** Commands in its log, as the room last counted. */
  readonly commands: number;
  /** Watchers (not seat holders) following it. */
  readonly watching: number;
  /** I receive this table's log (`followTables`); a table I hold a seat at is always followed. */
  readonly followed: boolean;
}

export interface EpicPod {
  readonly id: string;
  readonly name: string;
  /** Ids of its tables, in the order the organizer listed them (the order "your pod" lists groups in). */
  readonly tables: readonly string[];
}

/**
 * The organizer's "start the game" signal, in `LobbySettings.tableRules.epic.start`. When it appears, every table host
 * starts its own group's game (`startEpicTable`); `seed` is the one the tables' own seeds are made from.
 */
export interface EpicStart {
  readonly id: string;
  readonly seed: number;
  /** The organizer's clock (ms since the epoch) when it started the game; the time-limit clock counts from it. */
  readonly at?: number;
}

/** A card of another table in my pod that I may attack or thwart as if it were in my game area (M6; 55041, 55046). */
export interface RemoteTarget {
  readonly table: string;
  readonly tableName: string;
  /** The card, as its owning group last reported it (`ReachableCard.by` says attack or thwart). */
  readonly card: ReachableCard;
}

/** The shared record and the game's outcome, as the organizer last broadcast them (`pod:state`). */
export interface EpicShared {
  readonly shared: SharedPodState;
  /** The game's outcome: every group wins or loses together (MC55 p. 21). */
  readonly outcome: "playing" | "won" | "lost";
}

/** An Epic room's part of `RoomState`; `RoomState.epic` is null in a standard room. */
export interface EpicState {
  /** I am the organizer (the room's host: owns the lobby and the pod coordinator). */
  readonly organizer: boolean;
  /** The table I run (organizer or table host), or null. */
  readonly hostsTable: string | null;
  /** The table I hold a seat at or run, or null. */
  readonly myTable: string | null;
  readonly tables: readonly EpicTable[];
  readonly pods: readonly EpicPod[];
  /** Null until the organizer starts the game. A table host starts its table when this appears (`startEpicTable`). */
  readonly start: EpicStart | null;
  /** The optional time limit in minutes (display only, plan Q-D); null when none is set. */
  readonly timeLimitMinutes: number | null;
  /** Null until the first `pod:state` arrives (the organizer broadcasts after each change and on return). */
  readonly pod: EpicShared | null;
  /** What I may attack or thwart in other tables of my pod: from the pod state, empty before it or with no table. */
  readonly remoteTargets: readonly RemoteTarget[];
  /** The tables whose logs I receive: `"all"` or their ids (a table I hold a seat at is always included). */
  readonly following: "all" | readonly string[];
  /**
   * Table host only: this table has waited too long for the pod coordinator (an unconfirmed event, a `sharedAck` that
   * never comes). Offer the host `releasePod()`: the group plays on, and its unanswered event is re-sent when a
   * coordinator returns. False otherwise.
   */
  readonly podStuck: boolean;
}

/** One team of a Competitive room (issue #883, docs/live-game-rooms.md section 11). */
export interface CompetitiveTeam {
  readonly team: TeamId;
  /** Ids of the seats on the team, in seat order (the first is the team's first player's seat). */
  readonly seats: readonly string[];
  /** A scenario for the other team is sealed in the room (its contents are never in the state, on any device but the host's reveal). */
  readonly submitted: boolean;
  readonly ready: boolean;
}

/** A Competitive room's part of `RoomState`; `RoomState.competitive` is null in any other room. */
export interface CompetitiveState {
  /** The team of the seats I hold; null when I hold none (a host who only runs the table, a watcher). */
  readonly myTeam: TeamId | null;
  readonly teams: Readonly<Record<TeamId, CompetitiveTeam>>;
  /** The tie-break option (plan Q9 C): on unless the host turned it off. */
  readonly tieBreaks: boolean;
  /** Every seat is on a team and the teams are a 1v1 or a 2v2 (what the room checks at the reveal). */
  readonly sized: boolean;
  /** Both teams are sized, have a scenario sealed and are ready: the host's `startCompetitive` will be answered. */
  readonly canStart: boolean;
  /** The room's revision of the teams, readiness and scenarios (`LobbyState.competitive.rev`); 0 from an older room. */
  readonly rev: number;
}

export interface RoomState {
  readonly role: RoomRole;
  readonly connection: RoomConnection;
  readonly problem: RoomProblem | null;
  readonly roomId: string | null;
  /** The 6-character code to share, once the room is known (a guest who joined by a bare id has none until `lobby`). */
  readonly code: string | null;
  /** `https://marvel.champions-digital-game.com/#join=<code>` (the web version's address, also from the apps). */
  readonly link: string | null;
  /** This device's name and participant id in the room, null until welcomed. */
  readonly me: { readonly id: string; readonly name: string } | null;
  /** Everyone in the room now (the host first), including me. */
  readonly participants: readonly RoomParticipant[];
  /** Null until the room's first `lobby` message. */
  readonly settings: LobbySettings | null;
  /** The lobby's revision (`LobbyState.rev`): changes whenever a seat's holder or deck, or the settings, change. */
  readonly rev: number;
  readonly seats: readonly RoomSeat[];
  /** The table this device follows as its game (`"main"` outside Epic Multiplayer). */
  readonly tableId: string | null;
  /** The table's persisted admission id (`TableInfo.gid`): stable across lobby changes, new for a rematch; null until known. */
  readonly gid: string | null;
  /** Ids of the seats I hold, in seat order. */
  readonly mySeats: readonly string[];
  /** The newest chat lines (at most `MAX_CHAT_KEPT`), oldest first. */
  readonly chat: readonly RoomChatLine[];
  /** How many lines arrived live since I joined (the backlog is history and does not count): notices read the rise. */
  readonly chatLive: number;
  /** The host's setup step, shown as a status line; null while the host is in the lobby or the game has started. */
  readonly hostActivity: RoomHostActivity | null;
  /** The host's villain phase cursor (the first table's), or null before the host has shown one. */
  readonly villainCursor: RoomVillainCursor | null;
  /** What the host picked for the table (ids), or null until it has. */
  readonly tablePlan: TablePlan | null;
  readonly refusal: RoomRefusal | null;
  /** Host only: what seat holders asked for and the host has not answered, oldest first. Empty for a guest. */
  readonly requests: readonly RoomRequest[];
  /** Guest only: my last request to the host and its answer; null before the first, or once dismissed. */
  readonly myRequest: RoomAsk | null;
  /** My own build equals the host's (both versions), so I may take a seat. True while the host's build is unknown. */
  readonly buildMatches: boolean;
  /** How my build differs from the host's; absent while `buildMatches`. */
  readonly buildGap?: BuildGap;
  /** The game has started: the host has streamed it (host side), or the room holds its log (guest: `watchRoomGame()` opens it). */
  readonly started: boolean;
  /** The game's outcome is in or the host ended it. */
  readonly gameOver: boolean;
  /** `standard` (one table) or `epic` (several, issue #882): `LobbySettings.mode`, `standard` until the lobby says. */
  readonly mode: LobbyMode;
  /** Epic rooms only; null in a standard room. */
  readonly epic: EpicState | null;
  /** Competitive rooms only (`mode` `competitive`); null in any other. */
  readonly competitive: CompetitiveState | null;
}

export const NO_ROOM: RoomState = {
  role: "none",
  connection: "idle",
  problem: null,
  roomId: null,
  code: null,
  link: null,
  me: null,
  participants: [],
  settings: null,
  rev: 0,
  seats: [],
  tableId: null,
  gid: null,
  mySeats: [],
  chat: [],
  chatLive: 0,
  hostActivity: null,
  villainCursor: null,
  tablePlan: null,
  refusal: null,
  requests: [],
  myRequest: null,
  buildMatches: true,
  started: false,
  gameOver: false,
  mode: "standard",
  epic: null,
  competitive: null,
};

/** At most this many chat lines are kept in `RoomState.chat`. */
export const MAX_CHAT_KEPT = 200;

/** An engine player id for a seat's `player` field: an id as given, or a seat index (0-based) as `p<index + 1>`. */
export const playerIdOfSeat = (player: string | number): string =>
  typeof player === "number" ? `p${player + 1}` : player;

/** The seat that plays an engine player, and who is behind it, for the whose-turn line. */
export interface SeatOfPlayer {
  readonly seat: RoomSeat;
  /** The holder's name (null for a seat nobody holds). */
  readonly holderName: string | null;
  /** This device acts for the seat: I hold it, or I am the host and have taken it over. */
  readonly mine: boolean;
  readonly away: boolean;
  readonly takenOver: boolean;
}

/** `null` when the room has no seat for `playerId` (a solo game, a watcher before Start, no room). */
export function seatOfPlayerIn(state: RoomState, playerId: string): SeatOfPlayer | null {
  const seat = state.seats.find((s) => s.player === playerId);
  if (!seat) return null;
  return {
    seat,
    holderName: seat.holderName,
    // A seat I hold but that is away (I left it) is not one I act for until I take it up again.
    // A guest's seat the host took over, or one on another build, is not theirs to act for.
    mine:
      (seat.mine && !seat.away && (state.role === "host" || (!seat.takenOver && !seat.mismatch))) ||
      (state.role === "host" && seat.takenOver),
    away: seat.away,
    takenOver: seat.takenOver,
  };
}
