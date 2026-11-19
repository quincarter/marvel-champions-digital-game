/**
 * "Let people watch my games" (issue #876, docs/live-game-rooms.md): the main thread's whole part. Nothing starts
 * while the `liveWatch` setting is off. Once it is on, one `live-room` worker is spawned (it owns the room's socket and
 * the publisher; the engine worker streams the game to it over a port, like Discord presence), and from then on main
 * only posts the setting to it and keeps the last status the worker posts back.
 *
 * Hook points for the UI: `liveStatus()` / `onLiveStatus(listener)` (the watch link, the watcher count, whether the
 * host's socket is up), and `syncLiveWatch(on)` for the Settings toggle.
 */
import { appSession } from "../session.js";
import { WorkerEngineHost } from "../engine/worker-host.js";
import { syncServiceUrl } from "../save-data/transfer-config.js";
import { WEB_VERSION_URL } from "../view/language-button.js";
import { NO_LIVE_STATUS, type LiveStatus } from "../live/live-publisher.js";
import type { LiveRoomIn, LiveRoomOut } from "../live/live-room-protocol.js";
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

export const liveStatus = (): LiveStatus => status;

/** Calls `listener` whenever the room's link, watcher count or connection changes. Returns the unsubscribe. */
export function onLiveStatus(listener: (status: LiveStatus) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** At start: spawns the worker only when the setting is already on. */
export function startLiveWatch(): void {
  if (appSession().settings.liveWatch) spawn();
}

/** The Settings toggle: spawns the worker on first on, then posts the setting to it. */
export function syncLiveWatch(on: boolean): void {
  if (on) spawn();
  worker?.postMessage({ kind: "enabled", on } satisfies LiveRoomIn);
}

function spawn(): void {
  if (worker) return;
  const host = appSession().host;
  // Only the worker host has a worker to stream from; a dev fixture host has none.
  if (!(host instanceof WorkerEngineHost)) return;
  const next = new Worker(new URL("../workers/live-room.worker.ts", import.meta.url), {
    type: "module",
    name: "mc-live-room",
  });
  worker = next;
  next.addEventListener("message", (event: MessageEvent<LiveRoomOut>) => {
    if (event.data.kind !== "status") return;
    status = event.data.status;
    for (const listener of listeners) listener(status);
  });
  const channel = new MessageChannel();
  host.attachLivePort(channel.port1);
  const init: LiveRoomIn = {
    kind: "init",
    enabled: appSession().settings.liveWatch,
    syncUrl: syncServiceUrl(),
    watchBase: watchBaseOf(detectPlatform() !== "web"),
    gamePort: channel.port2,
  };
  next.postMessage(init, [channel.port2]);
}
