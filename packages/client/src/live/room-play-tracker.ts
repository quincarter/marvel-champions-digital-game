/**
 * Gathers how this device played a room game (`RoomPlayRecord`, #909, docs/multiplayer-achievements-plan.md) from the
 * `RoomState`s it already receives and from its own chat sends. A pure reducer: `platform/room.ts` keeps the tracker
 * and calls these on every published state; nothing here reads a socket, the engine or a clock.
 *
 * A game is tracked from the first state with `started` and not `gameOver`, and its record is made at the state with
 * `gameOver`. A game that stops being tracked any other way (the room returns to its lobby, this device leaves) is
 * dropped: it was not played to its end here.
 */
import type { PlayerId } from "@mc/engine";
import type { RoomPlayRecord, RoomTakeover } from "../engine/room-play.js";
import type { RoomSeat, RoomState } from "./room-state.js";

/** What was seen of a seat at the previous state: who held it and whether the game was waiting on it. */
interface SeatSeen {
  readonly holder: string | null;
  readonly gone: boolean;
}

export interface RoomPlayTracker {
  readonly role: "host" | "guest";
  readonly roomId: string;
  readonly gameKey: string;
  /** True once `gameKey` rests on the room's admission id; a provisional key may be promoted, a confirmed one never moves. */
  readonly confirmed: boolean;
  /** The room admission id once told (it never moves for a tracked game); null while the key is provisional. */
  readonly gid: string | null;
  /** The table the game runs at (`main` outside Epic Multiplayer); a change of it is another game. */
  readonly table: string;
  readonly mode: RoomPlayRecord["mode"];
  /** Players this device acts for now (holds, or as host has taken over), from the latest state. */
  readonly held: readonly string[];
  /** Players this device took over mid-game, in the order it did. */
  readonly taken: readonly string[];
  readonly friends: readonly string[];
  readonly tookOver: readonly RoomTakeover[];
  readonly chatSent: number;
  readonly strict: boolean;
  readonly cheats: boolean;
  readonly epic?: { readonly groupId: string; readonly tables: number };
  readonly competitive?: { readonly team: string; readonly side: string };
  readonly seen: Readonly<Record<string, SeatSeen>>;
}

export interface TrackStep {
  /** Null when no game is tracked now. */
  readonly tracker: RoomPlayTracker | null;
  /** The record so far, for a device that runs the game (it writes it to its save as the game goes, not only at the end). */
  readonly progress: RoomPlayRecord | null;
  /** The finished game's record, when this state ended one that this device took part in (never for a watcher). */
  readonly finished: RoomPlayRecord | null;
}

const NOTHING: TrackStep = { tracker: null, progress: null, finished: null };

/** Seats of the table this device plays at (all of them outside Epic Multiplayer). */
function seatsOfMyTable(state: RoomState): readonly RoomSeat[] {
  const table = state.epic?.tables.find((t) => t.id === state.epic?.myTable);
  if (!table) return state.seats;
  return state.seats.filter((s) => table.seats.includes(s.id));
}

const isGone = (seat: RoomSeat): boolean => seat.holder !== null && (seat.away || !seat.holderConnected);

function seenOf(seats: readonly RoomSeat[]): Record<string, SeatSeen> {
  const seen: Record<string, SeatSeen> = {};
  for (const seat of seats) {
    if (seat.player !== null) seen[seat.player] = { holder: seat.holder, gone: isGone(seat) };
  }
  return seen;
}

/**
 * Does this device run the game in its own session? The room host of a standard or competitive game, and in Epic
 * Multiplayer each table host (a guest of the room, but it runs its table's game, #909).
 */
const runsGame = (state: RoomState): boolean =>
  state.role === "host" || (state.role === "guest" && (state.epic?.hostsTable ?? null) !== null);

/** Does this device act for the seat's player (it holds it, or it runs the game and has taken it over)? */
const isMine = (state: RoomState, seat: RoomSeat): boolean =>
  seat.player !== null && (seat.mine || (runsGame(state) && seat.takenOver));

/**
 * The game's identity: room, table and the table's persisted admission id (`gid`), which a lobby change (a seat
 * handover) or a late join does not move and a rematch does. Until the room has told the gid, the lobby revision stands
 * in (`current`, a key already made, is kept so it does not drift with the revision).
 */
export function gameKeyOf(state: RoomState, current: string | null): string {
  if (state.gid !== null) return `${state.roomId}:${state.tableId ?? "main"}:${state.gid}`;
  return current ?? `${state.roomId}:${state.rev}`;
}

/**
 * Folds what an earlier run of this same game persisted (`base`, same `gameKey`) into a record made after a reload:
 * takeovers (and the seats they gave), friends, chat and the strict and cheats flags are kept, never dropped. Seats
 * held at the end stay what this run saw; a base of another game (a rematch) is ignored.
 */
export function mergeRoomPlay(base: RoomPlayRecord | null | undefined, record: RoomPlayRecord): RoomPlayRecord {
  if (!base || base.gameKey !== record.gameKey || base.roomId !== record.roomId) return record;
  const tookOver = [...record.tookOver];
  for (const t of base.tookOver) if (!tookOver.some((x) => x.player === t.player)) tookOver.push(t);
  const mySeats = [...new Set([...record.mySeats, ...base.tookOver.map((t) => t.player)])].sort();
  return {
    ...record,
    mySeats,
    friends: [...new Set([...base.friends, ...record.friends])],
    tookOver,
    chatSent: Math.max(base.chatSent, record.chatSent),
    strict: base.strict || record.strict,
    cheats: base.cheats || record.cheats,
  };
}

function begin(state: RoomState): RoomPlayTracker | null {
  if (state.role !== "host" && state.role !== "guest") return null;
  if (state.roomId === null) return null;
  const tracker: RoomPlayTracker = {
    role: runsGame(state) ? "host" : "guest",
    roomId: state.roomId,
    gameKey: gameKeyOf(state, null),
    confirmed: state.gid !== null,
    gid: state.gid,
    table: state.tableId ?? "main",
    mode: state.mode,
    held: [],
    taken: [],
    friends: [],
    tookOver: [],
    chatSent: 0,
    strict: false,
    cheats: false,
    seen: {},
  };
  // The seats held at the start are mine from the start, not takeovers.
  return refresh(tracker, state, true);
}

function refresh(tracker: RoomPlayTracker, state: RoomState, first = false): RoomPlayTracker {
  const seats = seatsOfMyTable(state);
  const meId = state.me?.id ?? null;
  const held: string[] = [];
  const taken = [...tracker.taken];
  const tookOver = [...tracker.tookOver];
  const friends = [...tracker.friends];

  for (const seat of seats) {
    const player = seat.player;
    if (player === null) continue;
    const mine = isMine(state, seat);
    if (mine) held.push(player);
    const before = tracker.seen[player];
    // A seat that was not mine (held by someone away, or vacant) and now is: this device took it over.
    if (mine && !first && before && !tracker.held.includes(player) && !taken.includes(player)) {
      const reason: RoomTakeover["reason"] | null = before.holder === null ? "left" : before.gone ? "away" : null;
      if (reason) {
        taken.push(player);
        tookOver.push({ player: player as PlayerId, reason });
      }
    }
    // A host that finds a seat already taken over when tracking begins took it from a holder who was away.
    if (mine && first && seat.takenOver && runsGame(state) && !taken.includes(player)) {
      taken.push(player);
      tookOver.push({ player: player as PlayerId, reason: "away" });
    }
    if (seat.holder !== null && seat.holder !== meId && seat.holderName && !friends.includes(seat.holderName)) {
      friends.push(seat.holderName);
    }
  }

  const epicTables = state.epic?.tables ?? [];
  const myTable = epicTables.find((t) => t.id === state.epic?.myTable);
  const pod = myTable ? state.epic?.pods.find((p) => p.id === myTable.pod) : undefined;
  const team = state.competitive?.myTeam ?? null;
  return {
    ...tracker,
    gameKey: gameKeyOf(state, tracker.gameKey),
    confirmed: tracker.confirmed || state.gid !== null,
    gid: tracker.gid ?? state.gid,
    held,
    taken,
    friends,
    tookOver,
    strict: tracker.strict || state.settings?.playMode === "strict",
    cheats: tracker.cheats || state.settings?.cheats === true,
    ...(myTable ? { epic: { groupId: myTable.id, tables: pod?.tables.length ?? epicTables.length } } : {}),
    ...(team !== null ? { competitive: { team, side: team } } : {}),
    seen: seenOf(seats),
  };
}

/** The record of a tracked game, or null for a guest who held no seat (a watcher). A host with no seat still has one. */
export function recordOf(tracker: RoomPlayTracker): RoomPlayRecord | null {
  const mySeats = [...new Set([...tracker.held, ...tracker.taken])].sort() as PlayerId[];
  if (mySeats.length === 0 && tracker.role !== "host") return null;
  return {
    role: tracker.role,
    roomId: tracker.roomId,
    gameKey: tracker.gameKey,
    ...(tracker.gid !== null ? { gid: tracker.gid } : {}),
    mode: tracker.mode,
    mySeats,
    friends: tracker.friends,
    tookOver: tracker.tookOver,
    chatSent: tracker.chatSent,
    strict: tracker.strict,
    cheats: tracker.cheats,
    ...(tracker.epic ? { epic: tracker.epic } : {}),
    ...(tracker.competitive ? { competitive: tracker.competitive } : {}),
  };
}

/** Feeds the tracker a room state (each one `platform/room.ts` publishes). */
export function trackRoomState(tracker: RoomPlayTracker | null, state: RoomState): TrackStep {
  if (!tracker) {
    const playing = state.started && !state.gameOver && (state.role === "host" || state.role === "guest");
    if (!playing) return NOTHING;
    const begun = begin(state);
    return { tracker: begun, progress: begun ? progressOf(begun) : null, finished: null };
  }
  // The room left, or went back to its lobby without an outcome: this game was not played to its end here.
  if (state.role === "none" || state.roomId !== tracker.roomId || !state.started) return NOTHING;
  // Another game in the same room (a missed end or lobby broadcast, a reconnect, another followed table): nothing of the
  // old one carries over. Only a provisional key may be promoted to the same game's confirmed one.
  const table = state.tableId ?? "main";
  const another =
    tracker.confirmed &&
    (table !== tracker.table || (state.gid !== null && gameKeyOf(state, null) !== tracker.gameKey));
  if (another) {
    if (state.gameOver) return NOTHING;
    const begun = begin(state);
    return { tracker: begun, progress: begun ? progressOf(begun) : null, finished: null };
  }
  const next = refresh(tracker, state);
  if (state.gameOver) return { tracker: null, progress: null, finished: recordOf(next) };
  return { tracker: next, progress: progressOf(next), finished: null };
}

/** The record so far, only for a device that runs the game: a guest's finished row is written once, at the end. */
function progressOf(tracker: RoomPlayTracker): RoomPlayRecord | null {
  return tracker.role === "host" ? recordOf(tracker) : null;
}

/** This device sent a chat line: counted while a game is being tracked. */
export function trackChatSent(tracker: RoomPlayTracker | null): RoomPlayTracker | null {
  return tracker ? { ...tracker, chatSent: tracker.chatSent + 1 } : tracker;
}
