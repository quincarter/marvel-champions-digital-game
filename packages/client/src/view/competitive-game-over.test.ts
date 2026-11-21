import { describe, expect, test } from "vitest";
import type { GameState } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import { competitiveGameOverOf } from "./competitive-game-over.js";
import { competitiveFixtureOutcome } from "./competitive-over-fixture.js";

const teams = [
  { teamId: "t1", side: "registration", playerIds: ["p1"], areaId: "a1" },
  { teamId: "t2", side: "resistance", playerIds: ["p2"], areaId: "a2" },
] as unknown as NonNullable<GameState["teams"]>;

const stateOf = (over: "win" | "loss" | "tie"): GameState =>
  ({
    teams,
    instances: {},
    outcome: competitiveFixtureOutcome(over, teams),
    gameAreas: [
      { areaId: "a1", activeVillainId: "v-resistance", villainIds: ["v-resistance"] },
      { areaId: "a2", activeVillainId: "v-registration", villainIds: ["v-registration"] },
    ],
    players: [
      { playerId: "p1", identity: { instanceId: "h1" } },
      { playerId: "p2", identity: { instanceId: "h2" } },
    ],
  }) as unknown as GameState;

const config = {
  scenarioId: "registration-iron-man",
  competitive: {
    teams: [{ leaderScenarioId: "registration-iron-man" }, { leaderScenarioId: "resistance-captain-america" }],
  },
} as unknown as SessionConfig;

describe("competitiveGameOverOf", () => {
  test("is null for a cooperative game", () => {
    const state = { ...stateOf("win"), outcome: { result: "win", reason: "villainDefeated" } } as unknown as GameState;
    expect(competitiveGameOverOf(state, config, ["p1"])).toBeNull();
  });

  test("a win reads in the viewer's side's words, features the winner, and faces the other team's leader", () => {
    const result = competitiveGameOverOf(stateOf("win"), config, ["p1"])!;
    expect(result.headline).toBe("Registration Victory");
    expect(result.teams.map((team) => [team.side, team.winner, team.mine])).toEqual([
      ["registration", true, true],
      ["resistance", false, false],
    ]);
    expect(result.teams[0]!.tags).toEqual(["★ Winner", "Your team"]);
    // A team's leader is the one the other team's area holds.
    expect(result.teams[0]!.leader?.instanceId).toBe("v-registration");
    expect(result.teams[1]!.leader?.instanceId).toBe("v-resistance");
    expect(result.teams[0]!.heroes.map((hero) => hero.instanceId)).toEqual(["h1"]);
    expect(result.facedScenarioId).toBe("resistance-captain-america");
    expect(result.summary).toContain("Registration: Defeated the enemy leader");
  });

  test("a loss reads as the viewer's own defeat", () => {
    const result = competitiveGameOverOf(stateOf("loss"), config, ["p1"])!;
    expect(result.headline).toBe("Registration Defeat");
    expect(result.teams[1]!.tags).toEqual(["★ Winner"]);
  });

  test("a tie features no winner and carries the tie-break rows, the deciding one starred", () => {
    const result = competitiveGameOverOf(stateOf("tie"), config, ["p2"])!;
    expect(result.headline).toBe("A Tie");
    expect(result.teams.some((team) => team.winner)).toBe(false);
    expect(result.panel.heading).toBe("Tie-breaks");
    expect(result.panel.lines.length).toBe(4);
    expect(result.facedScenarioId).toBe("registration-iron-man");
  });

  test("a hot seat on both sides is worded by the winner", () => {
    const result = competitiveGameOverOf(stateOf("win"), config, ["p1", "p2"])!;
    expect(result.headline).toBe("Registration Victory");
    expect(result.facedScenarioId).toBe("registration-iron-man");
  });
});
