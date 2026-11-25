import { describe, expect, test } from "vitest";
import type { GameState } from "@mc/engine";
import { concedeChoicesOf } from "./competitive-concede.js";

const state = (teams: unknown, players: unknown) => ({ teams, players }) as Pick<GameState, "teams" | "players">;
const two = [
  { teamId: "t1", side: "registration", playerIds: ["p1", "p2"] },
  { teamId: "t2", side: "resistance", playerIds: ["p3", "p4"] },
];
const players = (eliminated: string[] = []) =>
  ["p1", "p2", "p3", "p4"].map((playerId) => ({ playerId, eliminated: eliminated.includes(playerId) }));

describe("concedeChoicesOf", () => {
  test("a game with no teams has none: the ordinary confirm applies", () => {
    expect(concedeChoicesOf(state(undefined, players()), "p1")).toEqual([]);
  });

  test("a 1v1 offers only the team's forfeit", () => {
    const choices = concedeChoicesOf(
      state(
        [
          { teamId: "t1", playerIds: ["p1"] },
          { teamId: "t2", playerIds: ["p2"] },
        ],
        players(),
      ),
      "p1",
    );
    expect(choices.map((c) => c.id)).toEqual(["team"]);
    expect(choices[0]!.command).toEqual({ type: "concede", playerId: "p1" });
  });

  test("a 2v2 also offers to leave alone, which sends alone", () => {
    const choices = concedeChoicesOf(state(two, players()), "p3");
    expect(choices.map((c) => c.id)).toEqual(["team", "alone"]);
    expect(choices[1]!.command).toEqual({ type: "concede", playerId: "p3", alone: true });
  });

  test("with the teammate already out, leaving alone is the team's forfeit, so only that is offered", () => {
    expect(concedeChoicesOf(state(two, players(["p4"])), "p3").map((c) => c.id)).toEqual(["team"]);
  });
});

import { concedeRouteOf } from "./competitive-concede.js";

describe("concedeRouteOf", () => {
  test("a competitive game opens the sheet for the owner and for a seated guest; an ordinary room's guest leaves", () => {
    const competitive = { teams: [] } as unknown as Pick<GameState, "teams">;
    expect(concedeRouteOf(competitive, false)).toBe("sheet");
    expect(concedeRouteOf(competitive, true)).toBe("sheet");
    expect(concedeRouteOf({} as Pick<GameState, "teams">, true)).toBe("leave");
    expect(concedeRouteOf({} as Pick<GameState, "teams">, false)).toBe("confirm");
    expect(concedeRouteOf(null, false)).toBe("confirm");
  });
});
