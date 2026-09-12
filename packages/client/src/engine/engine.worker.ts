/**
 * The engine worker: the client's local authority on the rules.
 *
 * It holds the only `GameSession`, applies every command, answers
 * `legalActions`, and keeps the game in IndexedDB so it survives a refresh.
 * Storage lives here rather than on the main thread because this is where the
 * log is: each command is written by the thing that applied it. Nothing about
 * rendering reaches this file. In Phase 5 a network host replaces it behind the
 * same `EngineHost` interface.
 */

import { EngineSessionCore } from "./session-core.js";
import { IdbGameStorage } from "./idb-game-storage.js";
import type { HostRequest, HostResponse } from "./protocol.js";

const core = new EngineSessionCore({ storage: new IdbGameStorage() });

/**
 * The client compiles with the DOM lib (it is one app, one tsconfig), and
 * `lib.webworker.d.ts` can't be added alongside it, so this names the two
 * members of the worker global we actually use.
 */
interface WorkerGlobal {
  postMessage(message: HostResponse): void;
  addEventListener(type: "message", listener: (event: MessageEvent<HostRequest>) => void): void;
}

const worker = self as unknown as WorkerGlobal;

const reply = (response: HostResponse): void => {
  worker.postMessage(response);
};

async function handle(request: HostRequest): Promise<void> {
  try {
    switch (request.kind) {
      case "start": {
        const { cardPool, snapshot } = await core.start(request.config);
        reply({ kind: "started", id: request.id, cardPool, snapshot });
        return;
      }
      case "resume": {
        const { cardPool, snapshot } = await core.resume(request.gameId);
        reply({ kind: "started", id: request.id, cardPool, snapshot });
        return;
      }
      case "dispatch": {
        reply({ kind: "dispatched", id: request.id, result: core.dispatch(request.command) });
        return;
      }
      case "legalActions": {
        reply({ kind: "legalActions", id: request.id, actions: core.legalActions(request.playerId) });
        return;
      }
      case "save": {
        const { initialState, commands } = core.save();
        const { cardPool: _pool, ...baseline } = initialState;
        reply({ kind: "save", id: request.id, save: { initialState: baseline, commands } });
        return;
      }
      case "latestSave": {
        reply({ kind: "latestSave", id: request.id, meta: await core.latestSave() });
        return;
      }
    }
  } catch (cause) {
    reply({ kind: "failed", id: request.id, message: cause instanceof Error ? cause.message : String(cause) });
  }
}

worker.addEventListener("message", (event: MessageEvent<HostRequest>) => {
  void handle(event.data);
});
