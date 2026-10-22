import { describe, expect, test } from "vitest";
import { SyncStatusStore, agoText, statusLine } from "./sync-status.js";

describe("statusLine", () => {
  const now = 1_000_000_000;
  test("says each state in plain words", () => {
    expect(statusLine({ state: "off", lastSyncedAt: null }, now)).toBe("Off");
    expect(statusLine({ state: "syncing", lastSyncedAt: null }, now)).toBe("Syncing…");
    expect(statusLine({ state: "synced", lastSyncedAt: now - 5_000 }, now)).toBe("Synced just now");
    expect(statusLine({ state: "synced", lastSyncedAt: now - 120_000 }, now)).toBe("Synced 2 min ago");
    expect(statusLine({ state: "pending", lastSyncedAt: now }, now)).toBe("Changes waiting to sync");
    expect(statusLine({ state: "offline", lastSyncedAt: now }, now)).toBe("Offline, changes waiting");
    expect(statusLine({ state: "error", lastSyncedAt: null, failure: { kind: "space-full" } }, now)).toBe(
      "Cloud space is full",
    );
    expect(statusLine({ state: "error", lastSyncedAt: null, failure: { kind: "not-found" } }, now)).toBe(
      "Cloud data not found",
    );
  });

  test("ago text rounds up through minutes, hours and days", () => {
    expect(agoText(0, 44_000)).toBe("just now");
    expect(agoText(0, 50_000)).toBe("1 min ago");
    expect(agoText(0, 3 * 3_600_000)).toBe("3 h ago");
    expect(agoText(0, 24 * 3_600_000)).toBe("1 day ago");
    expect(agoText(0, 5 * 24 * 3_600_000)).toBe("5 days ago");
    expect(agoText(10, 0)).toBe("just now");
  });
});

describe("SyncStatusStore", () => {
  test("tells subscribers at once and on change only", () => {
    const store = new SyncStatusStore();
    const seen: string[] = [];
    const stop = store.subscribe((s) => seen.push(s.state));
    store.set({ state: "syncing" });
    store.set({ state: "syncing" });
    store.set({ state: "synced", lastSyncedAt: 5 });
    stop();
    store.set({ state: "pending" });
    expect(seen).toEqual(["off", "syncing", "synced"]);
    expect(store.get().state).toBe("pending");
    expect(store.get().lastSyncedAt).toBe(5);
  });
});
