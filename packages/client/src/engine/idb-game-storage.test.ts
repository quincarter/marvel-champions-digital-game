import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, test } from "vitest";
import { IdbGameStorage } from "./idb-game-storage.js";
import { MemoryGameStorage, SAVE_SCHEMA, type SaveMeta } from "./game-storage.js";

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

describe("replaceFinished (#909)", () => {
  const rowOf = (updatedAt: number, status: "won" | "lost") =>
    ({
      id: "g",
      schema: SAVE_SCHEMA,
      config: { scenarioId: "rhino" },
      createdAt: 1,
      updatedAt,
      status,
      round: 2,
      commandCount: 0,
      outcome: null,
      campaignId: null,
      campaignNodeId: null,
    }) as unknown as SaveMeta;
  const commands = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ type: "endTurn", playerId: `p${i}` }) as never);

  test("a shorter log leaves no old command rows, and the new baseline and stamp agree with the memory store", async () => {
    const idb = new IdbGameStorage(new IDBFactory(), { platform: "windows" });
    const memory = new MemoryGameStorage({ platform: "windows" });
    for (const storage of [idb, memory]) {
      await storage.createFinished(rowOf(10, "won"), { round: 1 } as never, commands(3));
      await storage.replaceFinished(rowOf(20, "lost"), { round: 2 } as never, commands(1));
    }
    const stored = await idb.load("g");
    expect(stored?.commands).toEqual(commands(1));
    expect(stored?.initialState).toEqual({ round: 2 });
    const [row] = await idb.list();
    expect(await idb.list()).toHaveLength(1);
    expect(row).toMatchObject({ status: "lost", updatedAt: 20, commandCount: 1 });
    expect(row).toEqual((await memory.list())[0]);
    expect((await memory.load("g"))?.commands).toEqual(stored?.commands);
  });

  test("a game that is not stored is written as a new one", async () => {
    const idb = new IdbGameStorage(new IDBFactory());
    await idb.replaceFinished(rowOf(5, "won"), {} as never, commands(2));
    expect((await idb.load("g"))?.commands).toHaveLength(2);
  });
});
