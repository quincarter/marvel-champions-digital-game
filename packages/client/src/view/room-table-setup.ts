/**
 * Setting the table up for a room (issue #880): the existing New game flow (scenario, Table setup) run in "room mode".
 * The host opens it from the lobby; it picks the scenario, difficulty, rules and modular sets but no heroes (Quin,
 * 2026-11-20: every player brings their own hero and deck), so Scenario select goes straight to Table setup with one
 * placeholder seat per lobby seat. Where Table setup would deal the game it hands its draft back here and returns to
 * the lobby. Start (in the lobby) deals the game from the kept draft and the decks the seats hold.
 *
 * Module state, as `view/builder-origin` style flows keep theirs: a screen reload leaves room mode, which is right (the
 * room does not survive one either).
 */
import type { CorePlayer } from "@mc/cards";
import type { Scenario } from "@mc/content";
import type { TableRules } from "@mc/engine";
import type { RoomGameBase } from "../live/room-start.js";
import type { LobbySeatSpec } from "../live/room-state.js";
import { toSessionConfig, type SetupDraft } from "./setup-draft.js";

interface RoomTable {
  /** True while the New game flow is the room host's: its last step returns to the lobby. */
  active: boolean;
  /** The draft the host finished the flow with. */
  draft: SetupDraft | null;
  /** How many seats the lobby has now: the table is set up for that many players. */
  seats: number;
}

/** A room seats one to four players. */
export const ROOM_SEATS_MIN = 1;
export const ROOM_SEATS_MAX = 4;
/** The seats a new lobby opens with. */
export const ROOM_SEATS_DEFAULT = 2;

export const clampSeatCount = (count: number): number =>
  Math.min(ROOM_SEATS_MAX, Math.max(ROOM_SEATS_MIN, Math.round(count)));

const table: RoomTable = { active: false, draft: null, seats: ROOM_SEATS_DEFAULT };

/** The host is setting up a table for the room: Title's Back and Table setup's last button go to the lobby. */
export const roomSetupActive = (): boolean => table.active;

export function enterRoomSetup(seatCount: number = table.seats): void {
  table.active = true;
  table.seats = clampSeatCount(seatCount);
}

/** The seats the table is being set up for. */
export const roomSeatCount = (): number => table.seats;

/** Leaves room mode, keeping the draft. */
export function leaveRoomSetup(): void {
  table.active = false;
}

/** The host finished the flow: the draft is kept for Start. */
export function keepRoomDraft(draft: SetupDraft): void {
  table.draft = draft;
  table.active = false;
  draftListener?.(draft);
}

/** Told when the kept draft changes (`null` when forgotten): `platform/room.ts` publishes the plan to the room. */
let draftListener: ((draft: SetupDraft | null) => void) | null = null;
export function setRoomDraftListener(listener: ((draft: SetupDraft | null) => void) | null): void {
  draftListener = listener;
}

export const roomDraft = (): SetupDraft | null => table.draft;

/** Forgets the table (the room was left or closed). */
export function clearRoomTable(): void {
  table.active = false;
  const had = table.draft !== null;
  table.draft = null;
  if (had) draftListener?.(null);
}

/** The seats of a lobby with `count` open seats (the room names them `s1`..`s4`; the hero is each deck's own). */
export const seatSpecsOf = (count: number): readonly LobbySeatSpec[] =>
  Array.from({ length: clampSeatCount(count) }, (_, index) => ({ id: `s${index + 1}` }));

/** The draft's seats while the table is set up: one placeholder per lobby seat, standing for a deck nobody has chosen yet. */
export const placeholderSeats = (count: number): readonly string[] =>
  Array.from({ length: clampSeatCount(count) }, (_, index) => `room-seat-${index + 1}`);

/** True for a seat id `placeholderSeats` made. */
export const isPlaceholderSeat = (id: string): boolean => id.startsWith("room-seat-");

/**
 * The game's settings with no players: the draft (its seats set to the lobby's seat count) built the way a normal game
 * is, with stand-in players only so `toSessionConfig` sees the right number of them (it reads nothing but the count to
 * size the modular picks); the real players come from the seats' decks at Start (`live/room-start.ts`).
 */
export function roomBaseConfig(
  draft: SetupDraft,
  seatCount: number,
  scenario: Scenario | undefined,
  tableRules: TableRules | undefined,
): RoomGameBase {
  const standIn = { identityCardId: "", deck: [], aspects: [] } as unknown as CorePlayer;
  const seated: SetupDraft = { ...draft, seats: placeholderSeats(seatCount) };
  const { players: _players, ...base } = toSessionConfig(
    seated,
    Array.from({ length: clampSeatCount(seatCount) }, () => standIn),
    scenario,
    tableRules,
  );
  return base;
}
