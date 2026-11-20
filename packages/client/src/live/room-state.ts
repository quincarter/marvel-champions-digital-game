/**
 * What the UI knows of a live room (issue #880, docs/live-game-rooms.md section 8), as plain data. The room worker owns
 * the connection and builds this; `platform/room.ts` hands it to the screens (`onRoomState`). Nothing here is a socket,
 * a token or a secret: seat tokens and the host token stay in the worker and its IndexedDB.
 *
 * The UI words everything itself: `connection`, `problem` and `refusal` are codes, never sentences.
 */
import type {
  ChatLine,
  DeckRefusalCode,
  LobbySeatSpec,
  LobbySettings,
  LobbySettingsPatch,
  RefusalReason,
  RoomBuild,
  RoomDeck,
  RoomDeckSummary,
  RoomDevice,
} from "@mc/sync-worker/room-protocol";

export type {
  ChatLine,
  DeckRefusalCode,
  LobbySeatSpec,
  LobbySettings,
  LobbySettingsPatch,
  RefusalReason,
  RoomBuild,
  RoomDeck,
  RoomDeckSummary,
  RoomDevice,
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
 *   switched off).
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
  | "closed-disabled";

export interface RoomParticipant {
  /** Stable while connected; a reconnect is a new id (seats follow the seat token). */
  readonly id: string;
  readonly name: string;
  readonly role: "host" | "watcher";
  readonly me: boolean;
  /** Runs the same build as the host (both versions); false means it cannot take a seat. Always true for the host. */
  readonly buildMatches: boolean;
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
  /** Who asked for it and awaits the host (what the host's approve and deny buttons act on). */
  readonly requests: readonly RoomSeatRequest[];
  readonly requestedByMe: boolean;
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
  readonly seats: readonly RoomSeat[];
  /** Ids of the seats I hold, in seat order. */
  readonly mySeats: readonly string[];
  /** The newest chat lines (at most `MAX_CHAT_KEPT`), oldest first. */
  readonly chat: readonly RoomChatLine[];
  readonly refusal: RoomRefusal | null;
  /** My own build equals the host's (both versions), so I may take a seat. True while the host's build is unknown. */
  readonly buildMatches: boolean;
  /** The game has started: the host has streamed it (host side), or the room holds its log (guest: `watchRoomGame()` opens it). */
  readonly started: boolean;
  /** The game's outcome is in or the host ended it. */
  readonly gameOver: boolean;
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
  seats: [],
  mySeats: [],
  chat: [],
  refusal: null,
  buildMatches: true,
  started: false,
  gameOver: false,
};

/** At most this many chat lines are kept in `RoomState.chat`. */
export const MAX_CHAT_KEPT = 200;
