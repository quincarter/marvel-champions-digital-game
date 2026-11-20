import { describe, expect, it } from "vitest";
import { epicTableBase, EPIC_SCENARIO_ID } from "./epic-table-config.js";

describe("the table's game", () => {
  it("is the god-of-lies scenario with the table's own difficulty, and no players yet", () => {
    const base = epicTableBase({ seats: 2, difficulty: "expert", scenario: undefined });
    expect(base.scenarioId).toBe(EPIC_SCENARIO_ID);
    expect(base.difficulty).toBe("expert");
    expect("players" in base).toBe(false);
  });

  it("is standard for anything the organizer did not set to expert", () => {
    expect(epicTableBase({ seats: 1, difficulty: undefined, scenario: undefined }).difficulty).toBe("standard");
  });
});
