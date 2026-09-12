/**
 * The engine worker: the client's local authority on the rules.
 *
 * It holds the only `GameSession`, applies every command, and answers
 * `legalActions`. Nothing about rendering reaches this file. In Phase 5 a
 * network host replaces it behind the same `EngineHost` interface.
 */

import { EngineSessionCore } from "./session-core.js";
import type { HostRequest, HostResponse } from "./protocol.js";

const core = new EngineSessionCore();

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

worker.addEventListener("message", (event: MessageEvent<HostRequest>) => {
  const request = event.data;
  try {
    switch (request.kind) {
      case "start": {
        const { cardPool, snapshot } = core.start(request.config);
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
    }
  } catch (cause) {
    reply({ kind: "failed", id: request.id, message: cause instanceof Error ? cause.message : String(cause) });
  }
});
