/**
 * Builds the app's `EngineHost`.
 *
 * Kept apart from `main.ts` so the worker URL — the one place the app knows the
 * engine runs off-thread — is a single line, and so a debugging session can
 * swap in `LocalEngineHost` by changing one import.
 */

import type { EngineHost } from "./host.js";
import { WorkerEngineHost } from "./worker-host.js";

export function createEngineHost(): EngineHost {
  return new WorkerEngineHost(
    () => new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module", name: "mc-engine" }),
  );
}
