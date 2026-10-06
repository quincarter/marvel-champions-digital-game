import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, test } from "vitest";
import { IdbDeckStorage } from "../engine/idb-deck-storage.js";
import { exportSaveData, importSaveData, type KeyValueStorage } from "./save-data.js";
import { SettingsStore } from "../settings-store.js";
import { parseSaveFile, SAVE_FILE_VERSION } from "./save-file.js";

class MapStorage implements KeyValueStorage {
  readonly map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

const deck = (id: string) => ({ id, name: `Deck ${id}`, heroId: "spider-man", cards: [] }) as never;

describe("exportSaveData / importSaveData", () => {
  test("a file exported on one device restores the same data on another, replacing what was there", async () => {
    const fromDb = new IDBFactory();
    const fromStorage = new MapStorage();
    await new IdbDeckStorage(fromDb).put(deck("a"));
    await new IdbDeckStorage(fromDb).put(deck("b"));
    fromStorage.setItem("mc-unlocks", '{"version":2}');
    fromStorage.setItem("mc-guide", '{"level":"off"}');
    fromStorage.setItem("mc-settings", '{"version":1,"sound":false}');
    fromStorage.setItem("someone-else", "not ours");

    const file = await exportSaveData({ indexedDB: fromDb, localStorage: fromStorage, now: () => 1234 });
    expect(file.version).toBe(SAVE_FILE_VERSION);
    expect(file.exportedAt).toBe(1234);
    expect(file.databases["mc-decks"]?.stores["decks"]).toHaveLength(2);
    expect(file.databases["mc-saves"]?.stores["games"]).toEqual([]);
    expect(file.localStorage).toEqual({
      "mc-guide": '{"level":"off"}',
      "mc-settings": '{"version":1,"sound":false}',
      "mc-unlocks": '{"version":2}',
    });

    // Through JSON and the parser, as a real import would.
    const parsed = parseSaveFile(JSON.stringify(file));
    if (!parsed.ok) throw new Error(parsed.error);

    const toDb = new IDBFactory();
    const toStorage = new MapStorage();
    await new IdbDeckStorage(toDb).put(deck("stale"));
    toStorage.setItem("mc-deck-freeze-optin:run:0", "1");
    toStorage.setItem("unrelated", "kept");

    await importSaveData(parsed.file, { indexedDB: toDb, localStorage: toStorage });

    const decks = await new IdbDeckStorage(toDb).list();
    expect(decks.map((d) => d.id).sort()).toEqual(["a", "b"]);
    expect(Object.fromEntries(toStorage.map)).toEqual({
      unrelated: "kept",
      "mc-guide": '{"level":"off"}',
      "mc-settings": '{"version":1,"sound":false}',
      "mc-unlocks": '{"version":2}',
    });
    // A fresh launch on the importing device (the app reloads after an import) reads the settings back.
    expect(new SettingsStore(toStorage).current.sound).toBe(false);
  });

  test("a storage class with a connection already open reads the imported data", async () => {
    const db = new IDBFactory();
    const decks = new IdbDeckStorage(db);
    await decks.put(deck("old"));
    const file = await exportSaveData({ indexedDB: new IDBFactory(), localStorage: null });
    await importSaveData(file, { indexedDB: db, localStorage: null });
    expect(await decks.list()).toEqual([]);
  });

  test("without localStorage only the databases travel", async () => {
    const file = await exportSaveData({ indexedDB: new IDBFactory(), localStorage: null });
    expect(file.localStorage).toEqual({});
  });
});
