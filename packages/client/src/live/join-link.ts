/**
 * Opening a room's join link (issue #880): `#join=<code or room id>`, read once at startup the way `#watch=` is
 * (`watch-link.ts`) and cleared from the address. The link itself comes from `RoomState.link`. The desktop and phone
 * apps' `marvelchampions://join/<code>` link reads the same way through `joinTargetOf`.
 */
import type { ReceiveLinkHistory, ReceiveLinkLocation } from "../save-data/receive-link.js";
import { parseJoinTarget } from "./room-socket.js";

/** The text a join call takes (a code in capitals, or a room id), or null when `text` names neither. */
export function joinTargetOf(text: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(text);
  } catch {
    return null;
  }
  const target = parseJoinTarget(decoded);
  if (!target) return null;
  return "code" in target ? target.code : target.roomId;
}

/** What a `#join=` hash holds: a target for `joinRoom`, `"invalid"` for a link that names no room, or null when none. */
export function takeJoinLink(
  location: ReceiveLinkLocation = globalThis.location,
  history: ReceiveLinkHistory = globalThis.history,
): string | "invalid" | null {
  const match = /^#?join=(.*)$/.exec(location.hash);
  if (!match) return null;
  history.replaceState(history.state, "", `${location.pathname}${location.search}`);
  return joinTargetOf(match[1] ?? "") ?? "invalid";
}
