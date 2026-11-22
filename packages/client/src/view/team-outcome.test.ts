import { describe, expect, it } from "vitest";
import { playerId, teamId, type GameOutcome, type GameState } from "@mc/engine";
import { seatResultLabel, seatResultOf } from "./team-outcome.js";

const [T1, T2] = [teamId("t1"), teamId("t2")];
const teams = [
  { teamId: T1, side: "registration", playerIds: [playerId("p1"), playerId("p2")], areaId: "a1" },
  { teamId: T2, side: "resistance", playerIds: [playerId("p3"), playerId("p4")], areaId: "a2" },
] as unknown as GameState["teams"];

const competitive = (decision: "win" | "tie" | "bothLose", one: string, two: string): GameOutcome =>
  ({
    result: "teams",
    reason: "competitiveEnded",
    decision,
    teams: [
      { teamId: T1, side: "registration", result: one, conditions: [] },
      { teamId: T2, side: "resistance", result: two, conditions: [] },
    ],
  }) as GameOutcome;

describe("seatResultOf (issue #883, MC56 p. 17)", () => {
  it("a cooperative outcome is the table's result", () => {
    expect(seatResultOf({ result: "win", reason: "villainDefeated" }, undefined, null)).toBe("win");
    expect(seatResultOf({ result: "loss", reason: "mainSchemeCompleted" }, undefined, ["p1"])).toBe("loss");
  });

  it("a competitive win is a win for the winning team's seats and a loss for the other's", () => {
    const outcome = competitive("win", "win", "loss");
    expect(seatResultOf(outcome, teams, ["p2"])).toBe("win");
    expect(seatResultOf(outcome, teams, ["p3", "p4"])).toBe("loss");
    expect(seatResultLabel(seatResultOf(outcome, teams, ["p3"]))).toBe("Defeat");
  });

  it("a tie is a tie, never a loss", () => {
    const outcome = competitive("tie", "tie", "tie");
    expect(seatResultOf(outcome, teams, ["p1"])).toBe("tie");
    expect(seatResultLabel("tie")).toBe("Tie");
  });

  it("no known seat, or seats on both teams (hot seat): both losing is a loss, anything else a tie", () => {
    expect(seatResultOf(competitive("win", "win", "loss"), teams, null)).toBe("tie");
    expect(seatResultOf(competitive("win", "loss", "win"), teams, ["p1", "p3"])).toBe("tie");
    expect(seatResultOf(competitive("bothLose", "loss", "loss"), teams, undefined)).toBe("loss");
  });

  it("a team's forfeit with no single team held (hot seat) is a concession; a held team still reads its result", () => {
    const conceded = { ...competitive("win", "loss", "win"), reason: "teamConceded", concededBy: "p1" } as GameOutcome;
    expect(seatResultOf(conceded, teams, undefined)).toBe("conceded");
    expect(seatResultOf(conceded, teams, ["p1", "p3"])).toBe("conceded");
    expect(seatResultOf(conceded, teams, ["p1"])).toBe("loss");
    expect(seatResultOf(conceded, teams, ["p4"])).toBe("win");
  });
});
