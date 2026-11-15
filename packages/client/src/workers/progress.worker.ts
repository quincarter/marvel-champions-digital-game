/**
 * The progress worker (issue #722): reads the campaign runs and the decks from IndexedDB itself, and runs the progress
 * math (`progression/progress-compute.ts`) on them and on the saves the main thread passes along (they come from the
 * engine worker). It answers with the small result only, so the main thread never measures the history it came from.
 */
import { IdbCampaignStorage } from "../engine/idb-campaign-storage.js";
import { IdbDeckStorage } from "../engine/idb-deck-storage.js";
import { computeProgress, type ProgressCampaigns } from "../progression/progress-compute.js";
import type { ProgressReply, ProgressRequest } from "../progression/progress-client.js";

/** The client compiles with the DOM lib only, so this names the members of the worker global that are used. */
interface WorkerGlobal {
  postMessage(message: ProgressReply): void;
  addEventListener(type: "message", listener: (event: MessageEvent<ProgressRequest>) => void): void;
}
const worker = self as unknown as WorkerGlobal;

// Its imports (the card pool, the cards' scripts) take a while on a slow phone: the client waits for this before it
// times a refresh.
worker.postMessage({ id: 0, result: null, ready: true });

let campaigns: IdbCampaignStorage | null = null;
let decks: IdbDeckStorage | null = null;

worker.addEventListener("message", (event) => {
  const { id, inputs, saves } = event.data;
  void (async () => {
    try {
      campaigns ??= new IdbCampaignStorage();
      decks ??= new IdbDeckStorage();
      const [runs, savedDecks] = await Promise.all([campaigns.list().catch(() => []), decks.list().catch(() => [])]);
      const result = computeProgress(inputs, {
        saves,
        campaigns: runs as unknown as ProgressCampaigns,
        decksBuilt: savedDecks.some((deck) => deck.source.kind === "userBuilt"),
      });
      worker.postMessage({ id, result });
    } catch {
      worker.postMessage({ id, result: null });
    }
  })();
});
