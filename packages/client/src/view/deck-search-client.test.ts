import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DeckSearchHost, type DeckSearchRequest, type SearchDocument } from "./deck-search.js";
import { DeckSearchClient, SEARCH_WORKER_IDLE_MS, type SearchWorkerLike } from "./deck-search-client.js";

const docs: readonly SearchDocument[] = [
  { id: "a", primary: ["Captain Marvel"] },
  { id: "b", primary: ["Spider-Man"] },
];

type QueryRequest = Extract<DeckSearchRequest, { type: "query" }>;

/** A worker that answers only when told to, so a test can reply out of order. */
class FakeWorker implements SearchWorkerLike {
  onmessage: SearchWorkerLike["onmessage"] = null;
  onerror: SearchWorkerLike["onerror"] = null;
  terminated = false;
  readonly sent: DeckSearchRequest[] = [];
  readonly #host = new DeckSearchHost();
  postMessage(message: DeckSearchRequest): void {
    this.sent.push(message);
    if (message.type === "docs") this.#host.setDocuments(message.documents);
  }
  reply(requestId: number, query: string): void {
    this.onmessage?.({ data: { requestId, ranked: this.#host.search(query) } });
  }
  terminate(): void {
    this.terminated = true;
  }
}

let workers: FakeWorker[] = [];
const factory = (): FakeWorker => {
  const w = new FakeWorker();
  workers.push(w);
  return w;
};
const requestsOf = (w: FakeWorker): QueryRequest[] => w.sent.filter((m): m is QueryRequest => m.type === "query");

beforeEach(() => {
  workers = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("DeckSearchClient", () => {
  test("creates the worker lazily, sends the documents once, then only queries", () => {
    const client = new DeckSearchClient(factory);
    client.setDocuments(docs, "v1");
    expect(workers).toHaveLength(0);
    client.search("cap", () => undefined);
    client.search("spi", () => undefined);
    expect(workers).toHaveLength(1);
    expect(workers[0]!.sent.map((m) => m.type)).toEqual(["docs", "query", "query"]);
    expect(client.setDocuments(docs, "v1")).toBe(false);
  });

  test("drops a stale reply so a slow answer never overwrites a newer query", () => {
    const client = new DeckSearchClient(factory);
    client.setDocuments(docs, "v1");
    const seen: string[] = [];
    client.search("cap", (r) => seen.push(`cap:${r.map((x) => x.id)}`));
    client.search("spi", (r) => seen.push(`spi:${r.map((x) => x.id)}`));
    const [first, second] = requestsOf(workers[0]!);
    workers[0]!.reply(second!.requestId, "spi");
    workers[0]!.reply(first!.requestId, "cap");
    expect(seen).toEqual(["spi:b"]);
  });

  test("terminates the worker after it sits idle, then starts a new one and re-sends the documents", () => {
    const client = new DeckSearchClient(factory);
    client.setDocuments(docs, "v1");
    client.search("cap", () => undefined);
    const w = workers[0]!;
    w.reply(requestsOf(w)[0]!.requestId, "cap");
    vi.advanceTimersByTime(SEARCH_WORKER_IDLE_MS - 1);
    expect(w.terminated).toBe(false);
    vi.advanceTimersByTime(1);
    expect(w.terminated).toBe(true);
    expect(client.usesWorker).toBe(false);

    client.search("spi", () => undefined);
    expect(workers).toHaveLength(2);
    expect(workers[1]!.sent.map((m) => m.type)).toEqual(["docs", "query"]);
  });

  test("does not terminate while a query is pending", () => {
    const client = new DeckSearchClient(factory);
    client.setDocuments(docs, "v1");
    client.search("cap", () => undefined);
    vi.advanceTimersByTime(SEARCH_WORKER_IDLE_MS * 3);
    expect(workers[0]!.terminated).toBe(false);
  });

  test("terminates on destroy and ignores a late reply", () => {
    const client = new DeckSearchClient(factory);
    client.setDocuments(docs, "v1");
    const seen: string[] = [];
    client.search("cap", () => seen.push("late"));
    const w = workers[0]!;
    client.destroy();
    w.reply(requestsOf(w)[0]!.requestId, "cap");
    expect(w.terminated).toBe(true);
    expect(seen).toEqual([]);
  });

  test("a changed document list reaches a live worker at once", () => {
    const client = new DeckSearchClient(factory);
    client.setDocuments(docs, "v1");
    client.search("cap", () => undefined);
    expect(client.setDocuments([docs[0]!], "v2")).toBe(true);
    expect(workers[0]!.sent.map((m) => m.type)).toEqual(["docs", "query", "docs"]);
  });

  test("without a worker the scorer runs synchronously", () => {
    const client = new DeckSearchClient(() => null);
    client.setDocuments(docs, "v1");
    let ids: string[] = [];
    client.search("spider", (r) => (ids = r.map((x) => x.id)));
    expect(ids).toEqual(["b"]);
  });

  test("a worker that errors hands its pending query to the synchronous scorer", () => {
    const client = new DeckSearchClient(factory);
    client.setDocuments(docs, "v1");
    let ids: string[] = [];
    client.search("spider", (r) => (ids = r.map((x) => x.id)));
    workers[0]!.onerror?.({});
    expect(ids).toEqual(["b"]);
    expect(workers[0]!.terminated).toBe(true);
  });
});
