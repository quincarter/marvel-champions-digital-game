import { describe, expect, test } from "vitest";
import { POOL_ENCOUNTER_SETS, POOL_SCENARIOS, packNameOf } from "../content/pool.js";
import { initialSetupDraft, setDifficulty } from "./setup-draft.js";
import { setupOptionRowsOf, splitOptionRows } from "./setup-options.js";
import {
  chosenDifficultySetId,
  difficultySetIdOfAction,
  difficultySetLine,
  difficultySetSections,
  difficultySetsSubtitle,
} from "./difficulty-sets.js";

const NAMES = new Map(POOL_ENCOUNTER_SETS.map((s) => [s.id as string, s.name]));
const productOf = (setId: string): string => {
  const code = POOL_ENCOUNTER_SETS.find((s) => (s.id as string) === setId)?.packCodes[0];
  return code ? packNameOf(code as string) : setId;
};
const rowsFor = (difficulty: "standard" | "expert") => {
  const scenario = POOL_SCENARIOS.find((s) => (s.id as string) === "rhino")!;
  let draft = initialSetupDraft({ scenarioId: scenario.id as string, seatDeckId: "precon:cap-leadership", seed: 1 });
  if (difficulty === "expert") draft = setDifficulty(draft, "expert");
  return splitOptionRows(setupOptionRowsOf(draft, NAMES)).setChoices;
};

describe("difficulty sets", () => {
  test("a chip's action names its encounter set; the default chip is the Core Set's own", () => {
    expect(difficultySetIdOfAction("standardSet:default")).toBe("standard");
    expect(difficultySetIdOfAction("standardSet:standard_iii")).toBe("standard_iii");
    expect(difficultySetIdOfAction("expertSet:default")).toBe("expert");
    expect(difficultySetIdOfAction("genePool:up")).toBeNull();
  });

  test("Standard: the line says what the set is, and the default is chosen", () => {
    const [standard] = rowsFor("standard");
    expect(chosenDifficultySetId(standard!)).toBe("standard");
    expect(difficultySetLine(standard!)).toBe("Encounter cards shuffled into every game.");
  });

  test("Expert adds its own row and line", () => {
    const rows = rowsFor("expert");
    const expert = rows.find((row) => row.id === "expertSet")!;
    expect(difficultySetLine(expert)).toBe("Added on top in Expert mode.");
  });

  test("the sheet: one section per set the rows offer, the chosen one marked, Expert's after Standard's", () => {
    const rows = rowsFor("expert");
    const sections = difficultySetSections(rows, productOf, () => 7);
    expect(sections.map((s) => s.setId)).toEqual(["standard", "standard_ii", "standard_iii", "expert", "expert_ii"]);
    expect(sections.filter((s) => s.chosen).map((s) => s.heading)).toEqual([
      "Standard I · chosen",
      "Expert I · chosen",
    ]);
    expect(sections[1]!.note).toBe(`From ${productOf("standard_ii")} · 7 cards`);
    expect(difficultySetsSubtitle(rows)).toMatch(/Expert mode adds one Expert set/);
    expect(difficultySetsSubtitle(rowsFor("standard"))).not.toMatch(/Expert/);
  });
});
