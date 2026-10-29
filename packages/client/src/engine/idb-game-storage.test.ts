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
    await pc.setSummary("g", summary, 101);
    const [row] = await pc.list();
    expect(row).toMatchObject({ status: "won", updatedAt: 101, summary, lastPlayedOn: { platform: "android" } });
    // A game that is not stored is left alone.
    await pc.setSummary("missing", summary, 5);
    expect(await pc.list()).toHaveLength(1);
  });
});
