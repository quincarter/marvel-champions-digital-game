/**
 * Discord Rich Presence, in the desktop app only (`src-tauri` exposes `discord_set_activity` and `discord_status`).
 *
 * All of the watching runs off the main thread, in `workers/discord-presence.worker.ts`: it keeps the scenes up, takes
 * the table's summary from the engine worker over a port (computed where the game state already is), words it
 * (`view/discord-presence.ts`), debounces and dedupes (`view/discord-presence-tracker.ts`). What stays here is one
 * `postMessage` per event (a scene up or down, the Settings toggle, the page leaving) and one `invoke` per activity the
 * worker hands back. No timer, no store subscription, no diffing. A browser and the phone apps never start it.
 */
import type Phaser from "phaser";
import { appSession } from "../session.js";
import { WorkerEngineHost } from "../engine/worker-host.js";
import { campaignNameTable } from "../view/discord-campaign-name.js";
import type { PresenceIn, PresenceOut } from "../view/discord-presence-protocol.js";
import { watchScenes } from "./discord-scene-watch.js";
import { detectPlatform } from "./platform.js";

interface DiscordStatus {
  readonly enabled: boolean;
  readonly connected: boolean;
}

type Invoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

let started = false;
let enabled = true;
let post: ((message: PresenceIn) => void) | null = null;

/** Starts the watcher once the game exists. A no-op everywhere but the desktop app. */
export function startDiscordPresence(game: Phaser.Game): void {
  if (started || detectPlatform() !== "tauri") return;
  started = true;
  enabled = appSession().settings.discordPresence;
  void begin(game);
}

/** The Settings toggle: a message to the worker, which clears at once on off and shows again on on. */
export function syncDiscordPresence(on: boolean): void {
  enabled = on;
  post?.({ kind: "enabled", on });
}

async function begin(game: Phaser.Game): Promise<void> {
  let invoke: Invoke;
  try {
    ({ invoke } = (await import("@tauri-apps/api/core")) as { invoke: Invoke });
    // A build without the Discord commands (or with the feature off) answers nothing: do no work at all.
    const status = await invoke<DiscordStatus>("discord_status");
    if (!status.enabled) return;
  } catch {
    return;
  }

  const worker = new Worker(new URL("../workers/discord-presence.worker.ts", import.meta.url), {
    type: "module",
    name: "mc-discord-presence",
  });
  const send = (message: PresenceIn, transfer: Transferable[] = []): void => worker.postMessage(message, transfer);
  post = send;

  let warned = false;
  worker.addEventListener("message", (event: MessageEvent<PresenceOut>) => {
    const { activity } = event.data;
    invoke("discord_set_activity", { activity }).catch((error: unknown) => {
      send({ kind: "sendFailed" });
      if (!warned) console.warn("discord presence:", error);
      warned = true;
    });
  });

  // The engine worker posts the table's summary straight to the presence worker over this channel.
  const host = appSession().host;
  let gamePort: MessagePort | undefined;
  if (host instanceof WorkerEngineHost) {
    const channel = new MessageChannel();
    host.attachPresencePort(channel.port1);
    gamePort = channel.port2;
  }
  send(
    { kind: "init", enabled, campaignNames: campaignNameTable(), ...(gamePort ? { gamePort } : {}) },
    gamePort ? [gamePort] : [],
  );

  // Scenes up already, then every start, wake, sleep and shutdown after.
  for (const scene of game.scene.getScenes(true)) {
    const data = (scene.sys.settings.data ?? {}) as { campaignId?: unknown; runId?: unknown };
    send({
      kind: "sceneUp",
      key: scene.scene.key,
      ...(typeof data.campaignId === "string" ? { campaignId: data.campaignId } : {}),
      ...(typeof data.runId === "string" ? { runId: data.runId } : {}),
    });
  }
  const firstSys = game.scene.getScenes(false)[0]?.sys;
  if (firstSys) {
    watchScenes({ prototype: Object.getPrototypeOf(firstSys) as object }, (signal) => {
      if (signal.up) {
        send({
          kind: "sceneUp",
          key: signal.key,
          ...(signal.campaignId ? { campaignId: signal.campaignId } : {}),
          ...(signal.runId ? { runId: signal.runId } : {}),
        });
      } else send({ kind: "sceneDown", key: signal.key });
    });
  }
  window.addEventListener("pagehide", () => send({ kind: "clear" }));
}
