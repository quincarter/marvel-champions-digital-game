import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Deck } from "@mc/content";
import { isStatusResponse, type DeckSearchRequest } from "./deck-search.js";
import { DeckSearchClient, SEARCH_WORKER_IDLE_MS, type SearchWorkerLike } from "./deck-search-client.js";
import {
  cachedDeckOption,
  pendingDeckOption,
  primeDeckOption,
  verdictOf,
  type DeckVerdict,
} from "./deck-list-model.js";
import { deckStatusOf } from "./deck-status.js";
import { POOL_CARDS, POOL_DEPS, POOL_VERSION } from "../content/pool.js";
import { preconDecks } from "./deck-list-model.js";

type StatusRequest = Extract<DeckSearchRequest, { type: "status" }>;

class FakeWorker implements SearchWorkerLike {
  onmessage: SearchWorkerLike["onmessage"] = null;
  onerror: SearchWorkerLike["onerror"] = null;
  terminated = false;
  readonly sent: DeckSearchRequest[] = [];
  postMessage(message: DeckSearchRequest): void {
    this.sent.push(message);
  }
  statusRequests(): StatusRequest[] {
    return this.sent.filter((m): m is StatusRequest => m.type === "status");
  }
  answer(requestId: number, statuses: readonly DeckVerdict[]): void {
    this.onmessage?.({ data: { requestId, statuses } });
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
const verdict = (name: string): DeckVerdict => ({
  identityName: name,
  legal: true,
  problems: [],
  unscripted: [],
  poolChanged: false,
  seatable: true,
  blockedReason: null,
  warning: null,
});
const decks = preconDecks(POOL_VERSION).slice(0, 2) as readonly Deck[];
const compute = (asked: readonly Deck[]): readonly DeckVerdict[] => asked.map((d) => verdict(`local ${d.name}`));

beforeEach(() => {
  workers = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("DeckSearchClient.checkDecks", () => {
  test("posts one status request for all the decks and delivers one answer", () => {
    const client = new DeckSearchClient(factory);
    const seen: (readonly DeckVerdict[])[] = [];
    client.checkDecks(decks, compute, (v) => seen.push(v));
    const [request] = workers[0]!.statusRequests();
    expect(request!.decks).toBe(decks);
    expect(seen).toEqual([]);
    workers[0]!.answer(request!.requestId, [verdict("a"), verdict("b")]);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.map((v) => v.identityName)).toEqual(["a", "b"]);
  });

  test("an answer is delivered even after a newer request, and a search does not cancel it", () => {
    const client = new DeckSearchClient(factory);
    const seen: string[] = [];
    client.checkDecks(decks, compute, () => seen.push("first"));
    client.search("x", () => undefined);
    client.cancel();
    client.checkDecks(decks, compute, () => seen.push("second"));
    const [first, second] = workers[0]!.statusRequests();
    workers[0]!.answer(second!.requestId, [verdict("a"), verdict("b")]);
    workers[0]!.answer(first!.requestId, [verdict("a"), verdict("b")]);
    expect(seen).toEqual(["second", "first"]);
  });

  test("computes in place when there is no worker", () => {
    const client = new DeckSearchClient(() => null);
    const seen: string[] = [];
    client.checkDecks(decks, compute, (v) => seen.push(...v.map((x) => x.identityName ?? "")));
    expect(seen).toEqual(decks.map((d) => `local ${d.name}`));
  });

  test("a worker that fails hands pending requests to the local compute", () => {
    const client = new DeckSearchClient(factory);
    const seen: number[] = [];
    client.checkDecks(decks, compute, (v) => seen.push(v.length));
    workers[0]!.onerror?.({});
    expect(seen).toEqual([2]);
    expect(workers[0]!.terminated).toBe(true);
  });

  test("an empty reply (the pool failed to load in the worker) is computed locally", () => {
    const client = new DeckSearchClient(factory);
    const seen: string[] = [];
    client.checkDecks(decks, compute, (v) => seen.push(v[0]!.identityName ?? ""));
    workers[0]!.answer(workers[0]!.statusRequests()[0]!.requestId, []);
    expect(seen).toEqual([`local ${decks[0]!.name}`]);
  });

  test("the worker lives until the status answer arrives, then ends when idle", () => {
    const client = new DeckSearchClient(factory);
    client.checkDecks(decks, compute, () => undefined);
    vi.advanceTimersByTime(SEARCH_WORKER_IDLE_MS * 3);
    expect(workers[0]!.terminated).toBe(false);
    workers[0]!.answer(workers[0]!.statusRequests()[0]!.requestId, [verdict("a"), verdict("b")]);
    vi.advanceTimersByTime(SEARCH_WORKER_IDLE_MS + 1);
    expect(workers[0]!.terminated).toBe(true);
  });
});

describe("deck status handoff", () => {
  test("isStatusResponse tells the two replies apart", () => {
    expect(isStatusResponse({ requestId: 1, statuses: [] })).toBe(true);
    expect(isStatusResponse({ requestId: 1, ranked: [] })).toBe(false);
  });

  test("a primed verdict becomes the deck's cached option, and a stand-in reads as Checking", () => {
    const deck = decks[0]!;
    const real = verdictOf(deck, POOL_CARDS, POOL_VERSION, POOL_DEPS);
    expect(cachedDeckOption(deck, POOL_CARDS, POOL_VERSION, POOL_DEPS)).toBeNull();
    const pending = pendingDeckOption(deck, POOL_CARDS);
    expect(pending.seatable).toBe(false);
    expect(deckStatusOf(pending).text).toBe("Checking…");
    const posted = structuredClone(real);
    const option = primeDeckOption(deck, POOL_CARDS, POOL_VERSION, POOL_DEPS, posted);
    expect(cachedDeckOption(deck, POOL_CARDS, POOL_VERSION, POOL_DEPS)).toBe(option);
    expect(option.deck).toBe(deck);
    expect(deckStatusOf(option).text).not.toBe("Checking…");
  });
});
