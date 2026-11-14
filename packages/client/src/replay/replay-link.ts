/**
 * Sharing a replay by link (issue #693): the replay file goes up to the sync Worker (`POST /replay`, stored in R2) and
 * comes back as a short id; the link is the game's web address with `#replay=<id>`. Opening such a link (the Title
 * reads it once, like `#receive=`) fetches the file (`GET /replay/:id`) and plays it. A fragment never reaches a server.
 *
 * In the desktop and phone apps the page's own address is the webview's, which nobody else can open, so their links
 * point at the web version instead.
 */
import {
  REPLAY_ID_PATTERN,
  type ReplayCreated,
  type ReplayError,
  type ReplayErrorReason,
} from "@mc/sync-worker/replay-protocol";
import { syncServiceUrl } from "../save-data/transfer-config.js";
import type { ReceiveLinkHistory, ReceiveLinkLocation } from "../save-data/receive-link.js";
import { WEB_VERSION_URL } from "../view/language-button.js";

export const REPLAY_LINK_TIMEOUT_MS = 20_000;

/** Why a share or a fetch failed, for the screen to word. */
/** `full`: the service took as many shared replays as it takes in a day; tomorrow it takes more. */
export type ReplayLinkFailure = "unavailable" | "rate-limited" | "too-large" | "not-found" | "full";

export type ReplayLinkResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failure: ReplayLinkFailure };

export interface ReplayLinkDeps {
  readonly baseUrl: string | null;
  readonly fetch: typeof fetch;
}

const defaultDeps = (): ReplayLinkDeps => ({
  baseUrl: syncServiceUrl(),
  fetch: (...args) => globalThis.fetch(...args),
});

async function failureOf(response: Response): Promise<ReplayLinkFailure> {
  let reason: ReplayErrorReason | null = null;
  try {
    const body = (await response.json()) as Partial<ReplayError>;
    reason = typeof body.reason === "string" ? body.reason : null;
  } catch {
    reason = null;
  }
  if (response.status === 404 || reason === "not-found") return "not-found";
  if (response.status === 413 || reason === "too-large") return "too-large";
  if (response.status === 429 || reason === "rate-limited") return "rate-limited";
  if (reason === "full") return "full";
  return "unavailable";
}

async function call(deps: ReplayLinkDeps, path: string, init: RequestInit): Promise<Response | null> {
  if (!deps.baseUrl) return null;
  try {
    return await deps.fetch(`${deps.baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(REPLAY_LINK_TIMEOUT_MS) });
  } catch {
    return null;
  }
}

/** Uploads a replay file's bytes (`encodeReplay`'s text) and answers its id. */
export async function uploadReplay(
  bytes: Uint8Array,
  deps: ReplayLinkDeps = defaultDeps(),
): Promise<ReplayLinkResult<string>> {
  const response = await call(deps, "/replay", {
    method: "POST",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    body: new TextDecoder().decode(bytes),
  });
  if (!response) return { ok: false, failure: "unavailable" };
  if (!response.ok) return { ok: false, failure: await failureOf(response) };
  try {
    const { id } = (await response.json()) as ReplayCreated;
    return REPLAY_ID_PATTERN.test(id) ? { ok: true, value: id } : { ok: false, failure: "unavailable" };
  } catch {
    return { ok: false, failure: "unavailable" };
  }
}

/** Fetches a shared replay's bytes by id. */
export async function fetchReplay(
  id: string,
  deps: ReplayLinkDeps = defaultDeps(),
): Promise<ReplayLinkResult<Uint8Array>> {
  if (!REPLAY_ID_PATTERN.test(id)) return { ok: false, failure: "not-found" };
  const response = await call(deps, `/replay/${id}`, { method: "GET" });
  if (!response) return { ok: false, failure: "unavailable" };
  if (!response.ok) return { ok: false, failure: await failureOf(response) };
  try {
    return { ok: true, value: new Uint8Array(await response.arrayBuffer()) };
  } catch {
    // The connection dropped, or the timeout ran out, while the body was still coming.
    return { ok: false, failure: "unavailable" };
  }
}

/**
 * The link that opens replay `id`. `native` is true in the desktop and phone apps, whose own address no one else can
 * open: their links go to the web version.
 */
export function replayLinkOf(
  id: string,
  native: boolean,
  location: { readonly origin: string; readonly pathname: string } = globalThis.location,
): string {
  const base = native ? WEB_VERSION_URL : `${location.origin}${location.pathname}`;
  return `${base}#replay=${id}`;
}

/**
 * What a `#replay=` hash holds: the id, `"invalid"` for a link that names no replay, or null when there is no such hash.
 * Any `#replay=` hash is removed from the address, so a reload doesn't reopen it.
 */
export function takeReplayLink(
  location: ReceiveLinkLocation = globalThis.location,
  history: ReceiveLinkHistory = globalThis.history,
): string | "invalid" | null {
  const match = /^#?replay=(.*)$/.exec(location.hash);
  if (!match) return null;
  history.replaceState(history.state, "", `${location.pathname}${location.search}`);
  let id: string;
  try {
    id = decodeURIComponent(match[1] ?? "");
  } catch {
    return "invalid";
  }
  return REPLAY_ID_PATTERN.test(id) ? id : "invalid";
}
