/**
 * The live-room worker (issue #876, docs/live-game-rooms.md section 5): owns the room's WebSocket and the publisher.
 * The engine worker streams the game to it over a port; the main thread only posts events (`init`, `enabled`) and
 * reads the status the worker posts back. Nothing here touches rendering.
 */
import { LiveRoomController } from "../live/live-room-controller.js";
import type {
  LiveEnabledMessage,
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

worker.addEventListener("message", (event) => {
  const message = event.data;
  if (message.kind === "init") {
    const { gamePort, presencePort } = message;
    controller = new LiveRoomController({
      syncUrl: message.syncUrl,
      watchBase: message.watchBase,
      onStatus: (status) => {
        worker.postMessage({ kind: "status", status });
        presencePort?.postMessage({ kind: "live", status } satisfies LiveStatusMessage);
      },
      // Tells the engine worker whether to stream at all (nothing is read or sent while off).
      onEnabledChange: (on) => gamePort.postMessage({ kind: "enabled", on } satisfies LiveEnabledMessage),
    });
    gamePort.addEventListener("message", (e: MessageEvent<LiveGameMessage>) => controller?.onGameMessage(e.data));
    gamePort.start();
    controller.setEnabled(message.enabled);
  } else if (message.kind === "enabled") {
    controller?.setEnabled(message.on);
  }
});
