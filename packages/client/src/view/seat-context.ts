/**
 * What the board's controller may ask of a room game (issue #881), without importing the room: the board registers a
 * provider while it is up, and the controller reads it. `null` (no provider, or no room) leaves every control as a
 * single-player game has it.
 */
import type { RoomState } from "../live/room-state.js";

export interface SeatContext {
  /** This device plays the room's game from a seat (a guest), not as the host. */
  readonly seatGame: boolean;
  readonly room: RoomState;
}

let provider: (() => SeatContext | null) | null = null;

export function setSeatContext(next: (() => SeatContext | null) | null): void {
  provider = next;
}

export const seatContext = (): SeatContext | null => provider?.() ?? null;
