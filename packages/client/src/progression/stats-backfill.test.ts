import { describe, expect, test } from "vitest";
import { SAVE_SCHEMA, type SaveMeta } from "../engine/game-storage.js";
import { backfillProgress, onBackfillProgress, runStatsBackfill, type BackfillProgress } from "./stats-backfill.js";

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
