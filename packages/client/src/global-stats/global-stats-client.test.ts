import { beforeEach, describe, expect, test, vi } from "vitest";
import type { GlobalStats, GlobalVillainCards } from "@mc/sync-worker/global-protocol";
import {
  GLOBAL_STATS_TTL_MS,
  clearGlobalMemory,
  loadGlobalStats,
  loadGlobalVillainCards,
} from "./global-stats-client.js";
import { jsonResponse, memoryStorage } from "./fixtures.js";

const STATS: GlobalStats = {
  updatedAt: 1,
  games: 40,
  villains: [{ key: "Rhino", games: 30, wins: 15, causes: { scheme: 10, villain: 5 } }],
  modulars: [],
  heroes: [],
};
const CARDS: GlobalVillainCards = { villain: "Rhino", wins: 10, losses: 10, inWins: { a: 5 }, inLosses: { a: 2 } };

function deps(handler: (url: string) => Promise<Response>) {
  let now = 1_000_000;
  const fetchFn = vi.fn((url: string) => handler(url));
  const storage = memoryStorage();
  return {
    fetchFn,
    storage,
    advance: (ms: number) => void (now += ms),
    d: { baseUrl: "https://w.test", fetch: fetchFn as unknown as typeof fetch, storage, now: () => now },
  };
}

beforeEach(() => clearGlobalMemory());

describe("loadGlobalStats", () => {
  test("makes no request until asked, then caches for 6 hours", async () => {
    const t = deps(async () => jsonResponse(200, STATS));
    expect(t.fetchFn).not.toHaveBeenCalled();
    expect(await loadGlobalStats(t.d)).toEqual({ kind: "ready", data: STATS, stale: false });
    await loadGlobalStats(t.d);
    expect(t.fetchFn).toHaveBeenCalledTimes(1);
    t.advance(GLOBAL_STATS_TTL_MS + 1);
    await loadGlobalStats(t.d);
    expect(t.fetchFn).toHaveBeenCalledTimes(2);
  });

  test("a fresh page load reads the stored copy without asking", async () => {
    const t = deps(async () => jsonResponse(200, STATS));
    await loadGlobalStats(t.d);
    clearGlobalMemory();
    await loadGlobalStats(t.d);
    expect(t.fetchFn).toHaveBeenCalledTimes(1);
  });

  test("answers the stale copy when the Worker is down", async () => {
    let up = true;
    const t = deps(async () => {
      if (!up) throw new TypeError("offline");
      return jsonResponse(200, STATS);
    });
    await loadGlobalStats(t.d);
    t.advance(GLOBAL_STATS_TTL_MS + 1);
    up = false;
    expect(await loadGlobalStats(t.d)).toEqual({ kind: "ready", data: STATS, stale: true });
  });

  test.each([503, 429, 500])("a %i with nothing cached is unavailable", async (status) => {
    const t = deps(async () => jsonResponse(status, { reason: "disabled" }));
    expect(await loadGlobalStats(t.d)).toEqual({ kind: "unavailable" });
  });

  test("a body of the wrong shape is unavailable, and not cached", async () => {
    const t = deps(async () => jsonResponse(200, { games: "many" }));
    expect(await loadGlobalStats(t.d)).toEqual({ kind: "unavailable" });
    expect(t.storage.data.size).toBe(0);
  });

  test("no Worker URL: unavailable with no request; storage that throws is fine", async () => {
    const t = deps(async () => jsonResponse(200, STATS));
    expect(await loadGlobalStats({ ...t.d, baseUrl: null })).toEqual({ kind: "unavailable" });
    expect(t.fetchFn).not.toHaveBeenCalled();
    const broken = {
      getItem: (): string | null => {
        throw new Error("x");
      },
      setItem: (): void => {
        throw new Error("x");
      },
    };
    expect((await loadGlobalStats({ ...t.d, storage: broken })).kind).toBe("ready");
  });

  test("cache keys do not start with mc-", async () => {
    const t = deps(async () => jsonResponse(200, STATS));
    await loadGlobalStats(t.d);
    expect([...t.storage.data.keys()].every((k) => !k.startsWith("mc-"))).toBe(true);
  });
});

describe("loadGlobalVillainCards", () => {
  test("asks for the villain by name, encoded, and caches per villain", async () => {
    const t = deps(async () => jsonResponse(200, CARDS));
    expect(await loadGlobalVillainCards("Rhino & Co", t.d)).toEqual({ kind: "ready", data: CARDS, stale: false });
    expect(t.fetchFn.mock.calls[0]![0]).toBe("https://w.test/global/cards?villain=Rhino%20%26%20Co");
    await loadGlobalVillainCards("Rhino & Co", t.d);
    expect(t.fetchFn).toHaveBeenCalledTimes(1);
    await loadGlobalVillainCards("Klaw", t.d);
    expect(t.fetchFn).toHaveBeenCalledTimes(2);
  });

  test("a villain with too few decks is none, not unavailable", async () => {
    const t = deps(async () => jsonResponse(404, { reason: "not-found", error: "x" }));
    expect(await loadGlobalVillainCards("Rhino", t.d)).toEqual({ kind: "none" });
  });

  test("a 404 without the Worker's own answer is unavailable", async () => {
    const t = deps(async () => new Response("nope", { status: 404 }));
    expect(await loadGlobalVillainCards("Rhino", t.d)).toEqual({ kind: "unavailable" });
  });

  test("a timeout or network error is unavailable", async () => {
    const t = deps(async () => {
      throw new DOMException("timeout", "TimeoutError");
    });
    expect(await loadGlobalVillainCards("Rhino", t.d)).toEqual({ kind: "unavailable" });
  });
});
