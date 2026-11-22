/**
 * Live game rooms (`/room`, GitHub issue #876, docs/live-game-rooms.md): one Durable Object per room. Imported by the
 * client as `@mc/sync-worker/room-protocol`, so both sides share these shapes.
 *
 * A room is a gathering of **participants** around one or more **tables**. Each table is one game with its own
 * host-authoritative log: the device whose engine runs that table streams the log in, and the room fans it out. Built
 * now: one table, its host, and watchers. Shaped for what comes next (Quin, 2026-11-19): chat, then player seats that
 * propose commands to their table's host, then several tables in one room (Epic Multiplayer pods: one engine per group
 * and a pod coordinator, docs/epic-multiplayer-plan.md option B), whose shared state will travel as its own channel.
 *
 * Every message is an envelope `{ v, ch, kind, ... }` on a **channel**: `room` (membership, presence, lifecycle),
 * `game` (a table's log, every message names its `table`), `chat`. A side ignores a channel or kind it does not know,
 * and `hello`/`welcome` exchange capability lists, so a newer client and an older room (or the reverse) only lose the
 * features one of them lacks.
 *
 * The room never reads a game: headers, starting states, commands and outcomes are opaque JSON to it. It checks that
 * each batch continues its table's log and counts sizes. It keeps the log in frozen chunks of `ROOM_CHUNK_COMMANDS`
 * commands (one storage row per completed chunk, plus one for the header), with only the unfinished tail in memory; a
 * room that wakes from hibernation loads the chunks and asks the host for the tail with `resend { from }`.
 */

export const ROOM_PROTOCOL_VERSION = 1;

/** A room's id: 12 characters of the URL-safe base64 alphabet, 72 random bits (the same shape as a replay id). */
export const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{12}$/;
/** A secret handed out by the room (the host's, later a seat's): 32 characters, 192 random bits. Stored hashed. */
export const ROOM_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;
/** A table's id within its room. */
export const TABLE_ID_PATTERN = /^[a-z0-9-]{1,16}$/;
/** The one table a room has until multi-table play. */
export const FIRST_TABLE = "t1";

/** Defaults when the matching var is missing or not a positive number. */
export const DEFAULT_MAX_ROOM_PARTICIPANTS = 25;
/** Cap on one message, except a `start` or `log`, which may be up to `MAX_LOG_BYTES`. */
export const DEFAULT_MAX_ROOM_MESSAGE_BYTES = 64 * 1024;
/** Commands in one stored chunk of a table's log: a row is written when a chunk fills, never rewritten. */
export const ROOM_CHUNK_COMMANDS = 20;
/** The whole command log of one table, in JSON bytes; past it the room refuses `too-large` and ends the table. */
export const DEFAULT_MAX_ROOM_LOG_BYTES = 8 * 1024 * 1024;
/** The room sends a joining watcher the log in parts of about this many bytes (a `log`, then `commands`). */
export const LOG_PART_BYTES = 512 * 1024;
/** After this many refusals (not counting `out-of-order`) the room closes the socket. */
export const MAX_ROOM_REFUSALS = 5;
/** A starting state and header (or the first part of a log): under the WebSocket's own 1 MiB message cap. */
export const MAX_LOG_BYTES = 1024 * 1024 - 1024;
export const DEFAULT_ROOMS_PER_IP_PER_DAY = 20;
/**
 * A display name's length cap, after trimming. A lobby room (`POST /room { lobby: true }`) requires one in `hello`; any
 * other room ignores `hello.name`, so watching works as it did.
 */
export const MAX_NAME_LENGTH = 24;
/** What `hello` may carry as a name (watch rooms ignore it); a lobby room cuts it to `MAX_NAME_LENGTH` code points. */
export const MAX_HELLO_NAME_CHARS = 32;
/** A room code's directory entry outlives the room's own expiry by this much, so the two alarms never race. */
export const ROOM_CODE_MARGIN_MS = 60 * 60 * 1000;
/** Seat and lobby messages per participant: a burst of this many, then 2 a second. */
export const LOBBY_MESSAGE_BURST = 10;
/** The most characters one chat line may have (`say`). */
export const MAX_CHAT_LENGTH = 280;
/** Chat rate per participant: one line a second on average, with a burst of this many. */
export const CHAT_BURST = 5;
/** Lines the room keeps for a joiner (`backlog`): in memory and in one small storage row, so a woken room still has them. */
export const CHAT_BACKLOG_LINES = 50;
/** The host's setup steps a room relays as a status line (`host-activity`); `idle` clears it. */
export const HOST_ACTIVITY_STEPS = ["scenario", "table", "modular", "decks", "starting", "idle"] as const;
export type HostActivityStep = (typeof HOST_ACTIVITY_STEPS)[number];
/** Host activity messages: a burst of this many, then one a second. Memory only, never stored. */
export const HOST_ACTIVITY_BURST = 4;
/** Who paces a game's villain phase screen on a seated guest's device (`LobbySettings.villainPacing`). */
export const VILLAIN_PACINGS = ["host", "each"] as const;
export type VillainPacing = (typeof VILLAIN_PACINGS)[number];
/** Where the host is in its villain phase screen (`villain-cursor`): on the Start gate, showing beats, or closed. */
export const VILLAIN_CURSOR_STATES = ["gate", "playing", "closed"] as const;
export type VillainCursorState = (typeof VILLAIN_CURSOR_STATES)[number];
/** Villain cursor messages: a burst of this many, then `VILLAIN_CURSOR_PER_SECOND` a second. Memory only, never stored. */
export const VILLAIN_CURSOR_BURST = 8;
export const VILLAIN_CURSOR_PER_SECOND = 2;
/** The longest phase key and the highest beat count a cursor may carry. */
export const MAX_VILLAIN_KEY_CHARS = 24;
export const MAX_VILLAIN_CURSOR_AT = 5000;
/** The longest scenario name a host activity carries. */
export const MAX_ACTIVITY_SCENARIO_CHARS = 120;
/** A table has at most this many seats (Marvel Champions has 1-4 heroes); a standard lobby is one table. */
export const MAX_LOBBY_SEATS = 4;
/** An Epic lobby has at most this many tables (each up to `MAX_LOBBY_SEATS` seats). */
export const MAX_LOBBY_TABLES = 8;
/** Epic lobby pods, table names and difficulty (opaque JSON, in characters). */
export const MAX_LOBBY_PODS = 8;
export const MAX_TABLE_NAME_CHARS = 40;
export const MAX_TABLE_DIFFICULTY_CHARS = 256;
/** Most table host tokens a `hello` may present. */
export const MAX_HELLO_TABLE_TOKENS = 4;
/** The pod channel: one relayed `event` or `inbound` message, and the broadcast `state`, in JSON bytes. */
export const MAX_POD_EVENT_BYTES = 16 * 1024;
export const MAX_POD_STATE_BYTES = 32 * 1024;
/** Pod messages per participant: a burst of this many, then `POD_PER_SECOND` a second. */
export const POD_BURST = 30;
export const POD_PER_SECOND = 10;
/** Proposals per participant: a burst of this many, then `PROPOSAL_PER_SECOND` a second. */
export const PROPOSAL_BURST = 10;
export const PROPOSAL_PER_SECOND = 4;
/** The longest `note` on a `request`, in characters. */
export const MAX_REQUEST_NOTE_CHARS = 140;
/** The longest `player` string on a seat. */
export const MAX_SEAT_PLAYER_CHARS = 64;
/** A seat's id: chosen by the host's client (for example `s1`..`s4`). */
export const SEAT_ID_PATTERN = /^[A-Za-z0-9_-]{1,16}$/;
/** A room code: 6 characters of the transfer alphabet (`CODE_ALPHABET`, no look-alikes). */
export const LOBBY_CODE_LENGTH = 6;
/** The largest `tableRules` object, in JSON characters. */
export const MAX_TABLE_RULES_CHARS = 16 * 1024;
/**
 * One seat's deck list, in JSON bytes (`seat-deck`): a deck is about 40 lines of card id and count, so this is generous
 * and still keeps four seats' decks plus the rest of the lobby row well under a storage value's 128 KiB.
 */
export const MAX_SEAT_DECK_BYTES = 16 * 1024;
/** Most card lines (distinct card ids) in one deck list. */
export const MAX_DECK_LINES = 120;
/** `seat-deck` per participant: a burst of this many, then one every `DECK_REFILL_SECONDS` (each accepted change writes a row). */
export const DECK_MESSAGE_BURST = 4;
export const DECK_REFILL_SECONDS = 3;
/** The longest `reason` of a `deck-refused`, after the room cleans it. */
export const MAX_DECK_REFUSAL_CHARS = 400;
/** A lobby holds at most this many mods. */
export const MAX_LOBBY_MODS = 64;
/** Most seat tokens a `hello` may present. */
export const MAX_HELLO_SEAT_TOKENS = 8;
/** A room closes this long after any host last sent anything. */
export const ROOM_IDLE_MS = 12 * 60 * 60 * 1000;
/** After every table has ended, the room stays open this long. */
export const ROOM_END_GRACE_MS = 5 * 60 * 1000;

/** The "Live now" list (`GET /rooms/live`): at most this many entries, newest first. */
export const LIVE_LIST_MAX = 30;
/** The directory holds at most this many entries (the oldest go first); one storage row stays well under 128 KiB. */
export const LIVE_DIRECTORY_MAX = 100;
/** A listing not refreshed for this long is dropped on read and by the directory's alarm. */
export const LIVE_ENTRY_TTL_MS = 2 * 60 * 60 * 1000;
/** A room republishes its listing at most this often (changes inside the window are coalesced into one write). */
export const LIVE_PUBLISH_MIN_MS = 5_000;
/** Display strings in an entry are cut to this many characters. */
export const LIVE_TEXT_MAX = 60;

/** One listed room, as the directory holds it and `GET /rooms/live` returns it. Only names the room already shows. */
export interface LiveRoomEntry {
  /** The lobby code that opens the room. */
  readonly code: string;
  /** The host's online name. */
  readonly host: string;
  readonly mode: LobbyPlayMode;
  /** The scenario the host picked, when it has said. */
  readonly scenario?: string;
  readonly seatsTaken: number;
  readonly seatsTotal: number;
  readonly started: boolean;
  /** Epoch milliseconds of the room's last publish; the directory sets it. */
  readonly updatedAt: number;
}

/** `GET /rooms/live` answers this. */
export interface LiveRoomList {
  readonly rooms: readonly LiveRoomEntry[];
}

/** Checks one entry from the wire (the client's side); null when it is not one. */
export function parseLiveRoomEntry(v: unknown): LiveRoomEntry | null {
  if (typeof v !== "object" || v === null) return null;
  const r = v as Record<string, unknown>;
  const text = (x: unknown): x is string => typeof x === "string" && x.length <= LIVE_TEXT_MAX * 2;
  if (!text(r.code) || r.code.length !== LOBBY_CODE_LENGTH || !text(r.host) || r.host.trim() === "") return null;
  if (r.mode !== "strict" && r.mode !== "host") return null;
  if (r.scenario !== undefined && !text(r.scenario)) return null;
  const n = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 99;
  if (!n(r.seatsTaken) || !n(r.seatsTotal) || typeof r.started !== "boolean") return null;
  if (typeof r.updatedAt !== "number" || !Number.isFinite(r.updatedAt)) return null;
  return {
    code: r.code,
    host: r.host,
    mode: r.mode,
    ...(r.scenario ? { scenario: r.scenario } : {}),
    seatsTaken: r.seatsTaken,
    seatsTotal: r.seatsTotal,
    started: r.started,
    updatedAt: r.updatedAt,
  };
}

/**
 * Capabilities a side may list in `hello` / `welcome`. `watch` is every room's; a room created with `lobby: true`
 * also advertises `chat`, `seats`, `play` (seat holders propose commands to the host, docs/live-game-rooms.md
 * section 9) and `tables` (several tables in one room, the Epic mode, section 10).
 */
export type RoomCapability = "watch" | "chat" | "seats" | "play" | "tables";

/** `POST /room` answers 201 with this: the room, and the token that makes its holder the first table's host. */
export interface RoomCreated {
  readonly roomId: string;
  readonly hostToken: string;
  readonly table: string;
  /** Only for a room created with `{ lobby: true }`: the 6-character code that `GET /room/code/:code` resolves. */
  readonly code?: string;
}

/** The body of `POST /room`. Optional; a body that is not this (or is empty) creates a plain watch room. */
export interface RoomCreateRequest {
  readonly lobby?: boolean;
}

/** `GET /room/code/:code` answers 200 with this, or 404 `not-found` (an unknown, expired or closed code). */
export interface RoomCodeResolved {
  readonly roomId: string;
}

export type RoomErrorReason =
  | "disabled"
  | "origin"
  | "bad-request"
  | "rate-limited"
  | "turnstile"
  | "not-found"
  | "full"
  | "server";

export interface RoomError {
  readonly reason: RoomErrorReason;
  readonly error: string;
}

/** Opaque to the room: on the client, the replay file's header fields plus the starting state (`replay/live-*`). */
export type TableHeader = unknown;
/** One engine command, opaque to the room. */
export type TableCommand = unknown;
/** Replay checksums (every `CHECKSUM_EVERY` commands), keyed by command count. Opaque to the room. */
export type TableChecksums = Readonly<Record<string, string>>;

/**
 * How someone is in the room. `seat` (a player at a table who may propose) is reserved for multiplayer: a participant
 * who holds a lobby seat is still a `watcher` here; the seat's `holder` in the `lobby` message says who holds it.
 */
export type ParticipantRole = "host" | "seat" | "watcher";

/** The client build a participant runs. A seat requires it to equal the host's. */
export const DEVICE_PLATFORMS = ["web", "windows", "macos", "linux", "android", "ios"] as const;
export const DEVICE_FORMS = ["desktop", "tablet", "phone"] as const;

/** What a participant plays on, as two coarse values (no model, OS version or screen size). Shown in the roster. */
export interface RoomDevice {
  readonly platform: (typeof DEVICE_PLATFORMS)[number];
  readonly form: (typeof DEVICE_FORMS)[number];
}

/** A `device` from a `hello`, or undefined when it is missing or not exactly those two known values. */
export function cleanDevice(value: unknown): RoomDevice | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const { platform, form } = value as Record<string, unknown>;
  const p = DEVICE_PLATFORMS.find((x) => x === platform);
  const f = DEVICE_FORMS.find((x) => x === form);
  return p && f ? { platform: p, form: f } : undefined;
}

export interface RoomBuild {
  readonly appVersion: string;
  readonly contentVersion: string;
  /**
   * Fingerprint of the rules code (engine, cards, content) the client was built from. Guests replay the host's log, so
   * the same version strings on different rules code still desync. Absent from older clients: then only the versions
   * are compared.
   */
  readonly rules?: string;
}

export interface Participant {
  /** Stable for the connection's life; given by the room. A reconnect is a new id (seats follow the seat token). */
  readonly id: string;
  readonly role: ParticipantRole;
  /**
   * The table a host or seat belongs to; absent for a watcher. In an Epic room a host is a table host (or the
   * organizer, who hosts one table or none).
   */
  readonly table?: string;
  /**
   * Epic rooms only: this host is the room's organizer (the room token's holder), who owns the lobby and the pod
   * channel's coordinator. Absent in every other room, where the one host is the organizer.
   */
  readonly organizer?: true;
  /**
   * A watcher's chosen tables in a room with several (`hello.follow`, `follow`): the room sends it those tables' logs
   * only. Absent means every table.
   */
  readonly follow?: readonly string[];
  /** Trimmed, at most `MAX_NAME_LENGTH`; present for every participant of a lobby room, never in another room. */
  readonly name?: string;
  /** What the participant's `hello` said it runs, so a lobby can show a mismatch. */
  readonly build?: RoomBuild;
  /** From the participant's `hello`, in every room (watch rooms too); absent when it sent none or an unknown one. */
  readonly device?: RoomDevice;
}

/** `standard` is one table; `epic` is several tables in one room (Trickster Takeover Epic Multiplayer). */
export type LobbyMode = "standard" | "epic";

/** How the game is played: `strict` is the game as written, `host` lets the host allow Undo, Manual adjust and so on. */
export type LobbyPlayMode = "strict" | "host";

/**
 * Who may Undo in the room's game: `off` nobody, `host` the host alone (guests cannot ask), `ask` the host, and guests
 * may ask the host. Strict rules force `off`; Host control starts at `ask`. See `lobbyUndoFor`.
 */
export type LobbyUndo = "off" | "host" | "ask";

/** The undo policy a mode allows: Strict is always `off`, otherwise the chosen one (`ask` when none was or it is unreadable). */
export function lobbyUndoFor(playMode: LobbyPlayMode, undo: unknown): LobbyUndo {
  if (playMode === "strict") return "off";
  return undo === "off" || undo === "host" || undo === "ask" ? undo : "ask";
}

export interface LobbyMod {
  readonly id: string;
  readonly version: string;
}

/** The host's room settings, shown to everyone. `appVersion` and `contentVersion` are the host's build, set by the room. */
export interface LobbySettings {
  readonly playMode: LobbyPlayMode;
  /** Who may Undo (`LobbyUndo`); always `off` while `playMode` is `strict`. */
  readonly undo: LobbyUndo;
  /**
   * Cheats on or off (default off). On: the host's own Cheats (Undo past a turn, Manual adjust) work in the room's game
   * and the game counts for no one's stats or achievements. Fixed once the game starts.
   */
  readonly cheats: boolean;
  /** The game's `TableRules`, opaque to the room (at most `MAX_TABLE_RULES_CHARS` of JSON). */
  readonly tableRules: Readonly<Record<string, unknown>>;
  readonly mods: readonly LobbyMod[];
  /** May one participant hold more than one seat? */
  readonly multiSeat: boolean;
  /**
   * May the host take over or hand on a seat whose player left or is away, during a game? Default true. Off: the room
   * refuses `take-over` and a `seat-assign` of such a seat (`handover-off`), and a seat its holder leaves mid-game
   * stays theirs (`left`), to take again with their token.
   */
  readonly handover?: boolean;
  /** `epic`: several tables, each with its own host, joined by the pod channel (section 10). Absent means `standard`. */
  readonly mode?: LobbyMode;
  /**
   * Does the host's board show every seat's hand face up? Default false (#887): in a room game the host's board draws
   * other seats' hands face down, like a guest's, and watchers get the same hidden view. Only what is drawn: the engine
   * keeps every hand. Strict rules do not change it.
   */
  readonly hostSeesHands?: boolean;
  /**
   * Who paces the villain phase screen on a seated guest's device. `host` (default; absent reads as `host`): the guest's
   * screen follows the host's reveal (`villain-cursor`) and has no controls to move on by itself. `each`: every player
   * steps through at their own pace. Presentation only: the engine's villain phase has already resolved either way.
   */
  readonly villainPacing?: VillainPacing;
  readonly chat: boolean;
  /**
   * The host's opt-in to the public "Live now" list (`GET /rooms/live`). Absent reads as off; a room is never listed
   * unless its host turns this on. Listing shows the room's name, mode, scenario and seats; the code stays the way in.
   */
  readonly listed?: boolean;
  readonly contentVersion: string;
  readonly appVersion: string;
  /** The host's rules fingerprint (`RoomBuild.rules`), set by the room; absent when the host sent none. */
  readonly rules?: string;
}

/** What the host may change with `lobby-set`; `appVersion` and `contentVersion` are never taken from a client. */
export type LobbySettingsPatch = Partial<Omit<LobbySettings, "appVersion" | "contentVersion" | "rules">>;

/** One line of a deck list: a card id and how many copies. */
export interface RoomDeckLine {
  readonly cardId: string;
  readonly quantity: number;
}

/**
 * A player's own deck, as a plain list (Quin, 2026-11-20: each player brings their hero and deck). Built on the player's
 * device from a saved, imported or precon deck. The room stores it with the seat and never reads the cards; only the
 * host's engine judges it. `mods` names the custom packs the deck's cards come from (id and version), so the host can
 * tell a missing or different pack apart from an unknown card. At most `MAX_SEAT_DECK_BYTES` of JSON.
 */
export interface RoomDeck {
  /** The deck's name (at most 80 characters). */
  readonly name: string;
  /** The identity card id (the hero or alter-ego the deck belongs to). */
  readonly hero: string;
  /** The hero's display name, for the lobby (at most 80 characters). */
  readonly heroName: string;
  /** The chosen aspect(s), as their ids. */
  readonly aspects: readonly string[];
  /** The cards, without the identity card itself (a `Deck`'s own `cards`). */
  readonly cards: readonly RoomDeckLine[];
  /** The custom packs the deck's cards or hero come from; empty for a base-game deck. */
  readonly mods: readonly LobbyMod[];
  /**
   * Attribution only, never a rule input (like `CorePlayer.deckId`): the precon's starter deck id, or the player's own
   * deck id on their device, so stats and Past games can name the deck a room game was played with.
   */
  readonly deckId?: string;
}

/**
 * What the lobby shows everyone of a seat's deck: no card list. The full list goes only to the host (`seat-decks`), so
 * a guest cannot read another guest's deck.
 */
export interface RoomDeckSummary {
  readonly hero: string;
  readonly heroName: string;
  readonly aspects: readonly string[];
  readonly name: string;
  /** Total cards (the sum of the quantities). */
  readonly cards: number;
  readonly mods: readonly LobbyMod[];
  /** The host chose this deck for the seat (the holder may still replace it). */
  readonly preset?: true;
}

/** Why a deck was turned down at Start; the `reason` carries the words (from the host's engine) for that player. */
export const DECK_REFUSAL_CODES = [
  "no-deck",
  "illegal",
  "unknown-card",
  "mod-missing",
  "mod-version",
  "mod-not-allowed",
] as const;
export type DeckRefusalCode = (typeof DECK_REFUSAL_CODES)[number];

/** A seat as the host defines it. */
export interface LobbySeatSpec {
  readonly id: string;
  /** An optional label, opaque to the room (at most 80 characters). The host sets a count of open seats; the hero is the deck's. */
  readonly label?: string;
  /**
   * The engine player (an id, or a seat index) the host assigns to this seat when it starts the game. Opaque to the
   * room, which only stores and relays it; a seat without one has none yet.
   */
  readonly player?: string | number;
  /**
   * Epic rooms: the table the seat belongs to (required there, a known table id). Absent in a standard room, where
   * every seat is at `t1`.
   */
  readonly table?: string;
}

/** A pod: tables that share a pod's "your pod" abilities. A table names its pod by id. */
export interface LobbyPod {
  readonly id: string;
  readonly name: string;
}

/** A table as the organizer sets it in `lobby-set`. */
export interface LobbyTableSpec {
  readonly id: string;
  readonly name: string;
  /** The id of one of the lobby's pods. */
  readonly pod: string;
  /** The table's difficulty, opaque to the room (at most `MAX_TABLE_DIFFICULTY_CHARS` of JSON). */
  readonly difficulty?: unknown;
  /**
   * The participant who hosts the table (runs its engine): one of its seat holders, or the organizer; each participant
   * hosts at most one table. Absent keeps the table's host, `null` takes the host away. The new host is sent
   * `table-host-token`.
   */
  readonly host?: string | null;
}

/** A table in the lobby as everyone sees it. */
export interface LobbyTable {
  readonly id: string;
  readonly name: string;
  readonly pod: string;
  readonly difficulty?: unknown;
  /** The participant id of the table's host; it may have disconnected (the table's `hostConnected` says). */
  readonly host?: string;
}

export interface LobbySeat extends LobbySeatSpec {
  /** The participant holding the seat. A holder whose id is not in the roster has disconnected and may rejoin by token. */
  readonly holder?: string;
  /** The holder's name, kept while they are disconnected. */
  readonly holderName?: string;
  /**
   * The connected holder runs a build that is not the host's (a seat restored by token after an update, or the host
   * changed build). The seat stays held; its holder may not act for it until the builds match again.
   * Epic rooms: a `table` field on the seat says which table it is at (the room reads a missing one as `t1`).
   */
  readonly mismatch?: boolean;
  /**
   * The host acts for this seat (`take-over`) until it `give-back`s. While set, the holder's proposals for the seat are
   * refused, so two devices never act for one hero. Stored with the seat.
   */
  readonly takenOver?: boolean;
  /**
   * The holder left the seat during a game while `handover` is off: it stays reserved for them and nobody acts for it
   * until they take it again (their seat token, or asking for it).
   */
  readonly left?: boolean;
  /** Participants who asked for the seat and await the host's answer. Memory only: a woken room starts with none. */
  readonly requested?: readonly string[];
  /** The seat's deck, summarized: set once the holder (or the host's preset) has sent one. Never the card list. */
  readonly deck?: RoomDeckSummary;
}

/** The lobby: its code, the host's settings and the seats. Sent to everyone after each change, and to a joiner. */
export interface LobbyState {
  readonly code: string;
  /**
   * Rises on every stored change to the settings, a seat's holder or a seat's deck. The host's Start compares it before
   * and after its asynchronous checks, so a lobby that changed meanwhile is not started from stale decks.
   */
  readonly rev: number;
  readonly settings: LobbySettings;
  readonly seats: readonly LobbySeat[];
  /** Epic rooms only: the tables and the pods they belong to. */
  readonly tables?: readonly LobbyTable[];
  readonly pods?: readonly LobbyPod[];
}

/** One line of chat as the room relays it. */
export interface ChatLine {
  /** The sender's participant id. */
  readonly from: string;
  readonly name?: string;
  readonly text: string;
  /** Milliseconds since the epoch, by the room's clock. */
  readonly at: number;
}

/** Why a table's host turned a proposal down: its `base` is behind the log, not that seat's turn, not legal, or Strict. */
export type ProposalRefusal = "stale" | "not-your-turn" | "illegal" | "strict";
const PROPOSAL_REFUSALS: readonly string[] = ["stale", "not-your-turn", "illegal", "strict"];

/** What a seat may ask the host for. */
export type RequestKind = "undo" | "adjust";

/** A table as the room reports it. */
export interface TableInfo {
  readonly id: string;
  readonly hostConnected: boolean;
  readonly commands: number;
  readonly ended: boolean;
  /** The room holds this table's header: false means it needs the host's `start` or `log`. */
  readonly hasHeader: boolean;
  /** The admission id (`gid`) of the game whose header the table holds; absent when none was given. */
  readonly gid?: string;
  /**
   * The latest checksum the room holds at or below its command count (`null`: none), so a host that resumes can prove
   * its saved log is the room's before it appends; absent from an older room.
   */
  readonly checkpoint?: { readonly count: number; readonly sum: string } | null;
  /**
   * The room holds a replacement for this table's log (or header) that it has not stored yet: `gid` is the admission
   * that is durable, and `commands` and `checkpoint` claim nothing. A host whose game is that admission resends its log
   * (a repair, not a new admission); any other host sees a game that is not its own.
   */
  readonly dirty?: true;
}

// ---------------------------------------------------------------------------------------------------------------
// Client to room

export type ClientMessage =
  /**
   * First message on a socket. A `token` the room issued makes the sender the host. In a lobby room `name` (trimmed,
   * at most `MAX_NAME_LENGTH`) is required and `build` is what a seat is checked against; `seatTokens` are seat tokens
   * from earlier `seat-token` messages, which put the sender back in those seats.
   */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "hello";
      readonly token?: string;
      readonly name?: string;
      readonly build?: RoomBuild;
      /** Optional and never refused: an unknown value is ignored. */
      readonly device?: RoomDevice;
      readonly seatTokens?: readonly string[];
      /** Epic rooms: tokens from earlier `table-host-token` messages, which make the sender those tables' host again. */
      readonly tableTokens?: readonly string[];
      /** Tables to receive logs of: `all` (the default) or the given ids. */
      readonly follow?: "all" | readonly string[];
      readonly caps: readonly RoomCapability[];
    }
  /** Choose which tables' logs you receive (`all` or a list). The room then sends the logs of newly followed tables. */
  | { readonly v: 1; readonly ch: "room"; readonly kind: "follow"; readonly tables: "all" | readonly string[] }
  /** Host only, lobby rooms only: change settings and/or replace the seat list (holders of kept seat ids stay). */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "lobby-set";
      readonly settings?: LobbySettingsPatch;
      readonly seats?: readonly LobbySeatSpec[];
      /** Epic rooms (`settings.mode` `epic`): 2 to `MAX_LOBBY_TABLES` tables, each seat naming its table. */
      readonly tables?: readonly LobbyTableSpec[];
      readonly pods?: readonly LobbyPod[];
      /**
       * Compare and swap: the lobby revision (`LobbyState.rev`) this change was worked out against. A room whose lobby
       * has moved on refuses it with `lobby-changed` and stores nothing; absent, the change applies as before.
       */
      readonly ifRev?: number;
    }
  /** Host only: closes the room for everyone (`closed` with reason `host`, every socket closed, the code released). */
  | { readonly v: 1; readonly ch: "room"; readonly kind: "room-close" }
  /**
   * The host only: which setup step it is in, so the lobby can say so ("The host is picking a scenario"). Relayed as it
   * is, kept in memory, never stored, and never part of the lobby revision. `scenario` names the chosen scenario.
   */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "host-activity";
      readonly step: HostActivityStep;
      readonly scenario?: string;
    }
  /**
   * The table's host only: where its villain phase screen is, for the guests' screens to follow (`villainPacing`
   * `host`). Relayed to everyone else as it is, kept in memory (the newest), never stored, never part of the lobby
   * revision. `key` names the phase (its round), `at` is how many beats the host has shown.
   */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "villain-cursor";
      readonly table: string;
      readonly key: string;
      readonly at: number;
      readonly state: VillainCursorState;
    }
  /** Ask for a seat (the host's own request is granted at once); needs the host's build and fewer seats than allowed. */
  | { readonly v: 1; readonly ch: "room"; readonly kind: "seat-request"; readonly seat: string }
  /** Give up a seat you hold, or withdraw a request. */
  | { readonly v: 1; readonly ch: "room"; readonly kind: "seat-release"; readonly seat: string }
  /** Host only: give a seat to a connected participant. The participant gets a private `seat-token`. */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "seat-assign";
      readonly seat: string;
      readonly participant: string;
    }
  /** Host only: turn down a request, or take the seat from its holder. */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "seat-deny";
      readonly seat: string;
      readonly participant: string;
    }
  /**
   * The seat's holder sets the seat's deck (the full list); the host may send one for any seat as a preset, which stays
   * through a change of holder where a holder's own deck does not. At most `MAX_SEAT_DECK_BYTES`, rate limited
   * (`DECK_MESSAGE_BURST`, then one per `DECK_REFILL_SECONDS`). Everyone sees only a summary; the host can ask for the lists.
   */
  | { readonly v: 1; readonly ch: "room"; readonly kind: "seat-deck"; readonly seat: string; readonly deck: RoomDeck }
  /** Host only: asks for every seat's full deck list (answered to the host alone with `seat-decks`). */
  | { readonly v: 1; readonly ch: "room"; readonly kind: "seat-decks-request" }
  /** Host only: tells a seat's holder, and only them, why the host's engine refused their deck at Start. */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "deck-refused";
      readonly seat: string;
      readonly code: DeckRefusalCode;
      readonly reason: string;
    }
  /**
   * The host's game header for the table. A lobby room's host adds `lobbyRev`, the lobby revision (`LobbyState.rev`) it
   * built the game from: a room whose lobby has moved on refuses it with `lobby-changed` and stores nothing. Absent
   * (an older build, a plain watch room): accepted as before.
   */
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "start";
      readonly table: string;
      readonly header: TableHeader;
      readonly lobbyRev?: number;
      /**
       * The host's admission id for this game, stored with the table's header. A `start` (or `log`) whose `gid` is the
       * table's current one is a retry of an admitted game: answered `started` without rechecking `lobbyRev`.
       */
      readonly gid?: string;
    }
  /** The commands `from` .. `from + commands.length - 1`. A batch that does not continue the table's log is refused. */
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "commands";
      readonly table: string;
      readonly from: number;
      readonly commands: readonly TableCommand[];
      readonly checksums?: TableChecksums;
    }
  /** A single-player Undo or Back out cut the log to its first `to` commands (never at a table with seats). */
  | { readonly v: 1; readonly ch: "game"; readonly kind: "rewind"; readonly table: string; readonly to: number }
  /**
   * The table's log from its start, answering `resend { from: 0 }`. It may carry only the first commands: the rest
   * follows as ordinary `commands` batches, each under the message cap.
   */
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "log";
      readonly table: string;
      readonly header: TableHeader;
      readonly commands: readonly TableCommand[];
      readonly checksums?: TableChecksums;
      /** As on `start`: a host whose game the room has not yet confirmed (`started`) repeats its lobby revision. */
      readonly lobbyRev?: number;
      /** As on `start`. */
      readonly gid?: string;
    }
  | { readonly v: 1; readonly ch: "game"; readonly kind: "end"; readonly table: string; readonly outcome: unknown }
  /**
   * A seat holder's command for its table's host to judge. `base` is the log length the command was built on. The room
   * forwards it as `proposal`; it is never stored. Lobby rooms only; see `RefusalReason` for the soft refusals.
   */
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "propose";
      readonly table: string;
      readonly command: TableCommand;
      readonly base: number;
      /** The proposer's id for this proposal, echoed in every refusal of it (the room's own and the host's). */
      readonly pid?: number;
      /**
       * The state the command was built on, as the proposer's engine has it (`replayChecksum` after `base` commands):
       * the host dispatches only when its own state at `base` is that one, so a rewind and a new move that reach the
       * same count never pass for the old position. Opaque to the room, which relays it.
       */
      readonly stamp?: string;
    }
  /** Host only: turn a proposal down. The room sends it to participant `to` alone, as `proposal-refused` without `to`. */
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "proposal-refused";
      readonly table: string;
      readonly to: string;
      readonly reason: ProposalRefusal;
      readonly base: number;
      readonly pid?: number;
    }
  /**
   * Host only: the proposal `pid` built on `base` was applied to the log. The room sends it to participant `to` alone,
   * as `proposal-accepted` without `to`, ahead of the log's own echo of the command (the host says it first). It is
   * how a proposer knows its own proposal landed, rather than an identical command from someone else.
   */
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "proposal-accepted";
      readonly table: string;
      readonly to: string;
      readonly base: number;
      readonly pid?: number;
    }
  /**
   * A seat holder asks the host for an Undo or a Manual adjust (Host control rooms only; Strict refuses `strict`).
   * `what` names it, because `kind` is the message's own discriminator.
   */
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "request";
      readonly table: string;
      readonly what: RequestKind;
      readonly note?: string;
      /** The asker's id for this ask, echoed in the host's `request-answer` and in the room's refusal of it. */
      readonly rid?: number;
    }
  /** Host only: answer a `request`. The room sends it to participant `to` alone. */
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "request-answer";
      readonly table: string;
      readonly to: string;
      readonly accepted: boolean;
      readonly rid?: number;
    }
  /** Host only: act for an away seat (its holder is disconnected), until `give-back`. */
  | { readonly v: 1; readonly ch: "room"; readonly kind: "take-over"; readonly seat: string }
  /** Host only: hand a taken-over seat back to its holder. */
  | { readonly v: 1; readonly ch: "room"; readonly kind: "give-back"; readonly seat: string }
  /**
   * Pod channel, Epic rooms. A table host's outbound coordinator event; the room relays it to the organizer only.
   * `seq` is the table's own counter (events are idempotent by `(table, seq)` and re-sent after a reconnect). Opaque,
   * at most `MAX_POD_EVENT_BYTES`, rate limited, never stored.
   */
  | {
      readonly v: 1;
      readonly ch: "pod";
      readonly kind: "event";
      readonly table: string;
      readonly seq: number;
      readonly event: unknown;
    }
  /** Organizer only: the coordinator's answer for `table`; the room relays it to that table's host only. */
  | {
      readonly v: 1;
      readonly ch: "pod";
      readonly kind: "inbound";
      readonly table: string;
      readonly seq: number;
      readonly event: unknown;
    }
  /** Organizer only: the shared state for every device's pod strip; broadcast to everyone, the last one kept in memory. */
  | { readonly v: 1; readonly ch: "pod"; readonly kind: "state"; readonly state: unknown }
  /** Lobby rooms with chat on: at most `MAX_CHAT_LENGTH` characters; 1 a second per participant, burst `CHAT_BURST`. */
  | { readonly v: 1; readonly ch: "chat"; readonly kind: "say"; readonly text: string };

// ---------------------------------------------------------------------------------------------------------------
// Room to client

export type ServerMessage =
  /** Answers `hello`: who you are, what the room supports, who is here and its tables. */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "welcome";
      readonly you: Participant;
      readonly caps: readonly RoomCapability[];
      readonly participants: readonly Participant[];
      readonly tables: readonly TableInfo[];
    }
  /** Someone joined, left or changed; `watchers` is the count of watchers, the number the presence card shows. */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "roster";
      readonly participants: readonly Participant[];
      readonly watchers: number;
      /** Epic rooms only: watchers (not seat holders) following each table; a watcher following all counts in each. */
      readonly watching?: Readonly<Record<string, number>>;
    }
  | { readonly v: 1; readonly ch: "room"; readonly kind: "table"; readonly table: TableInfo }
  /** The room is closing. */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "closed";
      readonly reason: "ended" | "idle" | "disabled" | "host";
    }
  /** A message was refused; the socket stays open unless the room closes it (or the refusal is `name-required`). */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "refused";
      readonly reason: RefusalReason;
      readonly pid?: number;
      readonly rid?: number;
    }
  /** Lobby rooms: everyone, after each change (and the joiner, after `welcome`). */
  | ({ readonly v: 1; readonly ch: "room"; readonly kind: "lobby" } & LobbyState)
  /**
   * The host's current setup step, to everyone when it changes and to a joiner. `idle` means none (the host is in the
   * lobby, or the game started). Memory only; it does not touch the lobby revision.
   */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "host-activity";
      readonly step: HostActivityStep;
      readonly scenario?: string;
    }
  /**
   * The host's villain phase cursor, to every guest when it changes and to a joiner. `state: "none"` clears it (the
   * table's game was started over or rewound). Memory only; it does not touch the lobby revision.
   */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "villain-cursor";
      readonly table: string;
      readonly key: string;
      readonly at: number;
      readonly state: VillainCursorState | "none";
    }
  /** To the one participant given the seat, never broadcast: keep it and present it in `hello.seatTokens`. */
  | { readonly v: 1; readonly ch: "room"; readonly kind: "seat-token"; readonly seat: string; readonly token: string }
  /**
   * To the participant just made a table's host, privately, never broadcast (only its SHA-256 is stored): keep it and
   * present it in `hello.tableTokens` to host the table again after a reconnect. A host may stream its own table only.
   */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "table-host-token";
      readonly table: string;
      readonly token: string;
    }
  /** To the host alone, answering `seat-decks-request`: the full deck of every seat that has one. */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "seat-decks";
      readonly decks: readonly {
        readonly seat: string;
        readonly holder?: string;
        readonly preset: boolean;
        readonly deck: RoomDeck;
      }[];
    }
  /** To the holder of `seat` alone: the host's engine refused the seat's deck at Start, and why. */
  | {
      readonly v: 1;
      readonly ch: "room";
      readonly kind: "deck-refused";
      readonly seat: string;
      readonly code: DeckRefusalCode;
      readonly reason: string;
    }
  /** To a participant whose pending request for `seat` the host turned down: stop asking (the request is gone). */
  | { readonly v: 1; readonly ch: "room"; readonly kind: "seat-denied"; readonly seat: string }
  /**
   * To a table's host: the room holds `from` commands of the table (its stored chunks after a wake, or the point a
   * refused batch did not line up with). Answer with ordinary `commands` batches from there, or, when `from` is 0,
   * with a `log` (the header and the first commands) and then `commands` batches.
   */
  | { readonly v: 1; readonly ch: "game"; readonly kind: "resend"; readonly table: string; readonly from: number }
  /** To the host alone: its `start` was taken and the table now holds that game's header (the lobby revision is spent). */
  | { readonly v: 1; readonly ch: "game"; readonly kind: "started"; readonly table: string; readonly gid?: string }
  /**
   * To a watcher on join, and to everyone but the host when the host starts or replaces the table: the header and the
   * first commands (about `LOG_PART_BYTES`), followed by `commands` batches for the rest, then `end` when the table
   * ended. `outcome` is not used by the room now (`end` carries it).
   */
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "log";
      readonly table: string;
      readonly header: TableHeader;
      readonly commands: readonly TableCommand[];
      readonly checksums: TableChecksums;
      readonly outcome?: unknown;
      /**
       * The table's log epoch: it changes whenever the log under the table is cut back, replaced or started over. A
       * seat accepts a `proposal-accepted` only for the epoch of the log it holds. Absent from an older room.
       */
      readonly epoch?: number;
      /**
       * The table's full command count when the log goes out in parts: this `log` holds the first of them and `commands`
       * batches carry the rest up to `total`. A reader that must see the whole log (a seat, a watcher) waits for all of
       * it before acting on it. Absent from an older room (the `log` is then taken as it stands) and when one part holds all.
       */
      readonly total?: number;
    }
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "commands";
      readonly table: string;
      readonly from: number;
      readonly commands: readonly TableCommand[];
      readonly checksums?: TableChecksums;
    }
  /** `epoch`: the table's log epoch after the cut (see `log`); absent from an older room. */
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "rewind";
      readonly table: string;
      readonly to: number;
      readonly epoch?: number;
    }
  | { readonly v: 1; readonly ch: "game"; readonly kind: "end"; readonly table: string; readonly outcome: unknown }
  /**
   * To a table's host: a seat holder's `propose`. `from` is the proposer's participant id; `seats` are the seat ids it
   * holds that may act (not `mismatch`, not taken over), which the host checks against the engine's legal actions.
   */
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "proposal";
      readonly table: string;
      readonly from: string;
      readonly seats: readonly string[];
      readonly command: TableCommand;
      readonly base: number;
      readonly pid?: number;
      /** The proposer's `stamp`, relayed untouched (absent when it sent none). */
      readonly stamp?: string;
    }
  /** To the proposer alone: the host turned its proposal down. Keep following the log. */
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "proposal-refused";
      readonly table: string;
      readonly reason: ProposalRefusal;
      readonly base: number;
      readonly pid?: number;
    }
  /** To the proposer alone: the host applied its proposal (the log's echo of it follows). */
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "proposal-accepted";
      readonly table: string;
      readonly base: number;
      /** The log epoch the room was in when it relayed this (see `log`). */
      readonly epoch?: number;
      readonly pid?: number;
    }
  /** To a table's host: a seat holder's request (`note` cleaned and cut to `MAX_REQUEST_NOTE_CHARS`; empty when none). */
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "request";
      readonly table: string;
      readonly from: string;
      readonly what: RequestKind;
      readonly note: string;
      readonly rid?: number;
    }
  /** To the requester alone: the host's answer. An accepted undo or adjust arrives as the log's own rewind or command. */
  | {
      readonly v: 1;
      readonly ch: "game";
      readonly kind: "request-answer";
      readonly table: string;
      readonly accepted: boolean;
      readonly rid?: number;
    }
  /** To the organizer only: a table host's `pod:event`, relayed untouched. */
  | {
      readonly v: 1;
      readonly ch: "pod";
      readonly kind: "event";
      readonly table: string;
      readonly seq: number;
      readonly event: unknown;
    }
  /** To the table's host only: the organizer's `pod:inbound`, relayed untouched. */
  | {
      readonly v: 1;
      readonly ch: "pod";
      readonly kind: "inbound";
      readonly table: string;
      readonly seq: number;
      readonly event: unknown;
    }
  /** To everyone (and a joiner, the last one the room holds): the organizer's shared pod state. */
  | { readonly v: 1; readonly ch: "pod"; readonly kind: "state"; readonly state: unknown }
  | ({ readonly v: 1; readonly ch: "chat"; readonly kind: "said" } & ChatLine)
  /** To a joiner of a lobby room with chat on, after `welcome`: the last `CHAT_BACKLOG_LINES` lines, oldest first. */
  | { readonly v: 1; readonly ch: "chat"; readonly kind: "backlog"; readonly lines: readonly ChatLine[] };

/**
 * Why a message was refused. `build-mismatch`: the participant's `build` is not the host's (a seat needs both versions
 * equal). `name-required`: a lobby room's `hello` had no usable name (the socket is closed). `rate-limited`: chat over
 * its limit. `multi-seat`: a second seat while the host has `multiSeat` off. `not-seated`: a `propose` or `request` from
 * someone who holds no seat at that table that may act (a mismatched or taken-over seat does not count). `strict`: a
 * `request` in a Strict room. `not-away`: `take-over` of a seat whose holder is connected. Only `bad-message`, `too-large` and
 * `not-allowed` count toward the room closing a noisy socket. `other-table`: a seat at a second table (a participant plays
 * at one table). `bad-table-host`: a table host that is neither the organizer nor one of that table's seat holders, or a
 * participant already hosting another table. `no-such-table`: an unknown table in `follow` or `lobby-set`.
 */
export type RefusalReason =
  | "bad-message"
  | "too-large"
  | "not-allowed"
  | "out-of-order"
  | "full"
  | "rate-limited"
  | "name-required"
  | "build-mismatch"
  | "multi-seat"
  | "not-seated"
  | "strict"
  | "not-away"
  | "handover-off"
  | "seat-taken"
  | "other-table"
  | "bad-table-host"
  | "no-such-table"
  | "no-such-seat"
  | "no-such-participant"
  | "lobby-changed"
  /** A lobby change could not be saved: nothing changed, and trying again is safe. */
  | "not-saved";

const CHANNELS = new Set(["room", "game", "chat", "pod"]);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isSeatId = (v: unknown): v is string => typeof v === "string" && SEAT_ID_PATTERN.test(v);
const shortString = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;

function isBuild(v: unknown): v is RoomBuild {
  return (
    isRecord(v) &&
    shortString(v.appVersion, 64) &&
    shortString(v.contentVersion, 64) &&
    (v.rules === undefined || shortString(v.rules, 64))
  );
}

const isTableId = (v: unknown): v is string => typeof v === "string" && TABLE_ID_PATTERN.test(v);

function isFollow(v: unknown): boolean {
  return v === "all" || (Array.isArray(v) && v.length <= MAX_LOBBY_TABLES && v.every(isTableId));
}

function isTableSpecs(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.length <= MAX_LOBBY_TABLES &&
    v.every(
      (t) =>
        isRecord(t) &&
        isTableId(t.id) &&
        shortString(t.name, MAX_TABLE_NAME_CHARS * 4) &&
        isSeatId(t.pod) &&
        (JSON.stringify(t.difficulty ?? null)?.length ?? 0) <= MAX_TABLE_DIFFICULTY_CHARS &&
        (t.host === undefined || t.host === null || (typeof t.host === "string" && t.host.length <= 32)),
    )
  );
}

function isPods(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.length <= MAX_LOBBY_PODS &&
    v.every((p) => isRecord(p) && isSeatId(p.id) && shortString(p.name, MAX_TABLE_NAME_CHARS * 4))
  );
}

function isSeatSpecs(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.length <= MAX_LOBBY_SEATS * MAX_LOBBY_TABLES &&
    v.every(
      (s) =>
        isRecord(s) &&
        isSeatId(s.id) &&
        (s.label === undefined || shortString(s.label, 80)) &&
        (s.table === undefined || isTableId(s.table)) &&
        (s.player === undefined ||
          (typeof s.player === "string" && s.player.length > 0 && s.player.length <= MAX_SEAT_PLAYER_CHARS) ||
          (typeof s.player === "number" && Number.isInteger(s.player) && s.player >= 0 && s.player < 1000)),
    )
  );
}

function isMods(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.length <= MAX_LOBBY_MODS &&
    v.every((m) => isRecord(m) && shortString(m.id, 64) && shortString(m.version, 32))
  );
}

/** The shape and limits of a `RoomDeck`; the room cleans the text and checks the byte size after. */
function isDeck(v: unknown): v is RoomDeck {
  return (
    isRecord(v) &&
    shortString(v.name, 160) &&
    shortString(v.hero, 64) &&
    v.hero.length > 0 &&
    shortString(v.heroName, 160) &&
    Array.isArray(v.aspects) &&
    v.aspects.length <= 4 &&
    v.aspects.every((a) => shortString(a, 24)) &&
    Array.isArray(v.cards) &&
    v.cards.length <= MAX_DECK_LINES &&
    v.cards.every(
      (c) =>
        isRecord(c) &&
        shortString(c.cardId, 64) &&
        c.cardId.length > 0 &&
        typeof c.quantity === "number" &&
        Number.isInteger(c.quantity) &&
        c.quantity >= 1 &&
        c.quantity <= 99,
    ) &&
    isMods(v.mods) &&
    (v.deckId === undefined || (shortString(v.deckId, 64) && v.deckId.length > 0))
  );
}

function isSettingsPatch(v: unknown): boolean {
  if (!isRecord(v)) return false;
  if (v.playMode !== undefined && v.playMode !== "strict" && v.playMode !== "host") return false;
  if (v.undo !== undefined && v.undo !== "off" && v.undo !== "host" && v.undo !== "ask") return false;
  if (v.cheats !== undefined && typeof v.cheats !== "boolean") return false;
  if (v.multiSeat !== undefined && typeof v.multiSeat !== "boolean") return false;
  if (v.handover !== undefined && typeof v.handover !== "boolean") return false;
  if (v.mode !== undefined && v.mode !== "standard" && v.mode !== "epic") return false;
  if (v.hostSeesHands !== undefined && typeof v.hostSeesHands !== "boolean") return false;
  if (v.villainPacing !== undefined && !VILLAIN_PACINGS.some((x) => x === v.villainPacing)) return false;
  if (v.chat !== undefined && typeof v.chat !== "boolean") return false;
  if (v.listed !== undefined && typeof v.listed !== "boolean") return false;
  if (v.tableRules !== undefined) {
    if (!isRecord(v.tableRules) || (JSON.stringify(v.tableRules)?.length ?? 0) > MAX_TABLE_RULES_CHARS) return false;
  }
  if (v.mods !== undefined) {
    if (!Array.isArray(v.mods) || v.mods.length > MAX_LOBBY_MODS) return false;
    if (!v.mods.every((m) => isRecord(m) && shortString(m.id, 64) && shortString(m.version, 32))) return false;
  }
  return true;
}

/**
 * Parses a client message, or null when it is not one this room can read (bad JSON, another protocol version, an
 * unknown channel or kind, or a field of the wrong shape). Sizes, roles and log order are the room's to check.
 */
export function parseClientMessage(text: string): ClientMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const m = value as Record<string, unknown>;
  if (m.v !== ROOM_PROTOCOL_VERSION || typeof m.ch !== "string" || !CHANNELS.has(m.ch)) return null;
  const isGid = (g: unknown): boolean => g === undefined || (typeof g === "string" && g.length > 0 && g.length <= 64);
  const isCount = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;
  const isTable = (t: unknown): t is string => typeof t === "string" && TABLE_ID_PATTERN.test(t);
  const checksumsOk =
    m.checksums === undefined ||
    (typeof m.checksums === "object" && m.checksums !== null && !Array.isArray(m.checksums));
  const ok = (cond: boolean): ClientMessage | null => (cond ? (m as unknown as ClientMessage) : null);
  switch (`${m.ch}:${String(m.kind)}`) {
    case "room:hello":
      return ok(
        Array.isArray(m.caps) &&
          (m.token === undefined || typeof m.token === "string") &&
          (m.name === undefined || (typeof m.name === "string" && m.name.trim().length <= MAX_HELLO_NAME_CHARS)) &&
          (m.build === undefined || isBuild(m.build)) &&
          (m.seatTokens === undefined ||
            (Array.isArray(m.seatTokens) &&
              m.seatTokens.length <= MAX_HELLO_SEAT_TOKENS &&
              m.seatTokens.every((t) => typeof t === "string" && t.length <= 64))) &&
          (m.tableTokens === undefined ||
            (Array.isArray(m.tableTokens) &&
              m.tableTokens.length <= MAX_HELLO_TABLE_TOKENS &&
              m.tableTokens.every((t) => typeof t === "string" && t.length <= 64))) &&
          (m.follow === undefined || isFollow(m.follow)),
      );
    case "room:follow":
      return ok(isFollow(m.tables));
    case "room:lobby-set":
      return ok(
        (m.settings === undefined || isSettingsPatch(m.settings)) &&
          (m.seats === undefined || isSeatSpecs(m.seats)) &&
          (m.tables === undefined || isTableSpecs(m.tables)) &&
          (m.pods === undefined || isPods(m.pods)) &&
          (m.ifRev === undefined || isCount(m.ifRev)) &&
          (m.settings !== undefined || m.seats !== undefined || m.tables !== undefined || m.pods !== undefined),
      );
    case "room:seat-request":
    case "room:seat-release":
    case "room:take-over":
    case "room:give-back":
      return ok(isSeatId(m.seat));
    case "room:seat-assign":
    case "room:seat-deny":
      return ok(isSeatId(m.seat) && typeof m.participant === "string" && m.participant.length <= 32);
    case "room:seat-deck":
      return ok(isSeatId(m.seat) && isDeck(m.deck));
    case "room:host-activity":
      return ok(
        HOST_ACTIVITY_STEPS.some((x) => x === m.step) &&
          (m.scenario === undefined ||
            (typeof m.scenario === "string" && m.scenario.length <= MAX_ACTIVITY_SCENARIO_CHARS * 4)),
      );
    case "room:villain-cursor":
      return ok(
        isTable(m.table) &&
          typeof m.key === "string" &&
          m.key.length > 0 &&
          m.key.length <= MAX_VILLAIN_KEY_CHARS &&
          isCount(m.at) &&
          m.at <= MAX_VILLAIN_CURSOR_AT &&
          VILLAIN_CURSOR_STATES.some((x) => x === m.state),
      );
    case "room:seat-decks-request":
    case "room:room-close":
      return ok(true);
    case "room:deck-refused":
      return ok(
        isSeatId(m.seat) &&
          DECK_REFUSAL_CODES.some((c) => c === m.code) &&
          typeof m.reason === "string" &&
          m.reason.length <= MAX_DECK_REFUSAL_CHARS * 4,
      );
    case "game:start":
      return ok(isTable(m.table) && "header" in m && (m.lobbyRev === undefined || isCount(m.lobbyRev)) && isGid(m.gid));
    case "game:commands":
      return ok(isTable(m.table) && isCount(m.from) && Array.isArray(m.commands) && checksumsOk);
    case "game:rewind":
      return ok(isTable(m.table) && isCount(m.to));
    case "game:log":
      return ok(
        isTable(m.table) &&
          "header" in m &&
          Array.isArray(m.commands) &&
          checksumsOk &&
          (m.lobbyRev === undefined || isCount(m.lobbyRev)) &&
          isGid(m.gid),
      );
    case "game:end":
      return ok(isTable(m.table));
    case "game:propose":
      return ok(
        isTable(m.table) &&
          "command" in m &&
          isCount(m.base) &&
          (m.pid === undefined || isCount(m.pid)) &&
          (m.stamp === undefined || (typeof m.stamp === "string" && m.stamp.length <= MAX_SEAT_PLAYER_CHARS)),
      );
    case "game:proposal-refused":
      return ok(
        isTable(m.table) &&
          typeof m.to === "string" &&
          m.to.length <= 32 &&
          typeof m.reason === "string" &&
          PROPOSAL_REFUSALS.includes(m.reason) &&
          isCount(m.base) &&
          (m.pid === undefined || isCount(m.pid)),
      );
    case "game:proposal-accepted":
      return ok(
        isTable(m.table) &&
          typeof m.to === "string" &&
          m.to.length <= 32 &&
          isCount(m.base) &&
          (m.pid === undefined || isCount(m.pid)),
      );
    case "game:request":
      return ok(
        isTable(m.table) &&
          (m.what === "undo" || m.what === "adjust") &&
          (m.rid === undefined || isCount(m.rid)) &&
          (m.note === undefined || (typeof m.note === "string" && m.note.length <= MAX_REQUEST_NOTE_CHARS * 4)),
      );
    case "game:request-answer":
      return ok(
        isTable(m.table) &&
          typeof m.to === "string" &&
          m.to.length <= 32 &&
          typeof m.accepted === "boolean" &&
          (m.rid === undefined || isCount(m.rid)),
      );
    case "pod:event":
    case "pod:inbound":
      return ok(isTable(m.table) && isCount(m.seq) && "event" in m);
    case "pod:state":
      return ok("state" in m);
    case "chat:say":
      return ok(typeof m.text === "string" && m.text.length <= MAX_CHAT_LENGTH * 4);
    default:
      return null;
  }
}
