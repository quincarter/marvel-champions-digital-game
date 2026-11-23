/**
 * Opening a live game's watch link (issue #876): `#watch=<roomId>`, read at startup the way `#replay=` is
 * (`replay/replay-link.ts`). Unlike `#replay=` it stays in the address while the game is being watched, so a reload
 * (on purpose or by accident) opens the watch again instead of dropping to Title; it is removed when the watch is left
 * (`clearWatchAddress`: Title, and leaving the replay) or when the link names no room. The link itself is made by the
 * host (`watchLinkOf` in `live-publisher.ts`).
 */
import { ROOM_ID_PATTERN } from "@mc/sync-worker/room-protocol";
import type { ReceiveLinkHistory, ReceiveLinkLocation } from "../save-data/receive-link.js";

/** What a `#watch=` hash holds: the room id, `"invalid"` for a link that names no room, or null when there is none. */
export function takeWatchLink(
  location: ReceiveLinkLocation = globalThis.location,
  history: ReceiveLinkHistory = globalThis.history,
): string | "invalid" | null {
  const match = /^#?watch=(.*)$/.exec(location.hash);
  if (!match) return null;
  let id: string;
  try {
    id = decodeURIComponent(match[1] ?? "");
  } catch {
    clearWatchAddress(location, history);
    return "invalid";
  }
  if (ROOM_ID_PATTERN.test(id)) return id;
  clearWatchAddress(location, history);
  return "invalid";
}

/** Takes `#watch=` out of the address (no new history entry); any other hash stays. */
export function clearWatchAddress(
  location: ReceiveLinkLocation | undefined = globalThis.location,
  history: ReceiveLinkHistory | undefined = globalThis.history,
): void {
  if (!location || !history || !/^#?watch=/.test(location.hash)) return;
  try {
    history.replaceState(history.state, "", `${location.pathname}${location.search}`);
  } catch {
    // An address that cannot be rewritten: nothing to undo.
  }
}
