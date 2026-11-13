/**
 * The replay worker (issue #693): rebuilds a game being watched back, off the main thread. `replay/replay-host.ts`
 * starts it when a replay opens and terminates it when the replay closes. All the work is `replay/replay-core.ts`'s.
 */
import { IdbGameStorage } from "../engine/idb-game-storage.js";
import { POOL_VERSION } from "../content/pool.js";
import { CLIENT_VERSION } from "../version.js";
import { buildCommit } from "../view/app-version.js";
import { ReplayCore, ReplayOpenError } from "../replay/replay-core.js";
import type { ReplayRequest, ReplayResponse } from "../replay/replay-protocol.js";

/** The client compiles with the DOM lib, so this names the members of the worker global actually used. */
interface WorkerGlobal {
  postMessage(message: ReplayResponse, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<ReplayRequest>) => void) | null;
}

const worker = self as unknown as WorkerGlobal;
const commit = buildCommit();
// Read only: a replay never writes to the saved games, it loads one by id.
const core = new ReplayCore(
  { appVersion: CLIENT_VERSION, contentVersion: POOL_VERSION, ...(commit ? { build: commit } : {}) },
  typeof indexedDB !== "undefined" ? new IdbGameStorage(indexedDB) : null,
);

async function handle(request: ReplayRequest): Promise<void> {
  try {
    switch (request.kind) {
      case "open": {
        const { cardPool, info } = await core.open(request.source);
        worker.postMessage({ kind: "opened", id: request.id, cardPool, info });
        return;
      }
      case "snapshot":
        worker.postMessage({ kind: "snapshot", id: request.id, snapshot: core.snapshot(request.n, request.played) });
        return;
      case "export": {
        const { bytes, name } = await core.exportFile();
        worker.postMessage({ kind: "exported", id: request.id, bytes, name }, [bytes.buffer]);
        return;
      }
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    worker.postMessage({
      kind: "failed",
      id: request.id,
      message,
      ...(cause instanceof ReplayOpenError ? { code: cause.code } : {}),
    });
  }
}

worker.onmessage = (event: MessageEvent<ReplayRequest>) => void handle(event.data);
