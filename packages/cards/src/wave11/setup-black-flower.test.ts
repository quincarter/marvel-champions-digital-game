/**
 * A standalone game with Black Flower as a modular set (MC65): Creeping Corruption (72A, "Permanent. Setup. Max 1 per
 * player") begins in play, one under each player, and the other copies stay set aside. Heart of Shadow's 1A does the
 * same
 * for its own copies and must not be doubled; a campaign's scenarios 1 and 2 are composed by the campaign instead.
 */
import { describe, expect, it } from "vitest";
import { createGame, type GameState, type InstanceId } from "@mc/engine";
import { firstLegal, inst, settle } from "../testing/harness.js";
import { WAVE11_DEPS } from "./index.js";
import { wave11Scenario } from "./setup.js";

const SEATS = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];

function played(scenario: string, players: number, modularSetIds: readonly string[]): GameState {
  const config = wave11Scenario(scenario, { players: SEATS.slice(0, players), seed: 5, modularSetIds } as never);
  const created = createGame(config, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
}

const copies = (state: GameState): InstanceId[] =>
  (Object.keys(state.instances) as InstanceId[]).filter((id) => (inst(state, id).cardId as string) === "65072a");
const controlledBy = (state: GameState, id: InstanceId, seat: number): boolean =>
  inst(state, id).controllerId === state.players[seat]!.playerId;

describe.each([
  ["shadows-in-the-night", ["black_flower"]],
  ["shadow-labyrinth", ["black_flower"]],
] as const)("%s with Black Flower as its modular set", (scenario, sets) => {
  it.each([1, 2])("%i player(s): one Creeping Corruption under each, the rest set aside", (players) => {
    const state = played(scenario, players, sets);
    const all = copies(state);
    expect(all).toHaveLength(4);
    const inPlay = all.filter((id) => !state.encounterSetAside.includes(id));
    expect(inPlay).toHaveLength(players);
    for (let seat = 0; seat < players; seat++)
      expect(
        inPlay.filter((id) => controlledBy(state, id, seat)),
        `seat ${seat + 1}`,
      ).toHaveLength(1);
    expect(all.filter((id) => state.encounterSetAside.includes(id))).toHaveLength(4 - players);
  });

  it("without Black Flower no Creeping Corruption exists", () => {
    expect(copies(played(scenario, 1, ["ninja_swarm"]))).toHaveLength(0);
  });
});

describe("Heart of Shadow", () => {
  it("still puts exactly one Creeping Corruption under each player (its 1A, not doubled)", () => {
    const state = played("heart-of-shadow", 2, ["ninja_swarm"]);
    const inPlay = copies(state).filter((id) => !state.encounterSetAside.includes(id));
    expect(inPlay).toHaveLength(2);
    expect([0, 1].map((seat) => inPlay.filter((id) => controlledBy(state, id, seat)).length)).toEqual([1, 1]);
  });
});
