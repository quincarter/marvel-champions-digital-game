/**
 * Who may act on a room game's board (issue #881): the board is read-only while the decision belongs to a seat this
 * device does not act for, the same on the host as on a guest. The engine still refuses what the room's rules forbid;
 * this only keeps the screen from offering what is not this device's to do.
 */
import { seatOfPlayerIn, type RoomState } from "../live/room-state.js";

/**
 * True when the hero who must act sits behind a seat this device does not act for (another person's, or one the host
 * has not taken over). `seatGame`: this device plays from a seat (a guest), where a hero with no seat at all is also
 * not its to act for. A game with no room, or no hero to act, is never held: nothing changes for single player.
 */
export function heldElsewhere(room: RoomState, playerId: string | null, seatGame: boolean): boolean {
  if (playerId === null) return false;
  const found = seatOfPlayerIn(room, playerId);
  if (found) return !found.mine;
  return seatGame && room.role === "guest";
}
