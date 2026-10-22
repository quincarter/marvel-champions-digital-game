/**
 * Opening the app from a Send screen's QR code: the link ends in `#receive=ROOM.KEY`. This reads it once at startup
 * (the Title screen asks) and clears it, so a reload never reopens Receive and the code doesn't linger in the address
 * bar or history. A fragment never goes to a server, which is why the key part can ride in it.
 */
import { parseReceiveFragment, type TransferCode } from "@mc/sync-worker/protocol";

export interface ReceiveLinkLocation {
  readonly hash: string;
  readonly pathname: string;
  readonly search: string;
}

export interface ReceiveLinkHistory {
  readonly state: unknown;
  replaceState(data: unknown, unused: string, url?: string | URL | null): void;
}

/** The code in a `#receive=` hash, or `null`. Any `#receive=` hash, good or not, is removed from the address. */
export function takeReceiveLink(
  location: ReceiveLinkLocation = globalThis.location,
  history: ReceiveLinkHistory = globalThis.history,
): TransferCode | null {
  const hash = location.hash;
  if (!/^#?receive=/.test(hash)) return null;
  const code = parseReceiveFragment(hash);
  history.replaceState(history.state, "", `${location.pathname}${location.search}`);
  return code;
}
