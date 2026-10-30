import { beforeEach, describe, expect, test, vi } from "vitest";
import { notifySaveDataChanged } from "../sync/save-data-changed.js";
import { SENT_CAP, markSent, readConsent, readSent, turnOffGlobalStats, turnOnGlobalStats } from "./global-consent.js";
import {
  MAX_AGE_MS,
  MAX_PER_RUN,
  resetGlobalUploadBackoff,
  runGlobalUpload,
  startGlobalUploads,
} from "./global-upload.js";
import { NAMES, jsonResponse, memoryStorage, meta } from "./fixtures.js";

const BASE = "https://w.test";
const later = (id: string, at = 9000) => meta({ id, updatedAt: at });

function setup(status: number | Error = 200, headers: Record<string, string> = {}) {
  const storage = memoryStorage();
  const fetched: { url: string; body: { id: string } }[] = [];
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    fetched.push({ url, body: JSON.parse(String(init?.body)) as { id: string } });
    if (status instanceof Error) throw status;
    const response = jsonResponse(status);
    for (const [k, v] of Object.entries(headers)) response.headers.set(k, v);
    return response;
  });
  const deps = { baseUrl: BASE, fetch: fetchFn as unknown as typeof fetch, storage, names: NAMES, now: () => 10_000 };
  return { storage, fetched, fetchFn, deps };
}

beforeEach(() => {
  vi.useRealTimers();
  resetGlobalUploadBackoff();
});

describe("runGlobalUpload", () => {
  test("sends nothing unless sharing is on", async () => {
    const { deps, fetchFn } = setup();
    await runGlobalUpload({ listSaves: async () => [later("a")] }, deps);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("never sends the games finished before it was turned on", async () => {
    const { deps, fetchFn, storage } = setup();
    const old = meta({ id: "old", updatedAt: 100 });
    turnOnGlobalStats(["old"], storage, 5000);
    await runGlobalUpload({ listSaves: async () => [old] }, deps);
    expect(fetchFn).not.toHaveBeenCalled();
    // Even one the snapshot missed (synced in later) is held back by its time.
    await runGlobalUpload({ listSaves: async () => [meta({ id: "synced", updatedAt: 100 })] }, deps);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("posts a new game once, hashed, and marks it sent", async () => {
    const { deps, fetched, storage } = setup();
    turnOnGlobalStats([], storage, 5000);
    const store = { listSaves: async () => [later("a")] };
    expect(await runGlobalUpload(store, deps)).toBe(1);
    expect(fetched).toHaveLength(1);
    expect(fetched[0]!.url).toBe(`${BASE}/global/result`);
    expect(fetched[0]!.body.id).toMatch(/^[0-9a-f]{32}$/);
    expect(readSent(storage).has("a")).toBe(true);
    await runGlobalUpload(store, deps);
    expect(fetched).toHaveLength(1);
  });

  test("a 400 marks the game sent too", async () => {
    const { deps, storage } = setup(400);
    turnOnGlobalStats([], storage, 5000);
    await runGlobalUpload({ listSaves: async () => [later("a")] }, deps);
    expect(readSent(storage).has("a")).toBe(true);
  });

  test.each([429, 503, 500, 404])("a %i stops quietly and keeps the game for next time", async (status) => {
    const { deps, storage, fetchFn } = setup(status);
    turnOnGlobalStats([], storage, 5000);
    await runGlobalUpload({ listSaves: async () => [later("a"), later("b")] }, deps);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(readSent(storage).size).toBe(0);
  });

  test("a 507 lets the game go and ends the run, so it does not head the queue forever", async () => {
    const { deps, storage, fetchFn } = setup(507);
    turnOnGlobalStats([], storage, 5000);
    const saves = [later("a"), later("b", 9001)];
    await runGlobalUpload({ listSaves: async () => saves }, deps);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(readSent(storage).has("a")).toBe(true);
    await runGlobalUpload({ listSaves: async () => saves }, deps);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(readSent(storage).has("b")).toBe(true);
  });

  test("a 429 with Retry-After holds every run until then", async () => {
    let now = 1_000_000;
    const { deps, storage, fetchFn } = setup(429, { "Retry-After": "60" });
    turnOnGlobalStats([], storage, 5000);
    const store = { listSaves: async () => [later("a")] };
    await runGlobalUpload(store, { ...deps, now: () => now });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    now += 59_000;
    await runGlobalUpload(store, { ...deps, now: () => now });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    now += 2000;
    await runGlobalUpload(store, { ...deps, now: () => now });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(readSent(storage).size).toBe(0);
  });

  test("sharing turned off mid-run stops before the next post", async () => {
    const { deps, storage, fetchFn } = setup();
    turnOnGlobalStats([], storage, 5000);
    fetchFn.mockImplementationOnce(async () => {
      turnOffGlobalStats(storage);
      return jsonResponse(200);
    });
    await runGlobalUpload({ listSaves: async () => [later("a"), later("b")] }, deps);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(readConsent(storage)).toBe("off");
  });

  test("a game evicted from a full sent set is not due again (high-water mark)", async () => {
    const { deps, storage, fetchFn } = setup();
    turnOnGlobalStats([], storage, 5000);
    const first = meta({ id: "first", updatedAt: 9000 });
    await runGlobalUpload({ listSaves: async () => [first] }, deps);
    markSent(
      Array.from({ length: SENT_CAP - 1 }, (_, i) => `other${i}`),
      storage,
    );
    const second = meta({ id: "second", updatedAt: 9500 });
    await runGlobalUpload({ listSaves: async () => [first, second] }, deps);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(readSent(storage).has("first")).toBe(false);
    await runGlobalUpload({ listSaves: async () => [first, second] }, deps);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  test("a game over 30 days old is never sent: the Worker may have forgotten its id", async () => {
    const { deps, storage, fetchFn } = setup();
    turnOnGlobalStats([], storage, 5000);
    const old = meta({ id: "old", updatedAt: 9000 });
    await runGlobalUpload({ listSaves: async () => [old] }, { ...deps, now: () => 9000 + MAX_AGE_MS + 1 });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("a game synced in late with an older stamp still goes", async () => {
    const { deps, storage, fetchFn } = setup();
    turnOnGlobalStats([], storage, 5000);
    const newer = meta({ id: "newer", updatedAt: 9000 });
    await runGlobalUpload({ listSaves: async () => [newer] }, deps);
    const late = meta({ id: "late", updatedAt: 8000 });
    await runGlobalUpload({ listSaves: async () => [newer, late] }, deps);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  test("a network error stops quietly and does not throw", async () => {
    const { deps, storage } = setup(new TypeError("offline"));
    turnOnGlobalStats([], storage, 5000);
    await expect(runGlobalUpload({ listSaves: async () => [later("a")] }, deps)).resolves.toBe(0);
    expect(readSent(storage).size).toBe(0);
  });

  test("a failing store never throws", async () => {
    const { deps, storage } = setup();
    turnOnGlobalStats([], storage, 5000);
    const listSaves = async (): Promise<never> => {
      throw new Error("db");
    };
    await expect(runGlobalUpload({ listSaves }, deps)).resolves.toBe(0);
  });

  test("at most a few per run", async () => {
    const { deps, storage, fetchFn } = setup();
    turnOnGlobalStats([], storage, 5000);
    const saves = Array.from({ length: MAX_PER_RUN + 4 }, (_, i) => later(`g${i}`));
    await runGlobalUpload({ listSaves: async () => saves }, deps);
    expect(fetchFn).toHaveBeenCalledTimes(MAX_PER_RUN);
  });

  test("no Worker URL means no request and no failure", async () => {
    const { deps, storage, fetchFn } = setup();
    turnOnGlobalStats([], storage, 5000);
    await runGlobalUpload({ listSaves: async () => [later("a")] }, { ...deps, baseUrl: null });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("a game that cannot be sent (old summary) is skipped, not posted", async () => {
    const { deps, storage, fetchFn } = setup();
    turnOnGlobalStats([], storage, 5000);
    await runGlobalUpload({ listSaves: async () => [meta({ id: "o", updatedAt: 9000 }, { version: 4 })] }, deps);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("startGlobalUploads", () => {
  test("runs at once and again after a quiet spell following a save signal", async () => {
    vi.useFakeTimers();
    const { deps, storage } = setup();
    turnOnGlobalStats([], storage, 5000);
    const listSaves = vi.fn(async () => []);
    const stop = startGlobalUploads({ listSaves }, deps, 1000);
    await vi.advanceTimersByTimeAsync(0);
    expect(listSaves).toHaveBeenCalledTimes(1);
    notifySaveDataChanged("game");
    notifySaveDataChanged("turn");
    notifySaveDataChanged("deck");
    await vi.advanceTimersByTimeAsync(1000);
    expect(listSaves).toHaveBeenCalledTimes(2);
    stop();
    notifySaveDataChanged("game");
    await vi.advanceTimersByTimeAsync(2000);
    expect(listSaves).toHaveBeenCalledTimes(2);
  });

  test("a game still being played holds the listing back; a finished one or none does not", async () => {
    vi.useFakeTimers();
    const { deps, storage } = setup();
    turnOnGlobalStats([], storage, 5000);
    const listSaves = vi.fn(async () => []);
    const state: { game: { outcome?: unknown } | null } = { game: {} };
    const stop = startGlobalUploads({ listSaves, state }, deps, 1000);
    await vi.advanceTimersByTimeAsync(0);
    listSaves.mockClear();
    notifySaveDataChanged("game");
    await vi.advanceTimersByTimeAsync(2000);
    expect(listSaves).not.toHaveBeenCalled();
    state.game = { outcome: { result: "win" } };
    notifySaveDataChanged("game");
    await vi.advanceTimersByTimeAsync(2000);
    expect(listSaves).toHaveBeenCalledTimes(1);
    state.game = null;
    notifySaveDataChanged("game");
    await vi.advanceTimersByTimeAsync(2000);
    expect(listSaves).toHaveBeenCalledTimes(2);
    stop();
  });

  test("with sharing off a save signal lists nothing", async () => {
    vi.useFakeTimers();
    const { deps } = setup();
    const listSaves = vi.fn(async () => []);
    const stop = startGlobalUploads({ listSaves }, deps, 1000);
    notifySaveDataChanged("game");
    await vi.advanceTimersByTimeAsync(5000);
    expect(listSaves).not.toHaveBeenCalled();
    stop();
  });
});
