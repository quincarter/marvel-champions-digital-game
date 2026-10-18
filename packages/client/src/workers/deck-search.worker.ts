/**
 * The deck-search worker (`view/deck-search-client.ts` owns it): holds the prepared documents and answers each query
 * with the ranked ids, off the main thread. All the logic is `view/deck-search.ts`'s, which the tests call directly.
 */
import { DeckSearchHost, type DeckSearchRequest, type DeckWorkerResponse } from "../view/deck-search.js";

/** The client compiles with the DOM lib, so this names the members of the worker global actually used (as `engine.worker.ts` does). */
interface WorkerGlobal {
  postMessage(message: DeckWorkerResponse): void;
  onmessage: ((event: MessageEvent<DeckSearchRequest>) => void) | null;
}

const worker = self as unknown as WorkerGlobal;
const host = new DeckSearchHost();

worker.onmessage = (event: MessageEvent<DeckSearchRequest>) => {
  const message = event.data;
  if (message.type === "docs") {
    host.setDocuments(message.documents);
    return;
  }
  if (message.type === "status") {
    // The pool is evaluated here, in the worker, the first time a deck is asked about; a search never pays for it.
    // An empty answer (the module failed to load) tells the client to work the decks out itself.
    void import("../view/deck-status-host.js").then(
      ({ deckVerdictsOf }) =>
        worker.postMessage({ requestId: message.requestId, statuses: deckVerdictsOf(message.decks) }),
      () => worker.postMessage({ requestId: message.requestId, statuses: [] }),
    );
    return;
  }
  worker.postMessage({ requestId: message.requestId, ranked: host.search(message.query) });
};
