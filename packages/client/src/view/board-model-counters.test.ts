/**
 * Counters on a card in a MaGog game (docs/phase7-wave6.md: ratings counters on The Champion and The Challengers,
 * and on heroes and minions): the board's panels and Inspect both spell the kind out, "3 ratings counters".
 */
import { cardOf, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { POOL_SCENARIOS } from "../content/pool.js";
import { initialSetupDraft, toSessionConfig } from "./setup-draft.js";
import { boardModel, characterPanel, counterNote, environmentPanel } from "./board-model.js";
import { inspectModel } from "./inspect-model.js";

async function magogGame(): Promise<GameState> {
  const scenario = POOL_SCENARIOS.find((s) => (s.id as string) === "magog")!;
  const draft = initialSetupDraft({ scenarioId: "magog", seatDeckId: "precon:cap-leadership", seed: 4974 });
  const store = new SessionStore(new LocalEngineHost());
  await store.start(toSessionConfig(draft, [{ starterDeckId: "core-spider-man-justice" }], scenario));
  return store.state.game!;
}

const withCounters = (state: GameState, id: InstanceId, counters: Record<string, number>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...state.instances[id]!, counters } },
});

describe("counterNote", () => {
  test("spells every kind out with its count and a singular or plural noun", () => {
    expect(counterNote([])).toBeNull();
    expect(counterNote([{ name: "ratings", count: 3 }])).toBe("3 ratings counters");
    expect(
      counterNote([
        { name: "ratings", count: 1 },
        { name: "time", count: 2 },
      ]),
    ).toBe("1 ratings counter, 2 time counters");
  });
});

describe("ratings counters in a MaGog game", () => {
  test("the villain, the hero and the crowd environments carry them to their panels and to Inspect", async () => {
    const state = await magogGame();
    const me = state.players[0]!;
    const villain = state.villains[0]!.instanceId;
    const identity = me.identity.instanceId;
    const crowd = Object.keys(state.instances).find(
      (id) => (cardOf(state, id as InstanceId)?.id as string | undefined) === "39003a",
    ) as InstanceId;
    expect(crowd).toBeTruthy();
    let hit = withCounters(state, villain, { ratings: 2 });
    hit = withCounters(hit, identity, { ratings: 1 });
    hit = withCounters(hit, crowd, { ratings: 4 });
    expect(characterPanel(hit, villain, CORE_DEPS).counters).toEqual([{ name: "ratings", count: 2 }]);
    expect(characterPanel(hit, identity, CORE_DEPS).counters).toEqual([{ name: "ratings", count: 1 }]);
    expect(environmentPanel(hit, crowd, CORE_DEPS).counters).toEqual([{ name: "ratings", count: 4 }]);
    expect(boardModel(hit, me.playerId, CORE_DEPS).environments.map((e) => e.counters)).toContainEqual([
      { name: "ratings", count: 4 },
    ]);
    expect(inspectModel(hit, villain, null, me.playerId, CORE_DEPS).counterNote).toBe("2 ratings counters");
    expect(inspectModel(hit, identity, null, me.playerId, CORE_DEPS).counterNote).toBe("1 ratings counter");
    expect(inspectModel(hit, crowd, null, me.playerId, CORE_DEPS).counterNote).toBe("4 ratings counters");
  });

  test("a card with none says nothing", async () => {
    const state = await magogGame();
    const me = state.players[0]!;
    expect(inspectModel(state, me.identity.instanceId, null, me.playerId, CORE_DEPS).counterNote).toBeNull();
  });
});
