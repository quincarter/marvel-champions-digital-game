/** The pod log store resolves a save only once its IndexedDB transaction completes, never on the request alone. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { IdbEpicLogStore, type EpicLogRecord } from "./epic-coordinator.js";

const record = (length: number): EpicLogRecord =>
  ({
    roomId: "room",
    setup: { groups: [] },
    log: Array.from({ length }, () => null),
    savedAt: 1,
  }) as unknown as EpicLogRecord;

/** A fake IndexedDB: `put` reports request success, then the transaction aborts while `abortPuts` is set. */
function fakeIdb(control: { abortPuts: boolean }) {
  const stored = new Map<string, unknown>();
  const db = {
    transaction() {
      const tx: Record<string, any> = { error: null };
      tx.objectStore = () => ({
        put(value: { roomId: string }) {
          const request: Record<string, any> = { result: value.roomId };
          setTimeout(() => {
            request.onsuccess?.();
            if (control.abortPuts) {
              tx.error = new Error("QuotaExceededError");
              tx.onabort?.();
            } else {
              stored.set(value.roomId, value);
              tx.oncomplete?.();
            }
          }, 0);
          return request;
        },
      });
      return tx;
    },
  };
  const factory = {
    open() {
      const request: Record<string, any> = { result: db };
      setTimeout(() => request.onsuccess?.(), 0);
      return request;
    },
  };
  return { factory, stored };
}

describe("IdbEpicLogStore durability", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rejects a save whose request succeeds but whose transaction aborts, and a retry then commits", async () => {
    const control = { abortPuts: true };
    const { factory, stored } = fakeIdb(control);
    vi.stubGlobal("indexedDB", factory);
    const store = new IdbEpicLogStore();
    await expect(store.save(record(3))).rejects.toThrow("QuotaExceededError");
    expect(stored.size).toBe(0);
    control.abortPuts = false;
    await expect(store.save(record(3))).resolves.toBeUndefined();
    expect(stored.size).toBe(1);
  });

  it("reopens after a failed open instead of caching the rejection", async () => {
    const { factory, stored } = fakeIdb({ abortPuts: false });
    let failOpen = true;
    let opens = 0;
    vi.stubGlobal("indexedDB", {
      open() {
        opens += 1;
        if (!failOpen) return factory.open();
        const request: Record<string, any> = { error: new Error("open denied") };
        setTimeout(() => request.onerror?.(), 0);
        return request;
      },
    });
    const store = new IdbEpicLogStore();
    await expect(store.save(record(1))).rejects.toThrow("open denied");
    failOpen = false;
    await expect(store.save(record(1))).resolves.toBeUndefined();
    expect(opens).toBe(2);
    expect(stored.size).toBe(1);
  });

  it("reopens after the connection is closed or must yield to a version change", async () => {
    const { factory } = fakeIdb({ abortPuts: false });
    const dbs: Record<string, any>[] = [];
    vi.stubGlobal("indexedDB", {
      open() {
        const request = factory.open() as Record<string, any>;
        const db = Object.assign(Object.create(request.result), { close: vi.fn() });
        request.result = db;
        dbs.push(db);
        return request;
      },
    });
    const store = new IdbEpicLogStore();
    await store.save(record(1));
    dbs[0]!.onversionchange?.();
    expect(dbs[0]!.close).toHaveBeenCalled();
    await store.save(record(1));
    dbs[1]!.onclose?.();
    await store.save(record(1));
    expect(dbs).toHaveLength(3);
  });
});
