import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, test } from "vitest";
import { SAVED_DATABASES } from "../save-data/databases.js";
import { IdbSyncStateStore, SYNC_STATE_DB } from "./sync-state.js";
import type { SyncedEntry } from "./sync-types.js";

const entry = (key: string, version: number): SyncedEntry => ({
  key,
  recordKey: `hmac-${key}`,
  version,
  hash: "h",
  stamp: 5,
  deleted: false,
});

describe("IdbSyncStateStore", () => {
  test("its database never travels in an export or a sync", () => {
    expect(SYNC_STATE_DB.startsWith("mc-")).toBe(false);
    expect(SAVED_DATABASES.map((d) => d.name)).not.toContain(SYNC_STATE_DB);
  });

  test("starts empty, keeps meta and entries, and clears", async () => {
    const store = new IdbSyncStateStore(new IDBFactory());
    expect(await store.meta()).toEqual({ cursor: 0, lastSyncedAt: null, spaceId: null, epoch: null });
    expect((await store.entries()).size).toBe(0);

    await store.setMeta({ cursor: 7, lastSyncedAt: 99, spaceId: "space", epoch: 3 });
    await store.putEntries([entry("a", 1), entry("b", 2)]);
    await store.putEntries([{ ...entry("a", 3), deleted: true }]);
    await store.putEntries([]);
    expect(await store.meta()).toEqual({ cursor: 7, lastSyncedAt: 99, spaceId: "space", epoch: 3 });
    const entries = await store.entries();
    expect([...entries.keys()].sort()).toEqual(["a", "b"]);
    expect(entries.get("a")).toMatchObject({ version: 3, deleted: true });

    await store.clear();
    expect(await store.meta()).toEqual({ cursor: 0, lastSyncedAt: null, spaceId: null, epoch: null });
    expect((await store.entries()).size).toBe(0);
  });

  test("survives a new instance on the same database", async () => {
    const factory = new IDBFactory();
    await new IdbSyncStateStore(factory).setMeta({ cursor: 1, lastSyncedAt: null, spaceId: "s", epoch: null });
    expect((await new IdbSyncStateStore(factory).meta()).spaceId).toBe("s");
  });
});
