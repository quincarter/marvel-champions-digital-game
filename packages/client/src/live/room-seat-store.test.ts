/** The seat token store resolves a save only once its IndexedDB transaction completes, never on the request alone. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { IdbSeatTokenStore } from "./room-seat-store.js";

/** A fake IndexedDB: `put` reports request success, then the transaction aborts while `abortPuts` is set. */
function fakeIdb(control: { abortPuts: boolean }) {
  const stored = new Map<string, unknown>();
  const db = {
    transaction() {
      const tx: Record<string, any> = { error: null };
      tx.objectStore = () => ({
        put(value: Record<string, string>) {
          const request: Record<string, any> = { result: value.roomId };
          setTimeout(() => {
            request.onsuccess?.();
            if (control.abortPuts) {
              tx.error = new Error("QuotaExceededError");
              tx.onabort?.();
            } else {
              stored.set(value.roomId!, value);
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

describe("IdbSeatTokenStore durability", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rejects a save whose request succeeds but whose transaction aborts, and a retry then commits", async () => {
    const control = { abortPuts: true };
    const { factory, stored } = fakeIdb(control);
    vi.stubGlobal("indexedDB", factory);
    const store = new IdbSeatTokenStore();
    const record = { roomId: "r", tokens: { a: "t" }, savedAt: 1 };
    await expect(store.save(record)).rejects.toThrow("QuotaExceededError");
    expect(stored.size).toBe(0);
    control.abortPuts = false;
    await expect(store.save(record)).resolves.toBeUndefined();
    expect(stored.size).toBe(1);
  });
});
