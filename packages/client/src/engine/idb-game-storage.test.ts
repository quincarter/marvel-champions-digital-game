import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, test } from "vitest";
import { IdbGameStorage } from "./idb-game-storage.js";
import { SAVE_SCHEMA, type SaveMeta } from "./game-storage.js";

describe("IdbGameStorage.setSummary (#529)", () => {
  test("replaces the summary and the stamp, and keeps the status and the device it was played on", async () => {
    const factory = new IDBFactory();
    const meta = {
      id: "g",
      schema: SAVE_SCHEMA,
      config: { scenarioId: "rhino" },
      createdAt: 1,
      updatedAt: 100,
      status: "won",
      round: 4,
      commandCount: 0,
      outcome: { result: "win", reason: "villainDefeated" },
      campaignId: null,
      campaignNodeId: null,
    } as unknown as SaveMeta;
    await new IdbGameStorage(factory, { platform: "android" }).create(meta, {} as never);
    // Filled in on a PC: the stamp of where it was played stays the phone's.
    const pc = new IdbGameStorage(factory, { platform: "windows" });
    const summary = { lossReason: null, heroesDefeated: 0, winners: [], alliesPlayed: 0, seats: [] };
    expect(await pc.setSummary("g", summary, 101, 100)).toBe(true);
    const [row] = await pc.list();
    expect(row).toMatchObject({ status: "won", updatedAt: 101, summary, lastPlayedOn: { platform: "android" } });
    // A game that is not stored is left alone.
    expect(await pc.setSummary("missing", summary, 5, 4)).toBe(false);
    expect(await pc.list()).toHaveLength(1);
  });

  test("writes nothing when the row is no longer the revision the summary was made from", async () => {
    const factory = new IDBFactory();
    const storage = new IdbGameStorage(factory, { platform: "windows" });
    const meta = {
      id: "g",
      schema: SAVE_SCHEMA,
      config: { scenarioId: "rhino" },
      createdAt: 1,
      updatedAt: 100,
      status: "won",
      round: 4,
      commandCount: 0,
      campaignId: null,
      campaignNodeId: null,
    } as unknown as SaveMeta;
    await storage.create(meta, {} as never);
    // Sync (or play) wrote a newer revision after the backfill loaded stamp 100.
    await storage.setStatus("g", "won", 150);
    const summary = { lossReason: null, heroesDefeated: 0, winners: [], alliesPlayed: 0, seats: [] };
    expect(await storage.setSummary("g", summary, 101, 100)).toBe(false);
    const [row] = await storage.list();
    expect(row).toMatchObject({ updatedAt: 150 });
    expect(row!.summary).toBeUndefined();
  });
});
