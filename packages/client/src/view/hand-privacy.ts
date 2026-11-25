/**
 * Whose hand a room game's board draws face up (issue #887). The engine keeps every hand (it is the authority); this
 * only decides what is drawn. In a room game a device sees the hands of the seats it acts for (a guest its own seat,
 * the host its own and any it has taken over) and every other hand face down, as card backs with a count. A host that
 * turned on "Host sees every hand" (`LobbySettings.hostSeesHands`) sees them all, and a watcher sees none face up unless
 * the room's game says so (`roomHandsHidden`: always, unless the host opened every hand). Two more ways open a hand
 * (teaching a game): the lobby's "Everyone sees every hand" (`LobbySettings.openHands`) opens all of them on every
 * seated device, and a seat that chose "Show my hand to the table" (`RoomSeat.showsHand`) opens its own. Single player and one person playing every seat (no room) see every hand, as before.
 * Not a security boundary: the other hands are still in the state this device holds (#924 hides them for real).
 */
import type { RoomState } from "../live/room-state.js";
import { inRoomGame } from "./whose-turn.js";

export interface HandPrivacy {
  /** The room this device is in (null: no room). */
  readonly room: RoomState | null;
  /** This board is a live watch of a room's game (`ReplayHost.live`). */
  readonly watching: boolean;
  /** `SessionConfig.roomHandsHidden`, as the live header carried it to a watcher. */
  readonly handsHidden: boolean;
}

/** True when `playerId`'s hand is drawn face up on this device. */
export function handVisibleTo(privacy: HandPrivacy, playerId: string): boolean {
  if (privacy.watching) return !privacy.handsHidden;
  const { room } = privacy;
  if (!room || !inRoomGame(room)) return true;
  if (room.role === "host" && room.settings?.hostSeesHands === true) return true;
  if (room.settings?.openHands === true) return true;
  const seat = room.seats.find((s) => s.player === playerId);
  if (seat?.showsHand === true) return true;
  // A hero with no seat is the host's to run (`heldElsewhere` in `seat-gate.ts`).
  if (!seat) return room.role === "host";
  // A guest sees the hand of a seat it holds, whatever has happened to it since (taken over, away, another build);
  // the host sees its own seats and the ones it took over.
  if (room.role === "host") return seat.mine || seat.takenOver;
  return seat.mine;
}

/** The lobby's "Host sees every hand" setting as the toggle shows it: off unless the host switched it on. */
export const hostSeesHandsOf = (room: Pick<RoomState, "settings">): boolean => room.settings?.hostSeesHands === true;

/** The lobby's "Everyone sees every hand" setting as the toggle shows it: off unless the host switched it on. */
export const openHandsOf = (room: Pick<RoomState, "settings">): boolean => room.settings?.openHands === true;

/** The "Show my hand" control for this device: the seats it flips and whether they show now. */
export interface ShowHandToggle {
  readonly seats: readonly string[];
  readonly on: boolean;
}

/**
 * What the in-game "Show my hand to the table" / "Hide my hand" control acts on, or null when there is nothing to
 * show (no room game, every hand is already open, or this device holds no seat). A guest flips the seats it holds; the
 * host also flips a seat it took over and one nobody holds, the ones the room lets it set (`seat-show-hand`). With
 * several seats the control flips them together: it reads "on" only when all of them show.
 */
export function showHandToggleOf(room: RoomState): ShowHandToggle | null {
  if (!inRoomGame(room) || openHandsOf(room)) return null;
  const mine = room.seats.filter((seat) => {
    if (seat.mine) return true;
    return room.role === "host" && (seat.takenOver || (seat.holder === null && seat.player !== null));
  });
  if (mine.length === 0) return null;
  return { seats: mine.map((seat) => seat.id), on: mine.every((seat) => seat.showsHand === true) };
}
