import { describe, expect, test } from "vitest";
import { POOL_CARDS, POOL_ENCOUNTER_SETS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { rulesCardListOf } from "./rules-card-list.js";

describe("rulesCardListOf", () => {
  test("with no game, every set is inGame: false and populated from the static pool", () => {
    const groups = rulesCardListOf(null, POOL_CARDS, POOL_ENCOUNTER_SETS);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((g) => g.inGame === false)).toBe(true);
    const rhino = groups.find((g) => g.setId === "rhino");
    expect(rhino).toBeDefined();
    expect(rhino!.cards.some((c) => c.name === "Rhino")).toBe(true);
  });

  test("groups with no cards in the pool (e.g. a nemesis set never referenced) are dropped, not shown empty", () => {
    const groups = rulesCardListOf(null, [], POOL_ENCOUNTER_SETS);
    expect(groups).toEqual([]);
  });

  test("cards are deduplicated by id and sorted alphabetically within a group", () => {
    const groups = rulesCardListOf(null, POOL_CARDS, POOL_ENCOUNTER_SETS);
    for (const group of groups) {
      const ids = group.cards.map((c) => c.cardId);
      expect(new Set(ids).size).toBe(ids.length);
      const sorted = [...group.cards].sort((a, b) => a.name.localeCompare(b.name));
      expect(group.cards).toEqual(sorted);
    }
  });

  test("with a live game, the scenario's own sets are inGame: true and read from its own cardPool, sorted first", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 2026,
    });
    const state = store.state.game!;
    const groups = rulesCardListOf(state, POOL_CARDS, POOL_ENCOUNTER_SETS);
    const firstNotInGame = groups.findIndex((g) => !g.inGame);
    const lastInGame = groups.reduce((last, g, i) => (g.inGame ? i : last), -1);
    if (firstNotInGame >= 0 && lastInGame >= 0) expect(lastInGame).toBeLessThan(firstNotInGame);
    const inGameGroups = groups.filter((g) => g.inGame);
    expect(inGameGroups.length).toBeGreaterThan(0);
    for (const group of inGameGroups) {
      for (const card of group.cards) expect(state.cardPool[card.cardId]).toBeDefined();
    }
  });

  test("each sorted sub-list (in-game, then not-in-game) is itself alphabetical by set name", () => {
    const groups = rulesCardListOf(null, POOL_CARDS, POOL_ENCOUNTER_SETS);
    const names = groups.map((g) => g.setName);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });
});
