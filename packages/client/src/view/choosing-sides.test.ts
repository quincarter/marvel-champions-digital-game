import { beforeAll, describe, expect, test } from "vitest";
import { createGame, startSession, type GameState, type InstanceId } from "@mc/engine";
import { civilWarCompetitive } from "@mc/cards";
import { gameDeps } from "../content/game-deps.js";
import { choosingSidesOf } from "./choosing-sides.js";

const deps = gameDeps();
let state: GameState;

beforeAll(() => {
  const setup = civilWarCompetitive({
    seed: 3,
    teams: [
      { leaderScenarioId: "registration-iron-man", players: [{ starterDeckId: "core-spider-man-justice" }] },
      {
        leaderScenarioId: "resistance-captain-america",
        players: [{ starterDeckId: "core-captain-marvel-leadership" }],
      },
    ],
  });
  const created = createGame(setup, deps);
  if (!created.ok) throw new Error(created.error.message);
  state = startSession(created.state).state;
});

/** `state` with Now It's Personal (as 56128b) in the first player of `team`'s play area. */
function withNowItsPersonal(base: GameState, teamIndex: number): GameState {
  const owner = base.teams![teamIndex]!.playerIds[0]!;
  const donor = Object.values(base.instances)[0]!;
  const id = "nip-1" as InstanceId;
  return {
    ...base,
    instances: { ...base.instances, [id]: { ...donor, instanceId: id, cardId: "56128b" as never } },
    players: base.players.map((player) =>
      player.playerId === owner ? { ...player, playArea: [...player.playArea, id] } : player,
    ),
  };
}

describe("choosingSidesOf", () => {
  test("is null before Now It's Personal is in play, and in a game without teams", () => {
    expect(choosingSidesOf(state, "p1")).toBeNull();
    expect(choosingSidesOf({ ...state, teams: undefined } as unknown as GameState, "p1")).toBeNull();
  });

  test("lists the team's own leader cards still set aside, with the leader's name", () => {
    const view = choosingSidesOf(withNowItsPersonal(state, 0), "p1")!;
    // The registration team teamed up with Iron Man: its four basic cards, set aside at setup.
    expect(view.leaderName).toMatch(/Iron Man/);
    expect(view.remaining).toHaveLength(4);
    // The other team has not earned them.
    expect(choosingSidesOf(withNowItsPersonal(state, 0), "p2")).toBeNull();
  });
});

describe("choosingSidesOf reads set-aside cards and any printing", () => {
  test("a leader card taken into a hand is no longer listed", () => {
    const played = withNowItsPersonal(state, 0);
    const taken = played.teams![0]!.leaderCardIds![0]!;
    const view = choosingSidesOf(
      { ...played, encounterSetAside: played.encounterSetAside.filter((id) => id !== taken) },
      "p1",
    )!;
    expect(view.remaining).toHaveLength(3);
    expect(view.remaining.some((c) => c.instanceId === taken)).toBe(false);
  });

  test("the resistance printing counts too, found by the card's name", () => {
    const owner = state.teams![1]!.playerIds[0]!;
    const donor = Object.values(state.instances)[0]!;
    const id = "nip-2" as InstanceId;
    const resistance: GameState = {
      ...state,
      instances: { ...state.instances, [id]: { ...donor, instanceId: id, cardId: "56206b" as never } },
      players: state.players.map((p) => (p.playerId === owner ? { ...p, playArea: [...p.playArea, id] } : p)),
    };
    expect(choosingSidesOf(resistance, owner)).not.toBeNull();
  });
});
