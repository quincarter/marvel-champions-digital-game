/**
 * The live-room worker (issue #876, docs/live-game-rooms.md section 5): owns the room's WebSocket and the publisher.
 * The engine worker streams the game to it over a port; the main thread only posts events (`init`, `enabled`) and
 * reads the status the worker posts back. Nothing here touches rendering.
 */
import { IdbRoomStore } from "../live/live-room-store.js";
import { IdbSeatTokenStore } from "../live/room-seat-store.js";
import { LiveRoomController } from "../live/live-room-controller.js";
import { ChatPopoutRelay } from "../live/chat-popout-protocol.js";
import type {
  LiveControlMessage,
  LiveGameMessage,
  LiveRoomIn,
  LiveRoomOut,
  LiveStatusMessage,
} from "../live/live-room-protocol.js";

/** The client compiles with the DOM lib only, so this names the members of the worker global that are used. */
interface WorkerGlobal {
  postMessage(message: LiveRoomOut): void;
  addEventListener(type: "message", listener: (event: MessageEvent<LiveRoomIn>) => void): void;
}
const worker = self as unknown as WorkerGlobal;

let controller: LiveRoomController | null = null;

/** The chat's pop-out window talks to this worker over a BroadcastChannel; main only hears whether one is open. */
const popout = new ChatPopoutRelay({
  open: (name) =>
    new BroadcastChannel(name) as unknown as ReturnType<ConstructorParameters<typeof ChatPopoutRelay>[0]["open"]>,
  say: (text) => controller?.onRoomCommand({ kind: "room-say", text }),
  onOpenChange: (open) => worker.postMessage({ kind: "chat-popout", open }),
  now: () => Date.now(),
  every: (fn, ms) => {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  },
});

worker.addEventListener("message", (event) => {
  const message = event.data;
  if (message.kind === "init") {
    const { gamePort, presencePort, build, onlineName, device } = message;
    controller = new LiveRoomController({
      syncUrl: message.syncUrl,
      watchBase: message.watchBase,
      store: new IdbRoomStore(),
      onStatus: (status) => {
        worker.postMessage({ kind: "status", status });
        presencePort?.postMessage({ kind: "live", status } satisfies LiveStatusMessage);
      },
      // Tells the engine worker whether to stream at all (nothing is read or sent while off).
      onEnabledChange: (on) => gamePort?.postMessage({ kind: "enabled", on } satisfies LiveControlMessage),
      onStartRefused: () => worker.postMessage({ kind: "room-start-refused" }),
      onResync: () => gamePort?.postMessage({ kind: "resync" } satisfies LiveControlMessage),
      onProposal: (proposal) => gamePort?.postMessage(proposal satisfies LiveControlMessage),
      // Rooms and the lobby (issue #880): the seat tokens live in this worker's IndexedDB, never on the main thread.
      ...(build
        ? {
            room: {
              build,
              ...(device ? { device } : {}),
              onlineName: onlineName ?? "",
              seatStore: new IdbSeatTokenStore(),
              onState: (state) => {
                popout.onState(state);
                worker.postMessage({ kind: "room", state });
              },
              onDecks: (id, decks) => worker.postMessage({ kind: "room-decks", id, decks }),
              onSalvage: (game) => worker.postMessage({ kind: "room-salvage", ...game } satisfies LiveRoomOut),
            },
          }
        : {}),
    });
    gamePort?.addEventListener("message", (e: MessageEvent<LiveGameMessage>) => controller?.onGameMessage(e.data));
    gamePort?.start();
    controller.setEnabled(message.enabled);
  } else if (message.kind === "enabled") {
    controller?.setEnabled(message.on);
  } else if (message.kind === "chat-popout-recall") {
    popout.recall();
  } else {
    controller?.onRoomCommand(message);
  }
});
