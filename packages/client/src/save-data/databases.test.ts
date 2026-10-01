import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, test } from "vitest";
import { IdbCampaignStorage } from "../engine/idb-campaign-storage.js";
import { IdbDeckStorage } from "../engine/idb-deck-storage.js";
import { IdbGameStorage } from "../engine/idb-game-storage.js";
import { SAVED_DATABASES } from "./databases.js";

/** Opens `name` as-is (no version, so no upgrade) and reads its schema back. */
function schemaOf(factory: IDBFactory, name: string): Promise<{ version: number; stores: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name);
    request.onsuccess = () => {
      const db = request.result;
      const names = [...db.objectStoreNames];
      const transaction = db.transaction(names, "readonly");
      const stores = Object.fromEntries(names.map((store) => [store, transaction.objectStore(store).keyPath]));
      db.close();
      resolve({ version: db.version, stores });
    };
    request.onerror = () => reject(request.error);
  });
}

describe("SAVED_DATABASES", () => {
  test("matches the schema each storage class actually creates", async () => {
    const factory = new IDBFactory();
    // Any read opens (and so creates) the class's database.
    await new IdbGameStorage(factory).list();
    await new IdbDeckStorage(factory).list();
    await new IdbCampaignStorage(factory).list();

    const created = await factory.databases();
    expect(created.map((db) => db.name).sort()).toEqual(SAVED_DATABASES.map((db) => db.name).sort());
    for (const spec of SAVED_DATABASES) {
      const schema = await schemaOf(factory, spec.name);
      expect(schema.version, spec.name).toBe(spec.version);
      expect(schema.stores, spec.name).toEqual(Object.fromEntries(spec.stores.map((s) => [s.name, s.keyPath])));
    }
  });
});
