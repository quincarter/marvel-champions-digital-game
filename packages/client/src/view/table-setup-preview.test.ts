import { describe, expect, test } from "vitest";
import { scale } from "@mc/engine";
import {
  compositionRowsOf,
  difficultyCardsFor,
  gameSummaryRowsOf,
  nemesisStandbyOf,
  stageRangeFor,
  tableSetupPreviewOf,
  whatsInThereRowsOf,
} from "./table-setup-preview.js";
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
    const config = buildScenario("rhino", {
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 1,
    });
    const villain = CARDS_BY_ID.get(rhino.villainCardId as string)!;
    if (villain.type !== "villain") throw new Error("not a villain");
    const side = villain.sides[0]!;
    const [lo, hi] = stageRangeFor(rhino, "standard");
    const expected = side.stages
      .filter((s) => s.stageNumber >= lo && s.stageNumber <= hi)
      .reduce((sum, s) => sum + scale(s.hp, 1), 0);
    const preview = tableSetupPreviewOf(config, rhino, "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(preview.villainTotalHp).toBe(expected);
  });

  test("Breakout sums HP across all four villains", () => {
    const config = buildScenario("breakout", {
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 1,
    });
    const preview = tableSetupPreviewOf(config, breakout, "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(preview.obligationsCount).toBe(0); // Wrecking Crew: no obligations
    expect(preview.villainTotalHp).toBeGreaterThan(0);
  });
});

describe("compositionRowsOf / whatsInThereRowsOf / nemesisStandbyOf", () => {
  const config = buildScenario("rhino", {
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
  });
  const preview = tableSetupPreviewOf(config, rhino, "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);

  test("composition rows sum to the deck total, plus a red obligations row at the end", () => {
    const rows = compositionRowsOf(preview.encounterDeck);
    const last = rows[rows.length - 1]!;
    expect(last.label).toBe("Obligations (shuffled in)");
    expect(last.red).toBe(true);
    expect(last.count).toBe(preview.obligationsCount);
    const setRows = rows.slice(0, -1);
    expect(setRows.every((row) => !row.red)).toBe(true);
    expect(setRows.reduce((sum, row) => sum + row.count, 0)).toBe(preview.encounterDeckSize);
  });

  test("what's-in-there rows are Minions/Side schemes/Treacheries/Attachments/Surge cards, in that order, real counts", () => {
    const rows = whatsInThereRowsOf(preview.encounterDeck);
    expect(rows.map((r) => r.label)).toEqual(["Minions", "Side schemes", "Treacheries", "Attachments", "Surge cards"]);
    for (const row of rows) expect(row.count).toBeGreaterThanOrEqual(0);
  });

  test("nemesis standby names the real hero and totals a positive card count", () => {
    const standby = nemesisStandbyOf(preview.encounterDeck);
    expect(standby).not.toBeNull();
    expect(standby!.sentence).toContain("Spider-Man");
    expect(standby!.totalCards).toBeGreaterThan(0);
  });

  test("Breakout uses no identity sets, so there's nothing held back", () => {
    const breakoutConfig = buildScenario("breakout", {
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 1,
    });
    const breakoutPreview = tableSetupPreviewOf(breakoutConfig, breakout, "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(nemesisStandbyOf(breakoutPreview.encounterDeck)).toBeNull();
  });
});

describe("gameSummaryRowsOf", () => {
  test("names every headline number, single-villain scenario", () => {
    const config = buildScenario("rhino", {
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 1,
    });
    const preview = tableSetupPreviewOf(config, rhino, "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    const rows = gameSummaryRowsOf(preview);
    expect(rows).toHaveLength(6);
    const joined = rows.map((r) => `${r.label} ${r.value}`).join(" ");
    expect(joined).toContain("Rhino");
    expect(joined).toContain(`${preview.villainTotalHp}`);
    expect(joined).not.toContain("HP total");
    expect(joined).toContain(preview.villainStageSpan > 1 ? "HP across" : `${preview.villainTotalHp} HP`);
    expect(joined).toContain(`${preview.startingThreat}`);
    expect(joined).toContain(`${preview.startingThreatPerPlayer} / player`);
    expect(joined).toContain(`${preview.encounterDeckSize} cards`);
    expect(joined).toContain(`${preview.obligationsCount} shuffled in`);
    expect(joined).toContain("1"); // one hero seated
  });

  test("adds a short Table rule row only when the same-name rule is on", () => {
    const config = buildScenario("rhino", {
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 1,
    });
    const preview = tableSetupPreviewOf(config, rhino, "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(gameSummaryRowsOf(preview).some((r) => r.label === "Table rule")).toBe(false);
    expect(gameSummaryRowsOf(preview, {}).some((r) => r.label === "Table rule")).toBe(false);
    const rows = gameSummaryRowsOf(preview, { sameNameHeroAllyConflict: true });
    expect(rows).toHaveLength(7);
    expect(rows.at(-1)).toEqual({ label: "Table rule", value: "Hero and ally of one name" });
  });

  test("multi-villain scenario names the count, not a single villain's name", () => {
    const config = buildScenario("breakout", {
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 1,
    });
    const preview = tableSetupPreviewOf(config, breakout, "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    const villainRow = gameSummaryRowsOf(preview).find((r) => r.label === "Villain")!;
    expect(villainRow.value).toContain("4 villains");
  });
});

describe("difficultyCardsFor", () => {
  test("Rhino offers Standard and Expert only — Heroic stays out of scope", () => {
    const cards = difficultyCardsFor(rhino);
    expect(cards.map((c) => c.id)).toEqual(["standard", "expert"]);
    expect(cards.map((c) => c.name)).toEqual(["Standard", "Expert"]);
    for (const card of cards) expect(card.description.length).toBeGreaterThan(0);
  });

  test("each description names the real starting stage for that difficulty", () => {
    const cards = difficultyCardsFor(rhino);
    const standard = cards.find((c) => c.id === "standard")!;
    const expert = cards.find((c) => c.id === "expert")!;
    expect(standard.description).toContain(`stage ${"I"}`);
    expect(expert.description).toContain(`stage ${"II"}`);
  });

  test("Breakout offers Extreme too", () => {
    expect(difficultyCardsFor(breakout).map((c) => c.id)).toEqual(["standard", "expert", "extreme"]);
  });
});

describe("tableSetupPreviewOf: the preview counts the deck the game deals, for every scenario shape", () => {
  const scenario = (id: string) => POOL_SCENARIOS.find((s) => (s.id as string) === id)!;
  const previewOf = (id: string) => {
    const config = buildScenario(id, {
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 1,
    });
    return { config, preview: tableSetupPreviewOf(config, scenario(id), "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS) };
  };

  test.each(["tower-defense", "sinister-six"])("%s: several villains over one shared deck count that deck", (id) => {
    const { config, preview } = previewOf(id);
    expect(config.sharedEncounterDeck).toBe(true);
    // Every villain's own list is empty; the deck is the shared one.
    expect(config.villains!.every((v) => v.encounterDeck.length === 0)).toBe(true);
    expect(preview.encounterDeckSize).toBe(config.encounterDeck.length);
    expect(preview.encounterDeckSize).toBeGreaterThan(0);
    expect(preview.encounterDeck.decks).toHaveLength(1);
    expect(compositionRowsOf(preview.encounterDeck).length).toBeGreaterThan(1);
    const types = whatsInThereRowsOf(preview.encounterDeck);
    expect(types.reduce((sum, row) => sum + (row.label === "Surge cards" ? 0 : row.count), 0)).toBeGreaterThan(0);
    expect(gameSummaryRowsOf(preview).find((row) => row.label === "Encounter deck")!.value).toContain(
      `${preview.encounterDeckSize}`,
    );
  });

  test.each(["rhino", "sabretooth", "magog", "breakout", "mojo"])(
    "%s: the preview's deck is the config's deck, never zero",
    (id) => {
      const { config, preview } = previewOf(id);
      const configured = config.villains
        ? config.villains.reduce((sum, v) => sum + v.encounterDeck.length, 0) + config.encounterDeck.length
        : config.encounterDeck.length;
      expect(preview.encounterDeckSize).toBe(configured);
      expect(preview.encounterDeckSize).toBeGreaterThan(0);
    },
  );

  test("MojoMania's named set-aside sets are the ones for this seed: the same on every rebuild, new only with a new seed", () => {
    const names = (seed: number) => {
      const config = buildScenario("mojo", {
        difficulty: "standard",
        players: [{ starterDeckId: "core-spider-man-justice" }],
        seed,
      });
      return tableSetupPreviewOf(config, scenario("mojo"), "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS)
        .setAsideSetNames;
    };
    expect(names(4974)).toEqual(names(4974));
    expect(names(4974)).toHaveLength(2);
  });
});
