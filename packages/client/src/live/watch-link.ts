/**
 * Opening a live game's watch link (issue #876): `#watch=<roomId>`, or `#watch=<roomId>.<table>` for an Epic room's
 * other tables (#1021) (what the host shares, `watchLinkOf` in
 * `live-publisher.ts`) or `?watching=<roomId>`, read at startup the way `#replay=` is (`replay/replay-link.ts`). An incoming
 * `#watch=` is converted to `?watching=` on arrival, and the parameter stays in the address while the game is being
 * watched, so a reload (on purpose or by accident) opens the watch again instead of dropping to Title. It is removed when
 * the watch is left (`clearWatchAddress`: Title, and leaving the replay) or when the link names no room.
 */
import { FIRST_TABLE, ROOM_ID_PATTERN, TABLE_ID_PATTERN } from "@mc/sync-worker/room-protocol";
import type { ReceiveLinkHistory, ReceiveLinkLocation } from "../save-data/receive-link.js";
import { clearPlaceParam, paramOf, setPlaceParam } from "../platform/address-params.js";

/** A watch link's target split into its room and table (the first table when the link names none). */
export function parseWatchTarget(target: string): { readonly roomId: string; readonly table: string } | null {
  const dot = target.indexOf(".");
  const roomId = dot < 0 ? target : target.slice(0, dot);
  const table = dot < 0 ? FIRST_TABLE : target.slice(dot + 1);
  if (!ROOM_ID_PATTERN.test(roomId) || !TABLE_ID_PATTERN.test(table)) return null;
  return { roomId, table };
}

/**
 * What a watch link holds: its target (the room id, then `.<table>` when it names another table than the first),
 * `"invalid"` for a link that names no room, or null when there is none.
 */
export function takeWatchLink(
  location: ReceiveLinkLocation = globalThis.location,
  history: ReceiveLinkHistory = globalThis.history,
): string | "invalid" | null {
  const hash = /^#?watch=(.*)$/.exec(location.hash);
  let raw: string | null;
  if (hash) {
    // The shared link's hash form: dropped from the address and kept as the query form below.
    raw = hash[1] ?? "";
    history.replaceState(history.state, "", `${location.pathname}${location.search}`);
  } else raw = paramOf("watching", location);
  if (raw === null) return null;
  const bare = { hash: "", pathname: location.pathname, search: location.search };
  let id: string;
  try {
    id = hash ? decodeURIComponent(raw) : raw;
  } catch {
    clearPlaceParam("watching", bare, history);
    return "invalid";
  }
  if (!parseWatchTarget(id)) {
    clearPlaceParam("watching", bare, history);
    return "invalid";
  }
  if (hash) setPlaceParam("watching", id, bare, history);
  return id;
}

/** Takes `?watching=` out of the address (no new history entry); everything else stays. */
export function clearWatchAddress(
  location: ReceiveLinkLocation | undefined = globalThis.location,
  history: ReceiveLinkHistory | undefined = globalThis.history,
): void {
  clearPlaceParam("watching", location, history);
}
