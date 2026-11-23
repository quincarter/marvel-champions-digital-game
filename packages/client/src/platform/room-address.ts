/**
 * The room in the address (issue #880, reload rejoin): while this device is in a room, as host or guest, in its lobby or
 * its game, the address carries `?room=<CODE>`, so a refresh (on purpose or by accident) comes back to the same room
 * instead of to Title. It is set with `replaceState` (`address-params.ts`: no history entry, other parameters kept) and
 * removed when the room is left or over. The opposite of `#join=`, which is read once and converted.
 *
 * Only the code is in the address (it is already the thing a player shares); host and seat tokens stay in the worker's
 * IndexedDB (`live/live-room-store.ts`, `live/room-seat-store.ts`).
 */
import type { RoomState } from "../live/room-state.js";
import type { ReceiveLinkHistory, ReceiveLinkLocation } from "../save-data/receive-link.js";
import { parseJoinTarget } from "../live/room-socket.js";
import { clearPlaceParam, paramOf, setPlaceParam } from "./address-params.js";

/** The room code the address names, or null (no `?room=`, or one that is not a room code). Does not clear it. */
export function roomLinkOf(location: ReceiveLinkLocation | undefined = globalThis.location): string | null {
  const raw = paramOf("room", location);
  if (raw === null) return null;
  const target = parseJoinTarget(raw);
  return target && "code" in target ? target.code : null;
}

/** Puts `?room=<code>` in the address (no new history entry). */
export function writeRoomAddress(
  code: string,
  location: ReceiveLinkLocation | undefined = globalThis.location,
  history: ReceiveLinkHistory | undefined = globalThis.history,
): void {
  setPlaceParam("room", code, location, history);
}

/** Takes `?room=` out of the address (no new history entry); everything else stays. */
export function clearRoomAddress(
  location: ReceiveLinkLocation | undefined = globalThis.location,
  history: ReceiveLinkHistory | undefined = globalThis.history,
): void {
  clearPlaceParam("room", location, history);
}

/**
 * Keeps the address in step with the room's state: the code while this device is in a room (connecting, connected or
 * reconnecting, once the room has a code), nothing once it is left or over. A room that has no code yet leaves the
 * address as it is, so a reload that is still rejoining keeps its `?room=` until the room answers.
 */
export function syncRoomAddress(
  state: Pick<RoomState, "role" | "connection" | "code">,
  location: ReceiveLinkLocation | undefined = globalThis.location,
  history: ReceiveLinkHistory | undefined = globalThis.history,
): void {
  if (state.role === "none" || state.connection === "ended" || state.connection === "idle") {
    clearRoomAddress(location, history);
  } else if (state.code) {
    writeRoomAddress(state.code, location, history);
  }
}
