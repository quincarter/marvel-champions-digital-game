/** A fake IndexedDB for tests: open can fail or throw, connections can be closed from outside, one record map backs it. */
import { vi } from "vitest";

export function flakyIdb() {
  const records = new Map<string, unknown>();
  const control = { opens: 0, failOpens: 0, throwOpens: 0, dbs: [] as Record<string, any>[] };
  const makeDb = () => {
    const db: Record<string, any> = {
      close: vi.fn(),
      transaction() {
        const tx: Record<string, any> = { error: null };
        tx.objectStore = () => ({
          get(key: string) {
            const request: Record<string, any> = { result: records.get(key) };
            setTimeout(() => {
              request.onsuccess?.();
              tx.oncomplete?.();
            }, 0);
            return request;
          },
        });
        return tx;
      },
    };
    return db;
  };
  const factory = {
    open() {
      control.opens++;
      if (control.throwOpens > 0) {
        control.throwOpens--;
        throw new Error("SecurityError");
      }
      const request: Record<string, any> = { result: null, error: null };
      setTimeout(() => {
        if (control.failOpens > 0) {
          control.failOpens--;
          request.error = new Error("open failed");
          request.onerror?.();
          return;
        }
        request.result = makeDb();
        control.dbs.push(request.result);
        request.onsuccess?.();
      }, 0);
      return request;
    },
  };
  return { factory, records, control };
}
