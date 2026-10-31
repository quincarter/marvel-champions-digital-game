/**
 * The main-thread side of Settings' search worker (#576): what the rows say goes over once per open, a keystroke sends
 * only the query, and the answer comes back ready to draw. Only the newest query's answer is delivered. Where there is
 * no `Worker`, or it fails, the host is loaded and runs here; it is imported only then, so the pages' text and the card
 * pool it reads stay out of the main thread's way.
 */
import type {
  SettingsSearchHost,
  SettingsSearchIndexInput,
  SettingsSearchRequest,
  SettingsSearchResponse,
  SettingsSearchResult,
} from "./settings-search.js";

/** The part of `Worker` used, so a test can stand in for it. */
export interface SettingsSearchWorkerLike {
  postMessage(message: SettingsSearchRequest): void;
  onmessage: ((event: { readonly data: SettingsSearchResponse }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  terminate(): void;
}

export type SettingsSearchWorkerFactory = () => SettingsSearchWorkerLike | null;

export const spawnSettingsSearchWorker: SettingsSearchWorkerFactory = () => {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("../workers/settings-search.worker.ts", import.meta.url), {
      type: "module",
      name: "mc-settings-search",
    }) as unknown as SettingsSearchWorkerLike;
  } catch {
    return null;
  }
};

type Done = (results: readonly SettingsSearchResult[]) => void;

export class SettingsSearchClient {
  readonly #factory: SettingsSearchWorkerFactory;
  #worker: SettingsSearchWorkerLike | null = null;
  #started = false;
  #local: Promise<SettingsSearchHost> | null = null;
  #input: SettingsSearchIndexInput | null = null;
  #latest = 0;
  #pending: { readonly query: string; readonly done: Done } | null = null;

  constructor(factory: SettingsSearchWorkerFactory = spawnSettingsSearchWorker) {
    this.#factory = factory;
  }

  #start(): SettingsSearchWorkerLike | null {
    if (this.#started) return this.#worker;
    this.#started = true;
    const worker = this.#factory();
    if (!worker) return null;
    worker.onmessage = ({ data }) => {
      if (data.requestId !== this.#latest) return;
      const pending = this.#pending;
      this.#pending = null;
      pending?.done(data.results);
    };
    worker.onerror = () => {
      worker.terminate();
      this.#worker = null;
      const pending = this.#pending;
      this.#pending = null;
      if (pending) this.#searchHere(pending.query, this.#latest, pending.done);
    };
    this.#worker = worker;
    return worker;
  }

  #host(): Promise<SettingsSearchHost> {
    this.#local ??= import("./settings-search.js").then(({ SettingsSearchHost: Host }) => {
      const host = new Host();
      if (this.#input) host.index(this.#input);
      return host;
    });
    return this.#local;
  }

  #searchHere(query: string, requestId: number, done: Done): void {
    void this.#host().then((host) => {
      if (requestId === this.#latest) done(host.search(query));
    });
  }

  /** What is searched from now on. */
  index(input: SettingsSearchIndexInput): void {
    this.#input = input;
    const worker = this.#start();
    if (worker) worker.postMessage({ type: "index", input });
    else if (this.#local) void this.#local.then((host) => host.index(input));
  }

  /** Calls `done` with the matches, best first, unless a newer `search` or a `cancel` has come since. */
  search(query: string, done: Done): void {
    const requestId = ++this.#latest;
    const worker = this.#start();
    if (!worker) {
      this.#searchHere(query, requestId, done);
      return;
    }
    this.#pending = { query, done };
    worker.postMessage({ type: "query", requestId, query });
  }

  /** Drops any answer still on its way (the query was cleared). */
  cancel(): void {
    this.#latest++;
    this.#pending = null;
  }

  destroy(): void {
    this.cancel();
    this.#worker?.terminate();
    this.#worker = null;
  }
}
