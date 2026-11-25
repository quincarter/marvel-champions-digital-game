/**
 * The seat worker (issue #881): a seated guest's engine session, off the main thread. `live/seat-host.ts` starts it when
 * the guest enters the room's game and terminates it when they leave. All the work is `live/seat-follower.ts`'s; this
 * is only the message plumbing around it.
 */
import { POOL_VERSION } from "../content/pool.js";
import { IdbGameStorage } from "../engine/idb-game-storage.js";
import { CLIENT_VERSION } from "../version.js";
import { buildCommit } from "../view/app-version.js";
import { SeatFollower, type SeatFeedPort } from "../live/seat-follower.js";
import type { SeatRequest, SeatResponse } from "../live/seat-protocol.js";

/** The client compiles with the DOM lib, so this names the members of the worker global actually used. */
interface WorkerGlobal {
  postMessage(message: SeatResponse): void;
  onmessage: ((event: MessageEvent<SeatRequest>) => void) | null;
}

const worker = self as unknown as WorkerGlobal;
let follower: SeatFollower | null = null;
let storage: IdbGameStorage | null = null;

/** The device's own saves, where a guest's finished copy of the room's game goes (#909); opened on first use. */
const ownStorage = (): IdbGameStorage =>
  (storage ??= new IdbGameStorage(indexedDB, {
    appVersion: CLIENT_VERSION,
    contentVersion: POOL_VERSION,
    ...(buildCommit() ? { build: buildCommit() } : {}),
  }));

const need = (): SeatFollower => {
  if (!follower) throw new Error("the seat has no game");
  return follower;
};

async function handle(request: SeatRequest): Promise<void> {
  try {
    switch (request.kind) {
      case "open": {
        follower?.dispose();
        const next = new SeatFollower({
          feed: request.feed as unknown as SeatFeedPort,
          packs: request.packs,
          ...(request.gameKey === undefined ? {} : { gameKey: request.gameKey }),
          finishDeps: { storage: ownStorage(), now: () => Date.now(), newId: () => crypto.randomUUID() },
        });
        follower = next;
        next.onEvent((event) => worker.postMessage({ kind: "event", event }));
        const { cardPool, snapshot } = await next.open();
        worker.postMessage({ kind: "opened", id: request.id, cardPool, snapshot });
        return;
      }
      case "propose":
        need().propose(request.command, request.base, request.pid);
        return;
      case "players":
        worker.postMessage({ kind: "players", id: request.id, snapshot: await need().setPlayers(request.players) });
        return;
      case "finish":
        worker.postMessage({ kind: "finished", id: request.id, written: await need().finish(request.record) });
        return;
      case "legalActions":
        worker.postMessage({
          kind: "legalActions",
          id: request.id,
          actions: await need().legalActions(request.playerId),
        });
        return;
      case "judgePayment":
        worker.postMessage({
          kind: "paymentJudged",
          id: request.id,
          judged: await need().judgePayment(request.playerId, request.payment),
        });
        return;
    }
  } catch (cause) {
    worker.postMessage({
      kind: "failed",
      id: request.id,
      message: cause instanceof Error ? cause.message : String(cause),
      ...(cause instanceof Error && "code" in cause ? { code: String((cause as { code: unknown }).code) } : {}),
    });
  }
}

worker.onmessage = (event: MessageEvent<SeatRequest>) => void handle(event.data);
