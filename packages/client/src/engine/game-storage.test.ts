/**
 * One contract, two storages. The in-memory storage is what Vitest and the
 * in-thread host use, so it has to behave exactly like IndexedDB does — and the
 * only way to know that is to run the same cases against both.
 */

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, test } from "vitest";
import type { Command } from "@mc/engine";
import { EngineSessionCore } from "./session-core.js";
import type { SessionConfig } from "./host.js";
import { MemoryGameStorage, SAVE_SCHEMA, type GameStorage, type SaveMeta } from "./game-storage.js";
import { IdbGameStorage } from "./idb-game-storage.js";

const CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 43523,
};

/** A real replay baseline, so the round trip proves an actual engine state survives the copy. */
const BASELINE = (await new EngineSessionCore().start(CONFIG)).snapshot.state;

const meta = (id: string, updatedAt: number, overrides: Partial<SaveMeta> = {}): SaveMeta => ({
  id,
  schema: SAVE_SCHEMA,
  config: CONFIG,
  createdAt: updatedAt,
  updatedAt,
  status: "active",
  round: 1,
  commandCount: 0,
  outcome: null,
  ...overrides,
});

const command = (n: number): Command => ({ type: "endTurn", playerId: `p${n}` }) as unknown as Command;

describe.each<[string, () => GameStorage]>([
  ["memory", () => new MemoryGameStorage()],
  ["IndexedDB", () => new IdbGameStorage(new IDBFactory())],
])("%s game storage", (_name, make) => {
  test("a created game round-trips its config, baseline and commands in order", async () => {
    const storage = make();
    await storage.create(meta("g1", 1), BASELINE);
    await storage.append("g1", 0, command(0), { round: 1, commandCount: 1, updatedAt: 2, status: "active", outcome: null });
    await storage.append("g1", 1, command(1), { round: 2, commandCount: 2, updatedAt: 3, status: "active", outcome: null });

    const loaded = await storage.load("g1");
    expect(loaded).not.toBeNull();
    expect(loaded!.meta.config).toEqual(CONFIG);
    expect(loaded!.meta.round).toBe(2);
    expect(loaded!.meta.commandCount).toBe(2);
    expect(loaded!.initialState).toEqual(BASELINE);
    expect(loaded!.commands).toEqual([command(0), command(1)]);
  });

  test("an out-of-order command is rejected and leaves the log untouched", async () => {
    const storage = make();
    await storage.create(meta("g1", 1), BASELINE);
    await expect(
      storage.append("g1", 1, command(1), { round: 1, commandCount: 2, updatedAt: 2, status: "active", outcome: null }),
    ).rejects.toThrow(/out of order/);
    expect((await storage.load("g1"))!.commands).toEqual([]);
  });

  test("starting a new game retires the one in progress, and Continue offers the new one", async () => {
    const storage = make();
    await storage.create(meta("old", 1), BASELINE);
    await storage.create(meta("new", 5), BASELINE);

    expect((await storage.latestActive())?.id).toBe("new");
    const statuses = Object.fromEntries((await storage.list()).map((game) => [game.id, game.status]));
    expect(statuses).toEqual({ old: "abandoned", new: "active" });
  });

  test("a finished or incompatible game is never offered as Continue", async () => {
    const storage = make();
    await storage.create(meta("g1", 1), BASELINE);
    await storage.setStatus("g1", "incompatible");
    expect(await storage.latestActive()).toBeNull();
  });

  test("a save from an older schema is retired, not resumed (the several-villains state change)", async () => {
    const storage = make();
    // A game saved before the multi-villain state shape (docs/phase7-wave1.md §3.1–§3.2) landed.
    await storage.create(meta("old-shape", 1, { schema: SAVE_SCHEMA - 1 }), BASELINE);
    const core = new EngineSessionCore({ storage });

    // Never offered as Continue, and marked incompatible on the way, deliberately rather than by a failed replay.
    expect(await core.latestSave()).toBeNull();
    expect((await storage.list()).find((game) => game.id === "old-shape")?.status).toBe("incompatible");

    // Asking for it by id refuses too: no replay is attempted against a state shape this engine no longer has.
    await storage.setStatus("old-shape", "active");
    await expect(core.resume("old-shape")).rejects.toThrow(/older version/);
    expect((await storage.list()).find((game) => game.id === "old-shape")?.status).toBe("incompatible");
  });

  test("an older save behind the newest current one is left alone, and the current one is still offered", async () => {
    const storage = make();
    await storage.create(meta("current", 5), BASELINE);
    const core = new EngineSessionCore({ storage });
    expect((await core.latestSave())?.id).toBe("current");
  });

  test("games list most recently played first", async () => {
    const storage = make();
    await storage.create(meta("a", 1), BASELINE);
    await storage.create(meta("b", 2), BASELINE);
    await storage.append("a", 0, command(0), { round: 1, commandCount: 1, updatedAt: 9, status: "abandoned", outcome: null });
    expect((await storage.list()).map((game) => game.id)).toEqual(["a", "b"]);
  });

  test("what comes back is a copy: changing it doesn't change the stored game", async () => {
    const storage = make();
    await storage.create(meta("g1", 1), BASELINE);
    const first = await storage.load("g1");
    (first!.commands as Command[]).push(command(9));
    expect((await storage.load("g1"))!.commands).toEqual([]);
  });

  test("an unknown game loads as null", async () => {
    expect(await make().load("missing")).toBeNull();
  });
});
