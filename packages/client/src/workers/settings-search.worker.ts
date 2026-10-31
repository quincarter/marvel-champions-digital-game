/**
 * Settings' search worker (`view/settings-search-client.ts` owns it): builds the index of every page below Settings,
 * ranks each query and marks what matched, off the main thread. All the logic is `view/settings-search.ts`'s, which
 * the tests call directly.
 */
import {
  SettingsSearchHost,
  type SettingsSearchRequest,
  type SettingsSearchResponse,
} from "../view/settings-search.js";

/** The client compiles with the DOM lib, so this names the members of the worker global actually used. */
interface WorkerGlobal {
  postMessage(message: SettingsSearchResponse): void;
  onmessage: ((event: MessageEvent<SettingsSearchRequest>) => void) | null;
}

const worker = self as unknown as WorkerGlobal;
const host = new SettingsSearchHost();

worker.onmessage = (event: MessageEvent<SettingsSearchRequest>) => {
  const message = event.data;
  if (message.type === "index") {
    host.index(message.input);
    return;
  }
  worker.postMessage({ requestId: message.requestId, results: host.search(message.query) });
};
