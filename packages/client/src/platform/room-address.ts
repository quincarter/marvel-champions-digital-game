/**
 * The room in the address (issue #880, reload rejoin): while this device is in a room, as host or guest, in its lobby or
 * its game, the address carries `#room=<CODE>`, so a refresh (on purpose or by accident) comes back to the same room
 * instead of to Title. It is written with `replaceState`, so it adds no history entry, and removed when the room is left
 * or over. The opposite of `#join=` and `#watch=`, which are read once and cleared: this one has to survive a reload.
 *
 * Only the code is in the address (it is already the thing a player shares); host and seat tokens stay in the worker's
 * IndexedDB (`live/live-room-store.ts`, `live/room-seat-store.ts`).
 */
import type { RoomState } from "../live/room-state.js";
import type { ReceiveLinkHistory, ReceiveLinkLocation } from "../save-data/receive-link.js";
import { parseJoinTarget } from "../live/room-socket.js";

const ROOM_HASH = /^#?room=(.*)$/;

/** The room code the address names, or null (no `#room=`, or one that is not a 6-character room code). Does not clear it. */
export function roomLinkOf(location: ReceiveLinkLocation | undefined = globalThis.location): string | null {
  const match = location ? ROOM_HASH.exec(location.hash) : null;
  if (!match) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(match[1] ?? "");
  } catch {
    return null;
  }
  const target = parseJoinTarget(decoded);
  return target && "code" in target ? target.code : null;
}

/** Whether the address holds a `#room=` hash at all (valid or not). */
const hasRoomHash = (location: ReceiveLinkLocation): boolean => ROOM_HASH.test(location.hash);

/** Puts `#room=<code>` in the address (no new history entry). */
export function writeRoomAddress(
  code: string,
  location: ReceiveLinkLocation | undefined = globalThis.location,
  history: ReceiveLinkHistory | undefined = globalThis.history,
): void {
  if (!location || !history) return;
  if (roomLinkOf(location) === code) return;
  try {
    history.replaceState(history.state, "", `${location.pathname}${location.search}#room=${code}`);
  } catch {
    // An address that cannot be rewritten (a sandboxed frame): the room itself still works.
  }
}

/** Takes `#room=` out of the address (no new history entry); leaves any other hash alone. */
export function clearRoomAddress(
  location: ReceiveLinkLocation | undefined = globalThis.location,
  history: ReceiveLinkHistory | undefined = globalThis.history,
): void {
  if (!location || !history || !hasRoomHash(location)) return;
  try {
    history.replaceState(history.state, "", `${location.pathname}${location.search}`);
  } catch {
    // See writeRoomAddress.
  }
}

/**
 * Keeps the address in step with the room's state: the code while this device is in a room (connecting, connected or
 * reconnecting, once the room has a code), nothing once it is left or over. A room that has no code yet leaves the
 * address as it is, so a reload that is still rejoining keeps its `#room=` until the room answers.
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
