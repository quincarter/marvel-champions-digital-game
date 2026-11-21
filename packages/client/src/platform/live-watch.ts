/**
 * "Let people watch this game" (issue #876, docs/live-game-rooms.md): the main thread's whole part. A game streams only
 * when its setup says so (`SessionConfig.watchable`, chosen in setup; the `liveWatch` setting only pre-ticks that
 * choice, `liveWatchDefault()`). The worker host tells us each game it starts or resumes; for a watchable one the single
 * `live-room` worker is spawned (it owns the room's socket and the publisher, and the engine worker streams the game to
 * it over a port, like Discord presence). From then on main only keeps the last status the worker posts back.
 *
 * Hook points for the UI: `liveStatus()` / `onLiveStatus(listener)` (the watch link, the watcher count, whether the
 * host's socket is up), and `liveWatchDefault()` for the setup toggle.
 */
import { appSession } from "../session.js";
import { WorkerEngineHost } from "../engine/worker-host.js";
import { syncServiceUrl } from "../save-data/transfer-config.js";
import { WEB_VERSION_URL } from "../view/language-button.js";
import { NO_LIVE_STATUS, type LiveStatus } from "../live/live-publisher.js";
import type { LiveRoomIn, LiveRoomOut } from "../live/live-room-protocol.js";
import { currentRoomDevice } from "./room-device.js";
import { NO_ROOM, type RoomState, type SeatDeckEntry } from "../live/room-state.js";
import { CLIENT_VERSION } from "../version.js";
import { POOL_VERSION } from "../content/pool.js";
import { takeLiveEnd } from "./live-presence-link.js";
import { detectPlatform } from "./platform.js";

let worker: Worker | null = null;
let status: LiveStatus = NO_LIVE_STATUS;
const listeners = new Set<(status: LiveStatus) => void>();

/** The link a watcher opens hangs off this: the page's own address, or the web version in the desktop and phone apps. */
export function watchBaseOf(
  native: boolean,
  location: { readonly origin: string; readonly pathname: string } = globalThis.location,
): string {
  return native ? WEB_VERSION_URL : `${location.origin}${location.pathname}`;
}

let roomListener: ((state: RoomState) => void) | null = null;
let decksListener: ((id: number, decks: readonly SeatDeckEntry[] | null) => void) | null = null;
/** Whether the room worker last reported a room (host or guest) this device is in. */
let inRoom = false;

/**
 * The Title is where a room's game hands back to (the host's Quit, a guest leaving the watch): the room is left there,
 * for host and guest alike, so a hosted room does not outlive its game. Nothing happens where no room was ever joined
 * (single player never posts to the worker).
 */
export function leaveRoomAtTitle(): void {
  if (!inRoom || !worker) return;
  inRoom = false;
  worker.postMessage({ kind: "room-leave" } satisfies LiveRoomIn);
  roomListener?.(NO_ROOM);
}

/** `platform/room.ts` hears the room worker's lobby states through this (one listener). */
export function setRoomStateListener(listener: (state: RoomState) => void): void {
  roomListener = listener;
}

/** `platform/room.ts` hears the answer to a deck request (the host's Start) through this (one listener). */
export function setRoomDecksListener(listener: (id: number, decks: readonly SeatDeckEntry[] | null) => void): void {
  decksListener = listener;
}

/** Posts a room command (`platform/room.ts`) to the worker, spawning it first. False where there is no worker host. */
export function postRoomCommand(message: LiveRoomIn, transfer: Transferable[] = []): boolean {
  if (!spawn()) return false;
  worker?.postMessage(message, transfer);
  return true;
}

export const liveStatus = (): LiveStatus => status;

/** Calls `listener` whenever the room's link, watcher count or connection changes. Returns the unsubscribe. */
export function onLiveStatus(listener: (status: LiveStatus) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** What the setup's "Let people watch this game" toggle starts as: the "Always allow people to watch my games" setting. */
export const liveWatchDefault = (): boolean => appSession().settings.liveWatch;

/** At start: watches for a watchable game. Nothing is spawned or connected until one begins. */
export function startLiveWatch(): void {
  const host = appSession().host;
  if (host instanceof WorkerEngineHost) {
    host.onGameBegun((config) => {
      if (config?.watchable) spawn();
    });
  }
}

/** The live-room worker, spawned on first need (a watchable game, or the player hosting or joining a room). */
function spawn(): boolean {
  if (worker) return true;
  const host = appSession().host;
  // Only the worker host has a worker to stream from; a dev fixture host has none.
  if (!(host instanceof WorkerEngineHost)) return false;
  const next = new Worker(new URL("../workers/live-room.worker.ts", import.meta.url), {
    type: "module",
    name: "mc-live-room",
  });
  worker = next;
  next.addEventListener("message", (event: MessageEvent<LiveRoomOut>) => {
    if (event.data.kind === "room-decks") {
      decksListener?.(event.data.id, event.data.decks);
      return;
    }
    if (event.data.kind === "room") {
      inRoom = event.data.state.role !== "none";
      roomListener?.(event.data.state);
      return;
    }
    status = event.data.status;
    for (const listener of listeners) listener(status);
  });
  const channel = new MessageChannel();
  host.attachLivePort(channel.port1);
  const presencePort = takeLiveEnd();
  const device = currentRoomDevice();
  const init: LiveRoomIn = {
    kind: "init",
    enabled: true,
    syncUrl: syncServiceUrl(),
    watchBase: watchBaseOf(detectPlatform() !== "web"),
    gamePort: channel.port2,
    build: { appVersion: CLIENT_VERSION, contentVersion: POOL_VERSION },
    onlineName: appSession().settings.onlineName,
    ...(device ? { device } : {}),
    ...(presencePort ? { presencePort } : {}),
  };
  next.postMessage(init, presencePort ? [channel.port2, presencePort] : [channel.port2]);
  return true;
}

/** Dev builds only: `__mcLiveStatus({ watchUrl, watchers, connected })` fakes the room's status for screenshots. */
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __mcLiveStatus: (next: LiveStatus) => void }).__mcLiveStatus = (next) => {
    status = next;
    for (const listener of listeners) listener(status);
  };
}
