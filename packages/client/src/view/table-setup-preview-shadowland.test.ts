import { describe, expect, test } from "vitest";
import { SHADOWLAND_ENCOUNTER_SETS, SHADOWLAND_SCENARIOS } from "@mc/content";
import { playableStarterDeckSetup, wave11Scenario } from "@mc/cards";
import { CARDS_BY_ID, POOL_DEPS, POOL_ENCOUNTER_SETS } from "../content/pool.js";
import { compositionRowsOf, gameSummaryRowsOf, tableSetupPreviewOf } from "./table-setup-preview.js";

const SETS = [...POOL_ENCOUNTER_SETS, ...SHADOWLAND_ENCOUNTER_SETS];
// The config comes straight from the wave 11 builder.
const previewOf = (id: string) => {
  const record = SHADOWLAND_SCENARIOS.find((s) => s.id === id)!;
  const config = wave11Scenario(id, {
    difficulty: "standard",
    players: [playableStarterDeckSetup("core-spider-man-justice")],
    seed: 1,
  });
  return { config, preview: tableSetupPreviewOf(config, record, "standard", CARDS_BY_ID, SETS, POOL_DEPS) };
};

describe("Shadowland's setup preview", () => {
  test("the chosen villain's five linked cards are in the count and listed as linked", () => {
    const { config, preview } = previewOf("shadows-in-the-night");
    const rows = compositionRowsOf(preview.encounterDeck);
    expect(rows.find((r) => r.label === "Dark Protégé (linked)")?.count).toBe(5);
    expect(preview.encounterDeckSize).toBe(config.encounterDeck.length + 5);
  });

  test("Shadow Labyrinth shows the trap deck apart and its cards out of the encounter deck", () => {
    const { config, preview } = previewOf("shadow-labyrinth");
    expect(preview.scenarioDecks).toEqual([{ name: "trap", count: 8 }]);
    expect(preview.encounterDeckSize).toBe(config.encounterDeck.length + 5 - 8);
    const rows = compositionRowsOf(preview.encounterDeck);
    expect(rows.find((r) => r.label === "Trap deck (set apart)")?.count).toBe(8);
    expect(rows.find((r) => r.label === "Deadly Contraptions")?.count).toBe(11 - 7);
    expect(gameSummaryRowsOf(preview).find((r) => r.label === "Trap deck")?.value).toBe("8 cards");
  });

  test("Shifting Corridors' infinite hit points and the dashed threshold read as infinity", () => {
    const { preview } = previewOf("shadow-labyrinth");
    expect(preview.villainHpInfinite).toBe(true);
    expect(preview.mainSchemeThreatInfinite).toBe(true);
    const rows = gameSummaryRowsOf(preview);
    expect(rows[0]!.value).toContain("∞ HP");
    expect(rows.find((r) => r.label === "Main scheme")!.value).toMatch(/^∞ threat/);
  });

  test("a finite scenario is unchanged", () => {
    const { preview } = previewOf("heart-of-shadow");
    expect(preview.villainHpInfinite).toBe(false);
    expect(preview.scenarioDecks).toEqual([]);
  });
});
