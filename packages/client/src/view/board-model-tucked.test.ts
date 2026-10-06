/**
 * Cards tucked under an environment (RRG 1.8 "Tuck", p. 45), read off a real Morlock Siege game whose first villain
 * was defeated and went under Routed (`store/dev-routed-game.ts`): the environment's panel lists them faceup in
 * order with a count, and a tucked villain is neither in the villain row nor the active villain. Generic: the view
 * model reads `CardInstance.tucked` and never names a card.
 */
import { beforeAll, describe, expect, test } from "vitest";
import type { GameState, InstanceId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { startRoutedDevGame } from "../store/dev-routed-game.js";
import { SessionStore } from "../store/session-store.js";
import { POOL_DEPS } from "../content/pool.js";
import { boardModel, tuckedCardsUnder } from "./board-model.js";

let state: GameState;
let me: NonNullable<SessionStore["state"]["perspectiveId"]>;
let host: InstanceId;
let tuckedVillain: InstanceId;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await startRoutedDevGame(store);
  state = store.state.game!;
  me = store.state.perspectiveId!;
  host = state.villainArea.find((id) => (state.instances[id]!.tucked.length ?? 0) > 0)!;
  tuckedVillain = state.instances[host]!.tucked[0]!;
}, 120_000);

describe("an environment with cards tucked under it", () => {
  test("lists the tucked card faceup, with its name, art slot and a count", () => {
    const panel = boardModel(state, me, POOL_DEPS).environments.find((e) => e.instanceId === host)!;
    expect(panel.tuckedCount).toBe(1);
    expect(panel.tucked.map((card) => card.instanceId)).toEqual([tuckedVillain]);
    expect(panel.tucked[0]).toMatchObject({ faceup: true, name: expect.any(String) });
    expect(panel.tucked[0]!.name).not.toBe("Facedown card");
    expect(panel.tucked[0]!.art).not.toBeNull();
  });

  test("keeps tuck order when more go under, and hides a card that is facedown", () => {
    const second = state.encounterSetAside[0]!;
    const staged: GameState = {
      ...state,
      instances: {
        ...state.instances,
        [host]: { ...state.instances[host]!, tucked: [tuckedVillain, second] },
        [second]: { ...state.instances[second]!, faceup: false },
      },
    };
    const cards = tuckedCardsUnder(staged, host);
    expect(cards.map((card) => card.instanceId)).toEqual([tuckedVillain, second]);
    expect(cards.map((card) => card.faceup)).toEqual([true, false]);
    expect(cards[1]).toMatchObject({ name: "Facedown card", art: null });
  });

  test("an environment with nothing under it lists none", () => {
    const empty = boardModel(state, me, POOL_DEPS).environments.filter((e) => e.instanceId !== host);
    for (const panel of empty) expect(panel).toMatchObject({ tucked: [], tuckedCount: 0 });
  });
});

describe("a villain tucked under a card", () => {
  test("is out of the villain row; the villain in play is the active one", () => {
    const model = boardModel(state, me, POOL_DEPS);
    expect(model.villains.map((v) => v.panel.instanceId)).not.toContain(tuckedVillain);
    expect(model.villains.map((v) => [v.panel.instanceId, v.active, v.defeated])).toEqual([
      [state.activeVillainId, true, false],
    ]);
    expect(model.villain.instanceId).toBe(state.activeVillainId);
    expect(state.activeVillainId).not.toBe(tuckedVillain);
  });

  test("has no tap target of its own: nothing else on the model names it", () => {
    const model = boardModel(state, me, POOL_DEPS);
    const named = [model.villain, ...model.minions, ...model.villains.map((v) => v.panel)].map((p) => p.instanceId);
    expect(named).not.toContain(tuckedVillain);
  });
});
