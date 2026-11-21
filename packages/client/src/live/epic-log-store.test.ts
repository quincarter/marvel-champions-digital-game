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
});
