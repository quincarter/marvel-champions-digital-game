import { describe, expect, it } from "vitest";
import { currentCardsById, currentEncounterSets, currentScenarios } from "../content/pool.js";
import { initialSetupDraft } from "./setup-draft.js";
import { planGrid, planPictures, tablePlanOf } from "./room-table-plan.js";

const content = () => ({
  scenarios: currentScenarios(),
  cards: currentCardsById(),
  encounterSets: currentEncounterSets(),
});

describe("tablePlanOf", () => {
  it("resolves a null modular pick to the scenario's recommended sets, and carries Heroic and Skirmish", () => {
    const scenario = currentScenarios().find((s) => (s.id as string) === "rhino")!;
    const draft = {
      ...initialSetupDraft({ scenarioId: "rhino", seatDeckId: null, scenarioPicked: true, seed: 1 }),
      scenarioId: scenario.id,
      modularSetIds: null,
      difficulty: "expert" as const,
    };
    const plan = tablePlanOf({ ...draft, heroicLevel: 2, skirmish: {} }, scenario);
    expect(plan).toEqual({
      scenarioId: "rhino",
      modularSetIds: (scenario.recommendedModularSetIds ?? []).map((id) => id as string),
      difficulty: "expert",
      heroicLevel: 2,
      skirmish: true,
    });
    expect(tablePlanOf({ ...draft, modularSetIds: ["bomb_scare" as never] }, scenario).modularSetIds).toEqual([
      "bomb_scare",
    ]);
  });
});

describe("planPictures", () => {
  it("names the villain and each set from content, with a hover card for each", () => {
    const { villain, sets } = planPictures(
      { scenarioId: "rhino", modularSetIds: ["bomb_scare"], difficulty: "standard" },
      content(),
    );
    expect(villain.name).toContain("Rhino");
    expect(villain.cardId).not.toBeNull();
    expect(sets).toHaveLength(1);
    expect(sets[0]!.name).toBe("Bomb Scare");
    expect(sets[0]!.cardId).not.toBeNull();
  });

  it("shows an id it cannot resolve, with no picture and no hover", () => {
    const { villain, sets } = planPictures(
      { scenarioId: "from-a-mod", modularSetIds: ["mystery"], difficulty: "standard" },
      content(),
    );
    expect(villain).toMatchObject({ name: "from-a-mod", artUrl: null, cardId: null });
    expect(sets[0]).toMatchObject({ name: "mystery", artUrl: null, cardId: null });
  });
});

describe("planGrid", () => {
  it("fits pictures in a phone's width and never exceeds the count", () => {
    expect(planGrid(3, 335)).toEqual({ cols: 3, size: 104 });
    expect(planGrid(6, 335).cols).toBe(4);
    expect(planGrid(1, 300).cols).toBe(1);
    expect(planGrid(5, 100).size).toBeGreaterThanOrEqual(40);
  });
});
