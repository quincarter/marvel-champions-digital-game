/**
 * The rooms this device hosted or joined lately (issue #880), for Play online's "Live now" panel: a short list in local
 * storage, newest first, forgotten once older than a room lives or once the room is known to be over. Only guest
 * rooms are kept: a host leaving closes its room, and there is no way to resume one as host. Only the code and what
 * the device did; no names, tokens or links.
 */
import { ROOM_IDLE_MS } from "@mc/sync-worker/room-protocol";
import type { RecentRoom } from "../view/online-model.js";

const KEY = "mc-recent-rooms";
export const RECENT_ROOMS_MAX = 6;

/** Problems that say the room is over: a remembered code for it is no use any more. */
const ROOM_OVER: ReadonlySet<string> = new Set([
  "not-found",
  "gone",
  "closed-ended",
  "closed-idle",
  "closed-disabled",
  "closed-host",
]);
export const roomIsOver = (problem: string | null): boolean => problem !== null && ROOM_OVER.has(problem);

export function recentRoomsFrom(raw: string | null, now: number): RecentRoom[] {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter(
        (r): r is RecentRoom =>
          typeof r === "object" &&
          r !== null &&
          typeof r.code === "string" &&
          r.role === "guest" &&
          typeof r.at === "number" &&
          now - r.at < ROOM_IDLE_MS,
      )
      .slice(0, RECENT_ROOMS_MAX);
  } catch {
    return [];
  }
}

export function withRecentRoom(list: readonly RecentRoom[], room: RecentRoom): RecentRoom[] {
  return [room, ...list.filter((r) => r.code !== room.code)].slice(0, RECENT_ROOMS_MAX);
}

export function recentRooms(now = Date.now()): RecentRoom[] {
  try {
    return recentRoomsFrom(globalThis.localStorage?.getItem(KEY) ?? null, now);
  } catch {
    return [];
  }
}

export function rememberRoom(code: string, role: "host" | "guest", now = Date.now()): void {
  if (role !== "guest") return;
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(withRecentRoom(recentRooms(now), { code, role, at: now })));
  } catch {
    // Storage full or blocked: the list is a convenience.
  }
}

/** Forgets a room (it closed, or no longer exists). */
export function forgetRoom(code: string, now = Date.now()): void {
  try {
    const kept = recentRooms(now).filter((r) => r.code !== code);
    globalThis.localStorage?.setItem(KEY, JSON.stringify(kept));
  } catch {
    // Storage blocked: the list is a convenience.
  }
}
