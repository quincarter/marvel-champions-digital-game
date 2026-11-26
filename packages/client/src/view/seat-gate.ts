/**
 * Who may act on a room game's board (issue #881): the board is read-only while the decision belongs to a seat this
 * device does not act for, the same on the host as on a guest. The engine still refuses what the room's rules forbid;
 * this only keeps the screen from offering what is not this device's to do.
 */
import { seatOfPlayerIn, type RoomState } from "../live/room-state.js";
import type { PlayerId } from "@mc/engine";

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

/**
 * Whose eyes a room game's narration reads through (issue #1017): the hero on the screen, unless that hero sits behind
 * a seat this device does not act for, in which case the first hero this device does hold (or nobody). On every
 * device the store's perspective follows whoever must act, so without this a guest's villain phase screen called the
 * host's defend "Rhino attacks you · Declare your defender", and the host's screen did the same for a guest's.
 * Outside a room the perspective is returned as it is: nothing changes for single player.
 */
export function narrationViewer(
  room: RoomState | null,
  perspectiveId: PlayerId | null,
  seatGame: boolean,
): PlayerId | null {
  if (!room || perspectiveId === null || !heldElsewhere(room, perspectiveId, seatGame)) return perspectiveId;
  const own = room.seats.find((seat) => seat.player !== null && seatOfPlayerIn(room, seat.player)?.mine);
  return (own?.player as PlayerId | undefined) ?? null;
}
