/**
 * What the board's controller, the store and the setup and villain-phase screens may ask of a room game (issue #881),
 * without importing the room: `platform/room.ts` registers where the room's state is read and `platform/seat-play.ts`
 * says whether this device plays from a seat. `null` (no room) leaves every control as a single-player game has it.
 */
import type { RoomState } from "../live/room-state.js";

export interface SeatContext {
  /** This device plays the room's game from a seat (a guest), not as the host. */
  readonly seatGame: boolean;
  readonly room: RoomState;
}

let roomOf: (() => RoomState) | null = null;
let seatUp = false;

/** `platform/room.ts`: where the room's current state is read. */
export function setSeatContextSource(source: (() => RoomState) | null): void {
  roomOf = source;
}

/** `platform/seat-play.ts`: a guest's seat game is up on this device (or no longer). */
export function setSeatGameUp(on: boolean): void {
  seatUp = on;
}

/** The room game this device is in, or null with no room (single player: nothing to ask). */
export function seatContext(): SeatContext | null {
  if (!roomOf) return null;
  const room = roomOf();
  return room.role === "none" ? null : { seatGame: seatUp, room };
}

/** A guest's seat game never rewinds or backs out: moves are the host's to take back (a request asks it). */
export const seatNoRewind = (): boolean => seatUp && roomOf !== null && roomOf().role !== "none";
