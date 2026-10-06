import { describe, expect, test } from "vitest";
import { MemoryGameStorage, type SaveMeta, type SaveStatus } from "./game-storage.js";
import { lastFinishedResult, previousGameFacts } from "./previous-game-facts.js";

const save = (status: SaveStatus, updatedAt: number): SaveMeta =>
  ({
    id: `g${updatedAt}`,
    schema: 1,
    config: { scenarioId: "rhino", difficulty: "standard", players: [], seed: 1 },
    createdAt: updatedAt,
    updatedAt,
    status,
    round: 3,
    commandCount: 10,
    outcome: null,
    campaignId: null,
    campaignNodeId: null,
  }) as SaveMeta;

describe("previousGameFacts", () => {
  test("no history says nothing, so the engine's default (did not win) applies", () => {
    expect(lastFinishedResult([])).toBeNull();
    expect(previousGameFacts([], 1)).toBeNull();
  });

  test("the most recently finished game decides, whatever order the list is in", () => {
    expect(previousGameFacts([save("lost", 5), save("won", 9)], 1)).toEqual([{ wonPreviousGame: true }]);
    expect(previousGameFacts([save("won", 9), save("lost", 12)], 1)).toEqual([{ wonPreviousGame: false }]);
  });

  test("abandoned, in-progress and incompatible games do not count", () => {
    const saves = [save("won", 5), save("abandoned", 8), save("active", 9), save("incompatible", 10)];
    expect(lastFinishedResult(saves)).toBe("won");
    expect(previousGameFacts([save("abandoned", 8), save("active", 9)], 2)).toBeNull();
  });

  test("every local seat gets the profile's result", () => {
    expect(previousGameFacts([save("won", 1)], 3)).toEqual([
      { wonPreviousGame: true },
      { wonPreviousGame: true },
      { wonPreviousGame: true },
    ]);
  });
});

describe("the storage type this reads", () => {
  test("MemoryGameStorage lists what was created", async () => {
    expect(await new MemoryGameStorage().list()).toEqual([]);
  });
});
