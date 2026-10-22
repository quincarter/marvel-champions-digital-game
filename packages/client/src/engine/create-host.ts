/**
 * Builds the app's `EngineHost`.
 *
 * Kept apart from `main.ts` so the worker URL — the one place the app knows the
 * engine runs off-thread — is a single line, and so a debugging session can
 * swap in `LocalEngineHost` by changing one import.
 */

import type { EngineHost } from "./host.js";
import { detectPlatform } from "../platform/platform.js";
import { currentPlayPlatform, engineWorkerName } from "../platform/play-platform.js";
import { WorkerEngineHost } from "./worker-host.js";

export function createEngineHost(): EngineHost {
  // The worker cannot see the Tauri/Capacitor shell, so it is told this device's platform through its name; the games
  // it writes are stamped `lastPlayedOn` with it (`engine.worker.ts`).
  const name = engineWorkerName(currentPlayPlatform(detectPlatform()));
  return new WorkerEngineHost(
    () => new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module", name }),
  );
}
