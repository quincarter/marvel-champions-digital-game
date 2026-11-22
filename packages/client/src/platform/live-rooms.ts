/**
 * The public "Live now" list for Play online (issue #880): rooms whose hosts opted in, from `GET /rooms/live`. It is a
 * convenience on top of the recent rooms, so every failure (offline, no service, a bad answer, a timeout) is an empty
 * list, never an error, and nothing here touches single player or a room. The fetch is async (the browser does the
 * network work off the main thread) and an answer is validated entry by entry, at most `LIVE_LIST_MAX` of them.
 */
import { LIVE_LIST_MAX, parseLiveRoomEntry, type LiveRoomEntry } from "@mc/sync-worker/room-protocol";
import { syncServiceUrl } from "../save-data/transfer-config.js";

/** The screen asks again this often while it is open. */
export const LIVE_ROOMS_REFRESH_MS = 20_000;
const FETCH_TIMEOUT_MS = 8_000;

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

/** The entries in an answer's body; anything that is not the expected shape gives none. */
export function liveRoomsFromBody(body: unknown): LiveRoomEntry[] {
  if (typeof body !== "object" || body === null) return [];
  const rooms = (body as { rooms?: unknown }).rooms;
  if (!Array.isArray(rooms)) return [];
  const out: LiveRoomEntry[] = [];
  for (const raw of rooms.slice(0, LIVE_LIST_MAX)) {
    const entry = parseLiveRoomEntry(raw);
    if (entry) out.push(entry);
  }
  return out;
}

export async function fetchLiveRooms(
  baseUrl: string | null = syncServiceUrl(),
  fetchFn: FetchLike = (url, init) => fetch(url, init),
): Promise<LiveRoomEntry[]> {
  if (!baseUrl) return [];
  if (typeof navigator !== "undefined" && navigator.onLine === false) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchFn(`${baseUrl}/rooms/live`, { signal: controller.signal });
    if (!response.ok) return [];
    return liveRoomsFromBody(await response.json());
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export interface LiveRoomsPoll {
  stop(): void;
  /** Fetches now unless one is under way or the page is hidden; call when the page becomes visible. */
  refresh(): void;
}

export interface LiveRoomsPollDeps {
  /** True while the page is hidden: the poll then waits instead of fetching. */
  readonly hidden?: () => boolean;
  readonly fetchRooms: () => Promise<LiveRoomEntry[]>;
  readonly setTimer: (run: () => void, ms: number) => unknown;
  readonly clearTimer: (handle: unknown) => void;
}

const realDeps: LiveRoomsPollDeps = {
  fetchRooms: () => fetchLiveRooms(),
  setTimer: (run, ms) => setTimeout(run, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  hidden: () => typeof document !== "undefined" && document.hidden,
};

/**
 * Fetches now and then every `LIVE_ROOMS_REFRESH_MS` after each answer (so a slow answer never piles requests up),
 * calling `onRooms` with the list each time. While the page is hidden a tick fetches nothing and waits; `refresh()`
 * (on visibilitychange) fetches at once. An answer that lands after `stop()` is dropped.
 */
export function pollLiveRooms(
  onRooms: (rooms: LiveRoomEntry[]) => void,
  deps: LiveRoomsPollDeps = realDeps,
  everyMs = LIVE_ROOMS_REFRESH_MS,
): LiveRoomsPoll {
  let stopped = false;
  let inFlight = false;
  let handle: unknown = null;
  const arm = (): void => {
    if (stopped) return;
    if (handle !== null) deps.clearTimer(handle);
    handle = deps.setTimer(() => void tick(), everyMs);
  };
  const tick = async (): Promise<void> => {
    handle = null;
    if (stopped || inFlight) return;
    if (deps.hidden?.()) return arm();
    inFlight = true;
    const rooms = await deps.fetchRooms();
    inFlight = false;
    if (stopped) return;
    onRooms(rooms);
    arm();
  };
  void tick();
  return {
    stop: () => {
      stopped = true;
      if (handle !== null) deps.clearTimer(handle);
    },
    refresh: () => {
      if (stopped || inFlight || deps.hidden?.()) return;
      if (handle !== null) deps.clearTimer(handle);
      void tick();
    },
  };
}
