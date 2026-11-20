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

import type { Command, GameEvent, GameOutcome } from "@mc/engine";
import { EngineSessionCore, SetupError } from "./session-core.js";
import { IdbGameStorage } from "./idb-game-storage.js";
import { saveReason } from "./save-reason.js";
import type { HostRequest, HostResponse } from "./protocol.js";
import { playPlatformOfWorkerName } from "../platform/play-platform.js";
import { POOL_VERSION } from "../content/pool.js";
import { CLIENT_VERSION } from "../version.js";
import { buildCommit } from "../view/app-version.js";
import { isChecksumPosition } from "../replay/replay-file.js";
import { handleProposal, type ProposalHandlerDeps } from "./live-proposals.js";
import { handlePodInbound, type PodInboundDeps } from "./live-pod.js";
import type { LiveControlMessage, LiveGameMessage } from "../live/live-room-protocol.js";

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
const announceSaved = (reason: "game" | "round"): void => {
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

/** Set while a start, resume or rewind is awaiting: a seat's proposal then has no settled table to be judged against. */
let exclusive = 0;

let livePort: MessagePort | null = null;
/** Off until the live-room worker says it is up; only a `watchable` game is ever read or sent (`core.liveGameKey`). */
let liveOn = false;

const liveSend = (message: LiveGameMessage): void => {
  if (!livePort || !liveOn) return;
  try {
    livePort.postMessage(message);
  } catch {
    // Watching is a nicety: it never fails a command.
  }
};

/** The whole game to the live-room worker: a game began or resumed, or the setting just came on. */
function publishLiveGame(): void {
  if (!livePort || !liveOn) return;
  const live = core.liveGame();
  // A game that is not watchable says so, so the live worker leaves the room of the game that was on the table before.
  const pod = live ? core.livePodGame() : null;
  liveSend(live ? { kind: "game", ...live, ...(pod ? { pod } : {}) } : { kind: "none" });
}

/** The command just applied, with a checksum when one is due and the outcome when it ended the game. */
function publishLiveCommand(
  command: Command,
  count: number,
  outcome: GameOutcome | null,
  events: readonly GameEvent[] = [],
): void {
  if (!livePort || !liveOn) return;
  const gameKey = core.liveGameKey();
  if (!gameKey) return;
  const checksum = outcome || isChecksumPosition(count) ? core.liveChecksum() : undefined;
  // Epic Multiplayer: what the command told the pod rides with it, numbered by the engine.
  const pod = core.livePod(events);
  liveSend({
    kind: "command",
    gameKey,
    command,
    count,
    ...(checksum === undefined ? {} : { checksum }),
    ...(outcome ? { outcome } : {}),
    ...(pod ? { pod } : {}),
  });
}

/** A seat holder's proposal (issue #881): `live-proposals.ts`, wired to this worker's session and ports. */
const proposals: ProposalHandlerDeps = {
  core,
  busy: () => exclusive > 0,
  liveSend,
  remote: (command, snapshot) => reply({ kind: "remoteDispatched", id: 0, command, snapshot }),
  after: [
    (_command, snapshot) => announceSaved(saveReason(snapshot)),
    () => publishPresence(),
    (command, snapshot) => publishLiveCommand(command, snapshot.version, snapshot.state.outcome, snapshot.events),
  ],
};

/** A pod coordinator's inbound event (Epic Multiplayer): `live-pod.ts`, wired the same way. */
const podInbound: PodInboundDeps = {
  core,
  busy: proposals.busy,
  remote: proposals.remote,
  after: proposals.after,
  later: (run) => {
    setTimeout(run, 25);
  },
};

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
      case "livePort": {
        livePort = request.port;
        liveOn = false;
        // The live-room worker answers over this port with the setting; the game follows once it is on.
        livePort.addEventListener("message", (e: MessageEvent<LiveControlMessage>) => {
          if (e.data.kind === "proposal") {
            handleProposal(proposals, e.data);
            return;
          }
          if (e.data.kind === "pod-inbound") {
            handlePodInbound(podInbound, e.data);
            return;
          }
          // `enabled`: the live-room worker is up (the game follows if it is watchable); `resync`: its log has a gap.
          if (e.data.kind === "enabled") liveOn = e.data.on;
          publishLiveGame();
        });
        livePort.start();
        return;
      }
      case "start": {
        exclusive++;
        const { cardPool, snapshot } = await core.start(request.config).finally(() => exclusive--);
        reply({ kind: "started", id: request.id, cardPool, snapshot });
        announceSaved("game");
        publishPresence();
        publishLiveGame();
        return;
      }
      case "resume": {
        exclusive++;
        const { cardPool, snapshot } = await core.resume(request.gameId).finally(() => exclusive--);
        reply({ kind: "started", id: request.id, cardPool, snapshot });
        publishPresence();
        publishLiveGame();
        return;
      }
      case "dispatch": {
        const result = core.dispatch(request.command);
        reply({ kind: "dispatched", id: request.id, result });
        if (result.ok) {
          announceSaved(saveReason(result.snapshot));
          publishPresence();
          publishLiveCommand(
            request.command,
            result.snapshot.version,
            result.snapshot.state.outcome,
            result.snapshot.events,
          );
        }
        return;
      }
      case "rewindTo": {
        exclusive++;
        const rewound = await core.rewindTo(request.commandCount, request.options).finally(() => exclusive--);
        reply({ kind: "rewound", id: request.id, snapshot: rewound });
        announceSaved("game");
        publishPresence();
        {
          const gameKey = liveOn ? core.liveGameKey() : null;
          if (gameKey) liveSend({ kind: "rewind", gameKey, to: request.commandCount });
        }
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
        announceSaved("round");
        return;
      }
      case "listSaves": {
        reply({ kind: "listSaves", id: request.id, saves: await core.listSaves() });
        return;
      }
      case "backfillSummaries": {
        reply({ kind: "backfilled", id: request.id, written: await core.backfillSummaries(request.ids) });
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
