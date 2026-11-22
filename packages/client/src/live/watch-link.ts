/**
 * Opening a live game's watch link (issue #876): `#watch=<roomId>`, read once at startup the way `#replay=` is
 * (`replay/replay-link.ts`) and cleared from the address so a reload does not rejoin. The link itself is made by the
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
  history.replaceState(history.state, "", `${location.pathname}${location.search}`);
  let id: string;
  try {
    id = decodeURIComponent(match[1] ?? "");
  } catch {
    return "invalid";
  }
  return ROOM_ID_PATTERN.test(id) ? id : "invalid";
}
