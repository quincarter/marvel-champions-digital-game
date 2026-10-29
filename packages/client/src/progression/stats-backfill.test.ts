import { describe, expect, test } from "vitest";
import { SAVE_SCHEMA, type SaveMeta } from "../engine/game-storage.js";
import {
  BACKFILL_SKIP_KEY,
  backfillProgress,
  onBackfillProgress,
  runStatsBackfill,
  type BackfillProgress,
} from "./stats-backfill.js";

const meta = (id: string, overrides: Partial<SaveMeta> = {}): SaveMeta => ({
  id,
  schema: SAVE_SCHEMA,
  config: { scenarioId: "rhino", difficulty: "standard", players: [], seed: 1 },
  createdAt: 1,
  updatedAt: 2,
  status: "won",
  round: 3,
  commandCount: 1,
  outcome: { result: "win", reason: "villainDefeated" },
  campaignId: null,
  campaignNodeId: null,
  ...overrides,
});

describe("runStatsBackfill", () => {
  test("asks for each game that needs it, one at a time, and reports how far it has got", async () => {
    const asked: string[][] = [];
    const seen: BackfillProgress[] = [];
    const off = onBackfillProgress((p) => seen.push(p));
    await runStatsBackfill({
      listSaves: async () => [meta("a"), meta("b", { status: "active" }), meta("c")],
      backfillSummaries: async (ids) => {
        asked.push([...(ids ?? [])]);
        return ids?.[0] === "a" ? 1 : 0;
      },
    });
    off();
    expect(asked).toEqual([["a"], ["c"]]);
    expect(seen.map((p) => [p.running, p.done, p.total])).toEqual([
      [true, 0, 2],
      [true, 1, 2],
      [true, 2, 2],
      [false, 2, 2],
    ]);
    expect(backfillProgress()).toMatchObject({ running: false, written: 1 });
  });

  test("nothing to fill in: no progress at all", async () => {
    const seen: BackfillProgress[] = [];
    const off = onBackfillProgress((p) => seen.push(p));
    await runStatsBackfill({ listSaves: async () => [], backfillSummaries: async () => 0 });
    off();
    expect(seen).toEqual([]);
  });
});

describe("runStatsBackfill: games it cannot fill in, and a game started meanwhile", () => {
  class MapStorage {
    readonly map = new Map<string, string>();
    getItem = (key: string) => this.map.get(key) ?? null;
    setItem = (key: string, value: string) => void this.map.set(key, value);
  }

  test("a game that did not fill in is not asked about again on this build", async () => {
    const storage = new MapStorage();
    const asked: string[] = [];
    const store = {
      listSaves: async () => [meta("a"), meta("b")],
      backfillSummaries: async (ids?: readonly string[]) => {
        asked.push(ids![0]!);
        return ids![0] === "a" ? 0 : 1;
      },
    };
    await runStatsBackfill(store, storage);
    await runStatsBackfill(store, storage);
    expect(asked).toEqual(["a", "b", "b"]);
  });

  test("a game being played stops the run, and nothing is remembered as failed", async () => {
    const storage = new MapStorage();
    const asked: string[] = [];
    await runStatsBackfill(
      {
        listSaves: async () => [meta("a"), meta("b")],
        backfillSummaries: async (ids) => {
          asked.push(ids![0]!);
          return -1;
        },
      },
      storage,
    );
    expect(asked).toEqual(["a"]);
    expect(backfillProgress()).toMatchObject({ running: false, done: 0 });
    expect(JSON.parse(storage.map.get(BACKFILL_SKIP_KEY)!).ids).toEqual([]);
  });
});
