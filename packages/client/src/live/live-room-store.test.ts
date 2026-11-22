/** The live room store resolves a save only once its IndexedDB transaction completes, never on the request alone. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { flakyIdb } from "./fake-idb.js";
import { IdbRoomStore } from "./live-room-store.js";

/** A fake IndexedDB: `put` reports request success, then the transaction aborts while `abortPuts` is set. */
function fakeIdb(control: { abortPuts: boolean }) {
  const stored = new Map<string, unknown>();
  const db = {
    transaction() {
      const tx: Record<string, any> = { error: null };
      tx.objectStore = () => ({
        put(value: Record<string, string>) {
          const request: Record<string, any> = { result: value.gameKey };
          setTimeout(() => {
            request.onsuccess?.();
            if (control.abortPuts) {
              tx.error = new Error("QuotaExceededError");
              tx.onabort?.();
            } else {
              stored.set(value.gameKey!, value);
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

describe("IdbRoomStore durability", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rejects a save whose request succeeds but whose transaction aborts, and a retry then commits", async () => {
    const control = { abortPuts: true };
    const { factory, stored } = fakeIdb(control);
    vi.stubGlobal("indexedDB", factory);
    const store = new IdbRoomStore();
    const record = { gameKey: "g", roomId: "r", hostToken: "t", createdAt: 1 };
    await expect(store.save(record)).rejects.toThrow("QuotaExceededError");
    expect(stored.size).toBe(0);
    control.abortPuts = false;
    await expect(store.save(record)).resolves.toBeUndefined();
    expect(stored.size).toBe(1);
  });

  it("reopens after a failed open instead of caching the rejection", async () => {
    const { factory, records, control } = flakyIdb();
    records.set("g", { gameKey: "g", roomId: "r" });
    vi.stubGlobal("indexedDB", factory);
    const store = new IdbRoomStore();
    control.failOpens = 1;
    await expect(store.load("g")).rejects.toThrow("open failed");
    await expect(store.load("g")).resolves.toMatchObject({ roomId: "r" });
    expect(control.opens).toBe(2);
  });

  it("turns a synchronous open throw into a rejection and recovers on the next call", async () => {
    const { factory, records, control } = flakyIdb();
    records.set("g", { gameKey: "g", roomId: "r" });
    vi.stubGlobal("indexedDB", factory);
    const store = new IdbRoomStore();
    control.throwOpens = 1;
    await expect(store.load("g")).rejects.toThrow("SecurityError");
    await expect(store.load("g")).resolves.toMatchObject({ roomId: "r" });
  });

  it("reopens after the connection closes, and closes then reopens on a version change", async () => {
    const { factory, records, control } = flakyIdb();
    records.set("g", { gameKey: "g", roomId: "r" });
    vi.stubGlobal("indexedDB", factory);
    const store = new IdbRoomStore();
    await store.load("g");
    await store.load("g");
    expect(control.opens).toBe(1);
    control.dbs[0]!.onclose();
    await store.load("g");
    expect(control.opens).toBe(2);
    control.dbs[1]!.onversionchange();
    expect(control.dbs[1]!.close).toHaveBeenCalled();
    await store.load("g");
    expect(control.opens).toBe(3);
  });
});
