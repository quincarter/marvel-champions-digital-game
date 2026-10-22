import { describe, expect, test } from "vitest";
import { shadowlandFixtureState } from "./dev-shadowland-game.js";

describe("the shadowland dev fixture", () => {
  test("has a trap deck with its own discard, Creeping Corruption counters and both Streets Below in play", async () => {
    const { state } = await shadowlandFixtureState({ corruption: 4, traps: 5, flip: false });
    const trap = state.scenarioDecks["trap"]!;
    expect(trap.deck.length).toBeGreaterThan(0);
    expect(trap.discard).toHaveLength(2);
    const codes = Object.values(state.instances).map((i) => i.cardId as string);
    expect(codes.filter((c) => c === "65003a" || c === "65004a")).toHaveLength(2);
    const cc = Object.values(state.instances).find((i) => (i.cardId as string) === "65072a")!;
    expect(cc.counters["corruption"]).toBe(4);
    expect(state.villainArea.length).toBeGreaterThanOrEqual(2);
  });
});
