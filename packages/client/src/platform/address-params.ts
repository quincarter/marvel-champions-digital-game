/**
 * The query parameters that keep a place across a reload: `?room=<CODE>` (in a room), `?game=<saveId>` (a single-player
 * game in progress) and `?watch=<roomId>` (watching a live game). They are set with `replaceState`, so no history entry
 * is added, and the path, the hash and every other parameter (a dev `?screen=` jump, `?lang=`) are kept as they were.
 * At most one of the three is in the address at a time: setting one takes the others out. A query string is ignored by the
 * hosts' single-page rewrites (Cloudflare assets, Netlify, the Tauri and Capacitor asset servers all route by path), so
 * a reload still serves the app.
 */
import type { ReceiveLinkHistory, ReceiveLinkLocation } from "../save-data/receive-link.js";

export const PLACE_PARAMS = ["room", "game", "watch"] as const;
export type PlaceParam = (typeof PLACE_PARAMS)[number];

type Loc = ReceiveLinkLocation | undefined;
type Hist = ReceiveLinkHistory | undefined;

/** The raw (decoded) value of a parameter, or null. */
export function paramOf(name: string, location: Loc = globalThis.location): string | null {
  if (!location) return null;
  return new URLSearchParams(location.search).get(name);
}

/** Whether the address carries any of the three place parameters. */
export const placeParamIn = (location: Loc = globalThis.location): PlaceParam | null =>
  location ? (PLACE_PARAMS.find((name) => paramOf(name, location) !== null) ?? null) : null;

function replace(location: NonNullable<Loc>, history: NonNullable<Hist>, params: URLSearchParams): void {
  const search = params.toString();
  try {
    history.replaceState(history.state, "", `${location.pathname}${search ? `?${search}` : ""}${location.hash}`);
  } catch {
    // An address that cannot be rewritten (a sandboxed frame): the room or game itself still works.
  }
}

/** Sets `name=value` and takes the other place parameters out; does nothing when it is already so. */
export function setPlaceParam(
  name: PlaceParam,
  value: string,
  location: Loc = globalThis.location,
  hist: Hist = globalThis.history,
): void {
  if (!location || !hist) return;
  const params = new URLSearchParams(location.search);
  if (params.get(name) === value && PLACE_PARAMS.every((p) => p === name || !params.has(p))) return;
  for (const p of PLACE_PARAMS) params.delete(p);
  params.set(name, value);
  replace(location, hist, params);
}

/** Takes `name` out of the address (no new history entry); everything else stays. */
export function clearPlaceParam(
  name: PlaceParam,
  location: Loc = globalThis.location,
  hist: Hist = globalThis.history,
): void {
  if (!location || !hist) return;
  const params = new URLSearchParams(location.search);
  if (!params.has(name)) return;
  params.delete(name);
  replace(location, hist, params);
}
