import { describe, expect, test } from "vitest";
import { scale } from "@mc/engine";
import { encounterDeckPreviewLines, gamePreviewLines, stageRangeFor, tableSetupPreviewOf } from "./table-setup-preview.js";
import { buildScenario, CARDS_BY_ID, POOL_ENCOUNTER_SETS, POOL_SCENARIOS } from "../content/pool.js";

const rhino = POOL_SCENARIOS.find((s) => (s.id as string) === "rhino")!;
const breakout = POOL_SCENARIOS.find((s) => (s.id as string) === "breakout")!;

describe("stageRangeFor", () => {
  test("standard/expert pass through Scenario.villainStages", () => {
    expect(stageRangeFor(rhino, "standard")).toEqual([1, 2]);
    expect(stageRangeFor(rhino, "expert")).toEqual([2, 3]);
  });

  test("extreme is the union of standard and expert (Breakout: A and B both)", () => {
    expect(stageRangeFor(breakout, "extreme")).toEqual([1, 2]);
  });
});

describe("tableSetupPreviewOf", () => {
  test("a single-villain scenario at standard, two players", () => {
    const config = buildScenario("rhino", {
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-she-hulk-aggression" }],
      seed: 1,
    });
    const preview = tableSetupPreviewOf(config, rhino, "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    const mainScheme = CARDS_BY_ID.get(rhino.mainSchemeCardId as string);
    if (mainScheme?.type !== "main_scheme") throw new Error("not a main scheme");
    expect(preview.playerCount).toBe(2);
    expect(preview.villainTotalHp).toBeGreaterThan(0);
    expect(preview.startingThreat).toBe(scale(mainScheme.stages[0]!.startingThreat, 2));
    expect(preview.encounterDeckSize).toBeGreaterThan(0);
    expect(preview.encounterDeckSize).toBe(preview.encounterDeck.decks.reduce((s, d) => s + d.totalCards, 0));
    expect(preview.obligationsCount).toBe(2);
  });

  test("villain total HP sums every stage in the difficulty's range", () => {
    const config = buildScenario("rhino", { difficulty: "standard", players: [{ starterDeckId: "core-spider-man-justice" }], seed: 1 });
    const villain = CARDS_BY_ID.get(rhino.villainCardId as string)!;
    if (villain.type !== "villain") throw new Error("not a villain");
    const side = villain.sides[0]!;
    const [lo, hi] = stageRangeFor(rhino, "standard");
    const expected = side.stages.filter((s) => s.stageNumber >= lo && s.stageNumber <= hi).reduce((sum, s) => sum + scale(s.hp, 1), 0);
    const preview = tableSetupPreviewOf(config, rhino, "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(preview.villainTotalHp).toBe(expected);
  });

  test("Breakout sums HP across all four villains", () => {
    const config = buildScenario("breakout", { difficulty: "standard", players: [{ starterDeckId: "core-spider-man-justice" }], seed: 1 });
    const preview = tableSetupPreviewOf(config, breakout, "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(preview.obligationsCount).toBe(0); // Wrecking Crew: no obligations
    expect(preview.villainTotalHp).toBeGreaterThan(0);
  });
});

describe("encounterDeckPreviewLines / gamePreviewLines", () => {
  test("one deck line plus one per set, for a single-villain scenario", () => {
    const config = buildScenario("rhino", { difficulty: "standard", players: [{ starterDeckId: "core-spider-man-justice" }], seed: 1 });
    const preview = tableSetupPreviewOf(config, rhino, "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    const lines = encounterDeckPreviewLines(preview.encounterDeck);
    expect(lines[0]).toContain(preview.encounterDeck.decks[0]!.villainName);
    expect(lines.length).toBeGreaterThan(1);
  });

  test("gamePreviewLines names every headline number", () => {
    const config = buildScenario("rhino", { difficulty: "standard", players: [{ starterDeckId: "core-spider-man-justice" }], seed: 1 });
    const preview = tableSetupPreviewOf(config, rhino, "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    const lines = gamePreviewLines(preview);
    expect(lines.join(" ")).toContain(`${preview.villainTotalHp}`);
    expect(lines.join(" ")).toContain(`${preview.startingThreat}`);
    expect(lines.length).toBe(5);
  });
});
