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

import { EngineSessionCore, SetupError } from "./session-core.js";
import { IdbGameStorage } from "./idb-game-storage.js";
import type { HostRequest, HostResponse } from "./protocol.js";
import { playPlatformOfWorkerName } from "../platform/play-platform.js";
import { POOL_VERSION } from "../content/pool.js";
import { CLIENT_VERSION } from "../version.js";
import { buildCommit } from "../view/app-version.js";

// The main thread names this worker for its platform (`create-host.ts`): a worker cannot see the Tauri/Capacitor shell.
// The app and card-pool versions are compile-time facts of this bundle, so the worker stamps them itself (device sync
// uses them to keep an older build off a game a newer one wrote, #276).
const platform = playPlatformOfWorkerName(self.name);
const core = new EngineSessionCore({
  storage: new IdbGameStorage(indexedDB, {
    ...(platform ? { platform } : {}),
    appVersion: CLIENT_VERSION,
    contentVersion: POOL_VERSION,
    ...(buildCommit() ? { build: buildCommit() } : {}),
  }),
});

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

/** Tells the main thread once the writes queued so far have committed (device sync pushes only what is on disk). */
const announceSaved = (reason: "game" | "turn"): void => {
  void core.flushed().then(() => reply({ kind: "saved", id: 0, reason }));
};

let presencePort: MessagePort | null = null;
let lastPresence = "";
/** Off until the presence worker says the setting is on: while off nothing is read, sealed or sent. */
let presenceOn = false;

/** Posts the table's Discord summary straight to the presence worker, only when it differs from the last one posted. */
function publishPresence(): void {
  if (!presencePort || !presenceOn) return;
  try {
    const summary = core.presenceGame();
    if (!summary) return;
    const key = JSON.stringify(summary);
    if (key === lastPresence) return;
    lastPresence = key;
    presencePort.postMessage({ kind: "game", ...summary });
  } catch {
    // Presence is a nicety: it never fails a command.
  }
}

async function handle(request: HostRequest): Promise<void> {
  try {
    switch (request.kind) {
      case "presencePort": {
        presencePort = request.port;
        lastPresence = "";
        presenceOn = false;
        // The presence worker answers over this port with the setting; a summary follows once it is on.
        presencePort.addEventListener("message", (e: MessageEvent<{ kind: "enabled"; on: boolean }>) => {
          if (e.data.kind !== "enabled") return;
          presenceOn = e.data.on;
          lastPresence = "";
          publishPresence();
        });
        presencePort.start();
        return;
      }
      case "start": {
        const { cardPool, snapshot } = await core.start(request.config);
        reply({ kind: "started", id: request.id, cardPool, snapshot });
        announceSaved("game");
        publishPresence();
        return;
      }
      case "resume": {
        const { cardPool, snapshot } = await core.resume(request.gameId);
        reply({ kind: "started", id: request.id, cardPool, snapshot });
        publishPresence();
        return;
      }
      case "dispatch": {
        const result = core.dispatch(request.command);
        reply({ kind: "dispatched", id: request.id, result });
        if (result.ok) {
          announceSaved(result.snapshot.events.some((event) => event.type === "turnEnded") ? "turn" : "game");
          publishPresence();
        }
        return;
      }
      case "rewindTo": {
        reply({ kind: "rewound", id: request.id, snapshot: await core.rewindTo(request.commandCount) });
        announceSaved("game");
        publishPresence();
        return;
      }
      case "legalActions": {
        reply({ kind: "legalActions", id: request.id, actions: core.legalActions(request.playerId) });
        return;
      }
      case "judgePayment": {
        reply({ kind: "paymentJudged", id: request.id, judged: core.judgePayment(request.playerId, request.payment) });
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
      case "activeSaves": {
        reply({ kind: "activeSaves", id: request.id, saves: await core.activeSaves() });
        return;
      }
      case "retireSave": {
        await core.retireSave(request.gameId);
        reply({ kind: "retired", id: request.id });
        return;
      }
      case "listSaves": {
        reply({ kind: "listSaves", id: request.id, saves: await core.listSaves() });
        return;
      }
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    reply(
      cause instanceof SetupError
        ? {
            kind: "failed",
            id: request.id,
            message,
            code: cause.code,
            ...(cause.illegalDecks ? { illegalDecks: cause.illegalDecks } : {}),
          }
        : { kind: "failed", id: request.id, message },
    );
  }
}

worker.addEventListener("message", (event: MessageEvent<HostRequest>) => {
  void handle(event.data);
});
