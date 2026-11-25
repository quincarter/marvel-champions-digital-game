import { describe, expect, test } from "vitest";
import type { GameState } from "@mc/engine";
import { competitiveOverOf } from "./competitive-over.js";

const teams = [
  { teamId: "t1", side: "registration", playerIds: ["p1"], areaId: "a1" },
  { teamId: "t2", side: "resistance", playerIds: ["p2"], areaId: "a2" },
] as unknown as GameState["teams"];

const state = (outcome: unknown): Pick<GameState, "outcome" | "teams"> =>
  ({ outcome, teams }) as Pick<GameState, "outcome" | "teams">;

const tied = (tieBreak: unknown) =>
  state({
    result: "teams",
    reason: "competitiveEnded",
    decision: "tie",
    teams: [
      { teamId: "t1", side: "registration", result: "tie", conditions: ["enemyLeaderDefeated"] },
      { teamId: "t2", side: "resistance", result: "tie", conditions: ["enemyLeaderDefeated"] },
    ],
    tieBreak,
  });

describe("competitiveOverOf", () => {
  test("is null for a game that is not over or not competitive", () => {
    expect(competitiveOverOf(state(undefined), ["p1"])).toBeNull();
    expect(competitiveOverOf(state({ result: "win", reason: "villainDefeated" }), ["p1"])).toBeNull();
  });

  test("a win for one side reads Victory for it and Defeat for the other, with the conditions", () => {
    const over = competitiveOverOf(
      state({
        result: "teams",
        reason: "competitiveEnded",
        decision: "win",
        teams: [
          { teamId: "t1", side: "registration", result: "win", conditions: ["enemyLeaderDefeated"] },
          { teamId: "t2", side: "resistance", result: "loss", conditions: [] },
        ],
      }),
      ["p2"],
    )!;
    expect(over.headline).toBe("Defeat");
    expect(over.rows.map((r) => [r.sideLabel, r.resultLabel, r.mine])).toEqual([
      ["Registration", "Victory", false],
      ["Resistance", "Defeat", true],
    ]);
    expect(over.rows[0]!.conditions).toEqual(["Defeated the enemy leader"]);
    expect(over.tieBreak).toBeNull();
    expect(over.reason).toBeNull();
  });

  test("shows each measure read and the deciding one", () => {
    const over = competitiveOverOf(
      tied({
        applied: true,
        decidedBy: "mainSchemeThreat",
        measures: [
          { measure: "mainSchemeAdvanced", values: { t1: 0, t2: 0 } },
          { measure: "minionsAndSideSchemes", values: { t1: 2, t2: 2 } },
          { measure: "mainSchemeThreat", values: { t2: 3, t1: 5 } },
        ],
      }),
      ["p1"],
    )!;
    const panel = over.tieBreak!;
    expect(panel.measures).toHaveLength(3);
    expect(panel.measures.map((m) => m.decided)).toEqual([false, false, true]);
    // Registration first whatever the order the engine listed the values in.
    expect(panel.measures[2]!.values).toEqual([
      { sideLabel: "Registration", value: 5 },
      { sideLabel: "Resistance", value: 3 },
    ]);
    expect(panel.summary).toBe("Decided by: Least threat on your main scheme");
  });

  test("still tied after all five, and tie-breaks off, are said in words", () => {
    const none = competitiveOverOf(
      tied({ applied: true, decidedBy: null, measures: [{ measure: "mainSchemeAdvanced", values: { t1: 0, t2: 0 } }] }),
      ["p1"],
    )!;
    expect(none.tieBreak!.summary).toBe("Still tied after every tie-break: a tie.");
    expect(none.headline).toBe("Tie");
    expect(competitiveOverOf(tied({ applied: false }), ["p1"])!.tieBreak).toEqual({
      summary: "Tie-breaks were off: a tie.",
      measures: [],
    });
  });

  test("both lose and a concession carry a reason, and the conceder reads Conceded", () => {
    const both = competitiveOverOf(
      state({
        result: "teams",
        reason: "competitiveEnded",
        decision: "bothLose",
        teams: [
          { teamId: "t1", side: "registration", result: "loss", conditions: [] },
          { teamId: "t2", side: "resistance", result: "loss", conditions: [] },
        ],
      }),
      ["p1"],
    )!;
    expect(both.reason).toBe("Both sides lost.");
    const conceded = competitiveOverOf(
      state({
        result: "teams",
        reason: "teamConceded",
        concededBy: "p1",
        decision: "win",
        teams: [
          { teamId: "t1", side: "registration", result: "loss", conditions: [] },
          { teamId: "t2", side: "resistance", result: "win", conditions: [] },
        ],
      }),
      ["p1"],
    )!;
    expect(conceded.reason).toBe("A team conceded.");
    expect(conceded.rows[0]!.resultLabel).toBe("Conceded");
    expect(conceded.rows[1]!.resultLabel).toBe("Victory");
  });
});
