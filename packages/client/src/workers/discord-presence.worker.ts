/**
 * The Discord presence worker: holds the scenes up, the table's summary (sent by the engine worker over a port) and
 * the debounce/dedupe (`view/discord-presence-tracker.ts`), and posts back only the activity the main thread should
 * `invoke`. The main thread's whole part is forwarding events here and making that one call.
 */
import { IdbCampaignStorage } from "../engine/idb-campaign-storage.js";
import { PresenceTracker } from "../view/discord-presence-tracker.js";
import type { PresenceGameMessage, PresenceIn, PresenceOut } from "../view/discord-presence-protocol.js";

/** The client compiles with the DOM lib only, so this names the members of the worker global that are used. */
interface WorkerGlobal {
  postMessage(message: PresenceOut): void;
  addEventListener(type: "message", listener: (event: MessageEvent<PresenceIn>) => void): void;
}
const worker = self as unknown as WorkerGlobal;

let storage: IdbCampaignStorage | null = null;
let gamePort: MessagePort | null = null;
/** Tells the engine worker whether to compute the table's summary at all (nothing is sealed or sent while off). */
const setEnabled = (on: boolean): void => {
  tracker.setEnabled(on);
  gamePort?.postMessage({ kind: "enabled", on });
};
const tracker = new PresenceTracker(
  {
    now: () => Date.now(),
    setTimer: (run, ms) => setTimeout(run, ms),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    emit: (activity) => worker.postMessage({ kind: "activity", activity }),
    runCampaignName: async (runId) => {
      storage ??= new IdbCampaignStorage();
      const record = await storage.load(runId);
      return record ? { campaignId: record.campaignId as string, name: record.name } : null;
    },
  },
  false,
);

worker.addEventListener("message", (event) => {
  const message = event.data;
  switch (message.kind) {
    case "init":
      tracker.setCampaignNames(message.campaignNames);
      if (message.gamePort) {
        gamePort = message.gamePort;
        message.gamePort.addEventListener("message", (e: MessageEvent<PresenceGameMessage>) => {
          if (e.data.kind === "game") tracker.setGame(e.data.game, e.data.gameKey);
        });
        message.gamePort.start();
      }
      setEnabled(message.enabled);
      return;
    case "sceneUp":
      tracker.sceneUp(message.key, { campaignId: message.campaignId, runId: message.runId });
      return;
    case "sceneDown":
      tracker.sceneDown(message.key);
      return;
    case "enabled":
      setEnabled(message.on);
      return;
    case "clear":
      tracker.clear();
      return;
    case "sendFailed":
      tracker.sendFailed();
      return;
  }
});
