/**
 * The main-thread side of the search worker. Documents go over once, when the list changes (`setDocuments` with a new
 * `version`), and a keystroke sends only the query. Each query carries an id, and only the newest query's answer is
 * delivered, so a slow reply never overwrites a newer one. Where there is no `Worker` (Vitest, a browser that refuses
 * one) the same `DeckSearchHost` runs synchronously and the answer arrives before `search` returns.
 */
import type { Deck } from "@mc/content";
import type { DeckVerdict } from "./deck-list-model.js";
import {
  DeckSearchHost,
  isStatusResponse,
  type DeckSearchRequest,
  type DeckWorkerResponse,
  type RankedDocument,
  type SearchDocument,
} from "./deck-search.js";

/** The part of `Worker` used, so a test can stand in for it. */
export interface SearchWorkerLike {
  postMessage(message: DeckSearchRequest): void;
  onmessage: ((event: { readonly data: DeckWorkerResponse }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  terminate(): void;
}

export type SearchWorkerFactory = () => SearchWorkerLike | null;

/** The app's worker, or null where workers are unavailable. */
export const spawnDeckSearchWorker: SearchWorkerFactory = () => {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("../workers/deck-search.worker.ts", import.meta.url), {
      type: "module",
      name: "mc-deck-search",
    }) as unknown as SearchWorkerLike;
  } catch {
    return null;
  }
};

/** How long the worker lives after its last answer with nothing pending. */
export const SEARCH_WORKER_IDLE_MS = 5000;

/** The synchronous way to get `checkDecks`' answer. */
export type StatusCompute = (decks: readonly Deck[]) => readonly DeckVerdict[];

export class DeckSearchClient {
  readonly #factory: SearchWorkerFactory;
  readonly #idleMs: number;
  /** Created on the first query and ended after `idleMs` of nothing pending, or on `destroy`; null between. */
  #worker: SearchWorkerLike | null = null;
  /** The factory returned no worker: every query runs here. */
  #noWorker = false;
  /** The synchronous fallback, kept in step with the documents so a worker that fails can be replaced by it. */
  readonly #local = new DeckSearchHost();
  #documents: readonly SearchDocument[] = [];
  #version: string | null = null;
  /** The version the live worker holds; a new worker holds none. */
  #sentVersion: string | null = null;
  #nextId = 0;
  #latest = 0;
  #pending: { readonly query: string; readonly done: (ranked: readonly RankedDocument[]) => void } | null = null;
  #idle: ReturnType<typeof setTimeout> | null = null;
  /** Status requests on their way (see `checkDecks`); each is answered whatever has been asked since. */
  readonly #statusPending = new Map<
    number,
    {
      readonly decks: readonly Deck[];
      readonly compute: StatusCompute;
      readonly done: (v: readonly DeckVerdict[]) => void;
    }
  >();
  #nextStatusId = 0;

  constructor(factory: SearchWorkerFactory = spawnDeckSearchWorker, idleMs = SEARCH_WORKER_IDLE_MS) {
    this.#factory = factory;
    this.#idleMs = idleMs;
  }

  /** True while a worker (not the fallback) is alive. */
  get usesWorker(): boolean {
    return this.#worker !== null;
  }

  /** Remembers the documents unless `version` is the one already held. Returns whether they changed; a live worker gets them at once, a later one when it starts. */
  setDocuments(documents: readonly SearchDocument[], version: string): boolean {
    if (version === this.#version) return false;
    this.#version = version;
    this.#documents = documents;
    this.#local.setDocuments(documents);
    if (this.#worker) this.#sendDocuments(this.#worker);
    return true;
  }

  #sendDocuments(worker: SearchWorkerLike): void {
    worker.postMessage({ type: "docs", documents: this.#documents });
    this.#sentVersion = this.#version;
  }

  #start(): SearchWorkerLike | null {
    if (this.#worker) return this.#worker;
    if (this.#noWorker) return null;
    const worker = this.#factory();
    if (!worker) {
      this.#noWorker = true;
      return null;
    }
    worker.onmessage = (event) => {
      const data = event.data;
      if (isStatusResponse(data)) {
        const asked = this.#statusPending.get(data.requestId);
        if (!asked) return;
        this.#statusPending.delete(data.requestId);
        // A reply of the wrong length means the worker could not load the pool: work the decks out here.
        asked.done(data.statuses.length === asked.decks.length ? data.statuses : asked.compute(asked.decks));
        this.#armIdle();
        return;
      }
      const { requestId, ranked } = data;
      if (requestId !== this.#latest) return;
      const pending = this.#pending;
      this.#pending = null;
      pending?.done(ranked);
      this.#armIdle();
    };
    worker.onerror = () => {
      // The worker failed: this query, the status requests and the later ones are answered here.
      const pending = this.#pending;
      this.#pending = null;
      const asked = [...this.#statusPending.values()];
      this.#statusPending.clear();
      this.#end();
      this.#noWorker = true;
      pending?.done(this.#local.search(pending.query));
      for (const request of asked) request.done(request.compute(request.decks));
    };
    this.#worker = worker;
    this.#sendDocuments(worker);
    return worker;
  }

  /** Ranks the documents against `query` and calls `onResult` with the matches, best first, unless a newer `search` has been made since. */
  search(query: string, onResult: (ranked: readonly RankedDocument[]) => void): void {
    const requestId = ++this.#nextId;
    this.#latest = requestId;
    this.#clearIdle();
    const worker = this.#start();
    if (!worker) {
      this.#pending = null;
      onResult(this.#local.search(query));
      return;
    }
    if (this.#sentVersion !== this.#version) this.#sendDocuments(worker);
    this.#pending = { query, done: onResult };
    worker.postMessage({ type: "query", requestId, query });
  }

  /**
   * The engine's verdict on each deck, worked out in the worker (which evaluates the card pool itself), delivered to
   * `onResult` in the order asked. `compute` is the same work done here, used where there is no worker; then the answer
   * arrives before this returns. Unlike a query, an answer is delivered even if another request has been made since.
   */
  checkDecks(
    decks: readonly Deck[],
    compute: StatusCompute,
    onResult: (verdicts: readonly DeckVerdict[]) => void,
  ): void {
    this.#clearIdle();
    const worker = this.#start();
    if (!worker) {
      onResult(compute(decks));
      return;
    }
    if (this.#sentVersion !== this.#version) this.#sendDocuments(worker);
    const requestId = ++this.#nextStatusId;
    this.#statusPending.set(requestId, { decks, compute, done: onResult });
    worker.postMessage({ type: "status", requestId, decks });
  }

  /** Drops any answer still on its way (the query was cleared). */
  cancel(): void {
    this.#latest = ++this.#nextId;
    this.#pending = null;
    if (this.#worker && this.#statusPending.size === 0) this.#armIdle();
  }

  #armIdle(): void {
    this.#clearIdle();
    this.#idle = setTimeout(() => {
      this.#idle = null;
      if (!this.#pending && this.#statusPending.size === 0) this.#end();
    }, this.#idleMs);
  }

  #clearIdle(): void {
    if (this.#idle !== null) clearTimeout(this.#idle);
    this.#idle = null;
  }

  /** Terminates the worker; the next query starts a new one and sends the documents again. */
  #end(): void {
    this.#clearIdle();
    this.#worker?.terminate();
    this.#worker = null;
    this.#sentVersion = null;
  }

  /** The scene is going away. */
  destroy(): void {
    this.#statusPending.clear();
    this.cancel();
    this.#end();
  }
}
