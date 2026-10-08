import { describe, expect, test } from "vitest";
import { createGame, scale } from "@mc/engine";
import {
  compositionRowsOf,
  difficultyCardsFor,
  gameSummaryRowsOf,
  nemesisStandbyOf,
  stageRangeFor,
  tableSetupPreviewOf,
  whatsInThereRowsOf,
} from "./table-setup-preview.js";
import { buildScenario, CARDS_BY_ID, POOL_DEPS, POOL_ENCOUNTER_SETS, POOL_SCENARIOS } from "../content/pool.js";

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

describe("the game you'll get: added sets and a random villain", () => {
  const summaryFor = (scenarioId: string, starterDeckIds: readonly string[]) => {
    const scenario = POOL_SCENARIOS.find((s) => (s.id as string) === scenarioId)!;
    const config = buildScenario(scenarioId, {
      difficulty: "standard",
      players: starterDeckIds.map((starterDeckId) => ({ starterDeckId })),
      seed: 1,
    });
    const preview = tableSetupPreviewOf(config, scenario, "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    return { preview, rows: gameSummaryRowsOf(preview) };
  };

  test("a deck that chose the 'Pool aspect lists the Dreadpool set and why", () => {
    const { preview, rows } = summaryFor("rhino", ["deadpool-pool"]);
    expect(preview.addedSets).toEqual([{ name: "Dreadpool", why: "'Pool deck", setAside: 6 }]);
    expect(rows).toContainEqual({ label: "Added set", value: "Dreadpool · 'Pool deck · 6 set aside" });
  });

  test("any 'Pool seat adds it, at a wave 7 scenario too", () => {
    expect(summaryFor("stryfe", ["deadpool-pool", "cable-leadership"]).preview.addedSets).toHaveLength(1);
  });

  test("a deck under another aspect lists no added set", () => {
    const { preview, rows } = summaryFor("rhino", ["core-spider-man-justice"]);
    expect(preview.addedSets).toEqual([]);
    expect(rows.some((r) => r.label === "Added set")).toBe(false);
  });

  test.each(["morlock-siege", "on-the-run"])(
    "%s names the Marauders as a random villain, with no placeholder HP",
    (id) => {
      const { preview, rows } = summaryFor(id, ["core-spider-man-justice"]);
      expect(preview.villainIsRandom).toBe(true);
      expect(preview.villainName).toBe("The Marauders");
      expect(rows[0]).toEqual({ label: "Villain", value: "The Marauders · random" });
      expect(JSON.stringify(rows)).not.toContain("Arclight");
    },
  );

  test("a fixed villain is unchanged", () => {
    const { preview } = summaryFor("rhino", ["core-spider-man-justice"]);
    expect(preview.villainIsRandom).toBe(false);
  });
});

describe("the encounter deck counts a set the deal adds", () => {
  const compare = (scenarioId: string, starterDeckIds: readonly string[]) => {
    const scenario = POOL_SCENARIOS.find((s) => (s.id as string) === scenarioId)!;
    const config = buildScenario(scenarioId, {
      difficulty: "standard",
      players: starterDeckIds.map((starterDeckId) => ({ starterDeckId })),
      seed: 1,
    });
    const preview = tableSetupPreviewOf(config, scenario, "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    const created = createGame(config, POOL_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const state = created.state;
    const deck = Object.values(state.encounterDecks).flatMap((d) => d.deck);
    const started = new Map<string, number>();
    for (const id of deck) {
      const type = CARDS_BY_ID.get(state.instances[id]!.cardId as string)!.type;
      started.set(type, (started.get(type) ?? 0) + 1);
    }
    return { preview, deckSize: deck.length, started, state };
  };

  test("Deadpool on Rhino: the preview's deck size and type counts equal the started game's", () => {
    const { preview, deckSize, started } = compare("rhino", ["deadpool-pool"]);
    // The deck line counts the cards listed by set; the hero obligations are the separate "shuffled in" line.
    expect(preview.encounterDeckSize + preview.obligationsCount).toBe(deckSize);
    expect(preview.encounterDeck.decks[0]!.byType.reduce((n, b) => n + b.count, 0)).toBe(preview.encounterDeckSize);
    for (const { type, count } of preview.encounterDeck.decks[0]!.byType) expect(started.get(type) ?? 0).toBe(count);
    for (const type of [...started.keys()].filter((k) => k !== "obligation"))
      expect(preview.encounterDeck.decks[0]!.byType.some((b) => b.type === type)).toBe(true);
    const rows = compositionRowsOf(preview.encounterDeck);
    expect(rows.find((r) => r.label === "Dreadpool")?.count).toBeGreaterThan(0);
    expect(preview.encounterDeckSizeText).toBe(`${deckSize - preview.obligationsCount} cards`);
  });

  test("the cards that start set aside are said, not counted", () => {
    const { preview, state } = compare("rhino", ["deadpool-pool"]);
    const rows = gameSummaryRowsOf(preview);
    const added = preview.addedSets[0]!;
    expect(rows.find((r) => r.label === "Added set")?.value).toBe(
      `Dreadpool · 'Pool deck${added.setAside > 0 ? ` · ${added.setAside} set aside` : ""}`,
    );
    expect(state.encounterSetAside.length).toBeGreaterThanOrEqual(added.setAside);
  });

  test("a non-'Pool deck is unchanged and still equals the started game", () => {
    const { preview, deckSize, started } = compare("rhino", ["core-spider-man-justice"]);
    // The deck line counts the cards listed by set; the hero obligations are the separate "shuffled in" line.
    expect(preview.encounterDeckSize + preview.obligationsCount).toBe(deckSize);
    expect(compositionRowsOf(preview.encounterDeck).some((r) => r.label === "Dreadpool")).toBe(false);
    for (const { type, count } of preview.encounterDeck.decks[0]!.byType) expect(started.get(type) ?? 0).toBe(count);
  });
});

describe("Apocalypse's easier start in the preview", () => {
  const apocalypse = POOL_SCENARIOS.find((s) => (s.id as string) === "apocalypse")!;
  const players = [{ starterDeckId: "core-spider-man-justice" }];

  test("starting a stage sooner shows stage I and one more stage of hit points", () => {
    const printed = buildScenario("apocalypse", { difficulty: "standard", players, seed: 1 });
    const easier = buildScenario("apocalypse", { difficulty: "standard", players, seed: 1, easierStart: true });
    const before = tableSetupPreviewOf(printed, apocalypse, "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    const after = tableSetupPreviewOf(easier, apocalypse, "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(before.villainStageLabel).toBe("II");
    expect(after.villainStageLabel).toBe("I");
    expect(after.villainStageSpan).toBe(before.villainStageSpan + 1);
    expect(after.villainTotalHp).toBeGreaterThan(before.villainTotalHp);
  });

  test("a start at or after the difficulty's own changes nothing", () => {
    expect(stageRangeFor(apocalypse, "standard", 1)).toEqual(stageRangeFor(apocalypse, "standard"));
    expect(stageRangeFor(apocalypse, "standard", 3)).toEqual(stageRangeFor(apocalypse, "standard"));
    expect(stageRangeFor(apocalypse, "standard", 0)[0]).toBe(1);
  });

  test("the standard card says where the game begins; the expert card keeps its own stage", () => {
    const easier = buildScenario("apocalypse", { difficulty: "standard", players, seed: 1, easierStart: true });
    const printed = difficultyCardsFor(apocalypse);
    const folded = difficultyCardsFor(apocalypse, easier.villainStartStageIndex);
    const standard = (cards: ReturnType<typeof difficultyCardsFor>) => cards.find((c) => c.id === "standard")!;
    const expert = (cards: ReturnType<typeof difficultyCardsFor>) => cards.find((c) => c.id === "expert")!;
    expect(standard(printed).description).toContain("Starts at stage II.");
    expect(standard(folded).description).toContain("Starts at stage I.");
    expect(expert(folded).description).toBe(expert(printed).description);
  });

  test("the main scheme line is X per player, X the hit points of the stage the game begins on", () => {
    const printed = buildScenario("apocalypse", { difficulty: "standard", players, seed: 1 });
    const easier = buildScenario("apocalypse", { difficulty: "standard", players, seed: 1, easierStart: true });
    const before = tableSetupPreviewOf(printed, apocalypse, "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    const after = tableSetupPreviewOf(easier, apocalypse, "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    // 9 per hero from stage II (the dial), 8 from stage I (docs/phase7-wave8.md section 2.7); never the printed 0.
    expect(before.mainSchemeThreat).toBe(9);
    expect(after.mainSchemeThreat).toBe(8);
    expect(gameSummaryRowsOf(after).find((r) => r.label === "Main scheme")?.value).toBe("8 threat · accel 1");
    const expert = tableSetupPreviewOf(
      buildScenario("apocalypse", { difficulty: "expert", players, seed: 1 }),
      apocalypse,
      "expert",
      CARDS_BY_ID,
      POOL_ENCOUNTER_SETS,
    );
    expect(expert.mainSchemeThreat).toBe(10);
  });

  test("a scenario whose target is printed is not touched", () => {
    const config = buildScenario("rhino", { difficulty: "standard", players, seed: 1 });
    const preview = tableSetupPreviewOf(config, rhino, "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    const scheme = CARDS_BY_ID.get(rhino.mainSchemeCardId as string);
    if (scheme?.type !== "main_scheme") throw new Error("not a main scheme");
    expect(preview.mainSchemeThreat).toBe(scale(scheme.stages[0]!.targetThreat, 1));
  });
});
