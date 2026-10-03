/**
 * MojoMania through the exact path Table setup's Deal it out takes: draft -> `toSessionConfig` -> session start, then
 * the game's own state. Mojo's 1B (39025b) When Revealed brings one set-aside set in during setup (reveals its SHOW
 * environment, shuffles the rest into the deck), so right after setup 1 + n - 1 sets are still set aside.
 */
import { describe, expect, test } from "vitest";
import { setAsideModularSetCountFor, type AnyCard } from "@mc/content";
import { locateCard, type GameState, type InstanceId } from "@mc/engine";
import { CARDS_BY_ID, POOL_ENCOUNTER_SETS, POOL_SCENARIOS } from "../content/pool.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { gameSummaryRowsOf, tableSetupPreviewOf } from "./table-setup-preview.js";
import { initialSetupDraft, toSessionConfig } from "./setup-draft.js";
import { buildScenario } from "../content/pool.js";
import { modularHeaderRightLabel, modularPicksAreSetAside, pooledModularSummary } from "./modular-summary.js";
import { encounterSetsCellText, scenarioDetailLines, scenarioDetailOf, shelfSubtitleOf } from "./scenario-detail.js";

const GENRES = ["crime", "fantasy", "horror", "sci-fi", "sitcom", "western"];
const HEROES = ["core-spider-man-justice", "core-she-hulk-aggression"];
const scenarioOf = (id: string) => POOL_SCENARIOS.find((s) => (s.id as string) === id)!;
const playersOf = (n: number) => HEROES.slice(0, n).map((starterDeckId) => ({ starterDeckId }));

async function dealItOut(id: string, n: number, seed = 4974) {
  const draft = initialSetupDraft({ scenarioId: id, seatDeckId: "precon:cap-leadership", seed });
  const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
  const { snapshot } = await core.start(toSessionConfig(draft, playersOf(n), scenarioOf(id)));
  const state = snapshot.state as GameState;
  const setOf = (instanceId: InstanceId) => {
    const card = CARDS_BY_ID.get(state.instances[instanceId]!.cardId as string) as AnyCard | undefined;
    return card && "encounterSetIds" in card ? (card.encounterSetIds as readonly string[]) : [];
  };
  const inZone = (kind: string) =>
    Object.keys(state.instances).filter((iid) => locateCard(state, iid as InstanceId)?.kind === kind);
  const deckGenres = (ids: readonly string[]) =>
    GENRES.filter((g) => ids.some((iid) => setOf(iid as InstanceId).includes(g)));
  return {
    state,
    setAside: (state.setAsideModularSets ?? []).map((s) => s.encounterSetId),
    deckGenres: deckGenres(inZone("encounterDeck")),
    inPlayGenres: deckGenres(inZone("villainArea")),
  };
}

describe("Deal it out on MojoMania", () => {
  test.each([1, 2])("Mojo with %i player(s): 1 + n sets set aside, 1B brings exactly one in", async (n) => {
    const { setAside, deckGenres, inPlayGenres } = await dealItOut("mojo", n);
    expect(setAside).toHaveLength(n); // (1 + n) set aside at 1A, minus the one 1B reveals
    expect(new Set(setAside).size).toBe(n);
    expect(setAside.every((id) => GENRES.includes(id))).toBe(true);
    expect(deckGenres).toHaveLength(1); // the revealed set's non-SHOW cards, shuffled in
    expect(inPlayGenres).toEqual(deckGenres); // its SHOW environment is in play
    expect(setAside).not.toContain(deckGenres[0]);
    expect(setAsideModularSetCountFor(scenarioOf("mojo"), n)).toBe(1 + n);
  });

  test("MaGog: one genre set shuffled in, none set aside", async () => {
    const { setAside, deckGenres } = await dealItOut("magog", 1);
    expect(setAside).toEqual([]);
    expect(deckGenres).toHaveLength(1);
  });

  test("Spiral: three genre sets, restricted pool, none set aside", async () => {
    const { setAside, deckGenres } = await dealItOut("spiral", 2);
    expect(setAside).toEqual([]);
    expect(deckGenres.length).toBeGreaterThanOrEqual(3);
  });
});

describe("MojoMania's Set the table and Scenario select labels", () => {
  test("Modular sets header", () => {
    const mojo = scenarioOf("mojo");
    expect(modularHeaderRightLabel(mojo, 1, 1, 0)).toBe(
      "1 required · 2 set aside at random · the first joins at setup",
    );
    expect(modularHeaderRightLabel(mojo, 1, 2, 0)).toBe(
      "1 required · 3 set aside at random · the first joins at setup",
    );
    expect(modularHeaderRightLabel(mojo, 1, 2, 3)).toBe("1 required · 3 set aside, chosen · the first joins at setup");
    expect(modularHeaderRightLabel(mojo, 1, 2, 1)).toBe("1 required · 1 chosen, 3 needed or pick Random");
    expect(modularHeaderRightLabel(scenarioOf("spiral"), 1, 1, 0)).toBe("1 required · 3 random");
    expect(modularHeaderRightLabel(scenarioOf("spiral"), 1, 1, 3)).toBe("1 required · 3 chosen");
    expect(modularHeaderRightLabel(scenarioOf("spiral"), 1, 1, 2)).toBe("1 required · 2 of 3 chosen, or pick Random");
    expect(modularHeaderRightLabel(scenarioOf("magog"), 1, 1, 0)).toBe("1 required · 1 random");
    expect(modularHeaderRightLabel(scenarioOf("rhino"), 1, 1, 1)).toBe("1 required · 1 chosen");
  });

  test("Encounter deck summary says Mojo's set joins at setup", () => {
    const draft = initialSetupDraft({ scenarioId: "mojo", seatDeckId: "precon:cap-leadership", seed: 1 });
    const config = buildScenario("mojo", toSessionConfig(draft, playersOf(1), scenarioOf("mojo")));
    const preview = tableSetupPreviewOf(config, scenarioOf("mojo"), "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    const row = gameSummaryRowsOf(preview).find((r) => r.label === "Encounter deck")!;
    expect(row.value).toBe(`${preview.encounterDeckSize} cards + 1 set`);
    const magog = initialSetupDraft({ scenarioId: "magog", seatDeckId: "precon:cap-leadership", seed: 1 });
    const mConfig = buildScenario("magog", toSessionConfig(magog, playersOf(1), scenarioOf("magog")));
    const mPreview = tableSetupPreviewOf(mConfig, scenarioOf("magog"), "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(gameSummaryRowsOf(mPreview).find((r) => r.label === "Encounter deck")!.value).toBe(
      `${mPreview.encounterDeckSize} cards`,
    );
  });

  test("Scenario select says what is true instead of the first pool set", () => {
    expect(pooledModularSummary(scenarioOf("magog"))).toBe("1 random genre set");
    expect(pooledModularSummary(scenarioOf("spiral"))).toBe("3 random genre sets");
    expect(pooledModularSummary(scenarioOf("mojo"))).toBe("1 genre set + 1 per hero set aside");
    expect(pooledModularSummary(scenarioOf("rhino"))).toBeNull();
    const detail = scenarioDetailOf(scenarioOf("mojo"), CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(detail.modularSummary).toBe("1 genre set + 1 per hero set aside");
    expect(shelfSubtitleOf(detail)).not.toContain("Crime");
    expect(scenarioDetailLines(detail).join("\n")).not.toContain("Crime");
  });

  test("Scenario select's Encounter sets cell is short; the detail panel keeps the full wording", () => {
    const detail = scenarioDetailOf(scenarioOf("mojo"), CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(encounterSetsCellText(detail)).toBe("MOJO · GENRE SETS SET ASIDE");
    expect(detail.modularSummary).toBe("1 genre set + 1 per hero set aside");
    const magog = scenarioDetailOf(scenarioOf("magog"), CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(encounterSetsCellText(magog)).toBe("MAGOG · 1 RANDOM GENRE SET");
    const rhino = scenarioDetailOf(scenarioOf("rhino"), CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(encounterSetsCellText(rhino)).toBe("RHINO · BOMB SCARE");
  });

  test("the summary names the genre sets Mojo sets aside, and the other scenarios add no such row", () => {
    const mojo = scenarioOf("mojo");
    let draft = initialSetupDraft({ scenarioId: "mojo", seatDeckId: "precon:cap-leadership", seed: 1 });
    draft = { ...draft, setAsideModularSetIds: ["horror", "crime"] };
    const config = buildScenario("mojo", toSessionConfig(draft, playersOf(1), mojo));
    const preview = tableSetupPreviewOf(config, mojo, "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(preview.setAsideSetNames).toEqual(["Horror", "Crime"]);
    expect(gameSummaryRowsOf(preview).find((r) => r.label === "Set aside")!.value).toBe("Horror, Crime");
    const many = { ...preview, setAsideSetNames: ["Horror", "Crime", "Western", "Sitcom", "Fantasy"] };
    expect(gameSummaryRowsOf(many).find((r) => r.label === "Set aside")!.value).toBe("Horror, Crime, Western +2");
    const rhino = scenarioOf("rhino");
    const rhinoDraft = initialSetupDraft({ scenarioId: "rhino", seatDeckId: "precon:cap-leadership", seed: 1 });
    const rhinoConfig = buildScenario("rhino", toSessionConfig(rhinoDraft, playersOf(1), rhino));
    const rhinoPreview = tableSetupPreviewOf(rhinoConfig, rhino, "standard", CARDS_BY_ID, POOL_ENCOUNTER_SETS);
    expect(gameSummaryRowsOf(rhinoPreview).some((r) => r.label === "Set aside")).toBe(false);
  });

  test("only Mojo's modular picks are sets it sets aside", () => {
    expect(modularPicksAreSetAside(scenarioOf("mojo"))).toBe(true);
    for (const id of ["magog", "spiral", "rhino"]) expect(modularPicksAreSetAside(scenarioOf(id))).toBe(false);
  });
});
