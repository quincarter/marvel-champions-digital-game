/**
 * Threat on a card that is not a scheme (engine §3.59, MojoMania: Curtain Call puts it on Peter Parker, Paparazzi
 * enters with Hinder 10). The board draws it as a strip on the card's panel and Inspect names it; both read these.
 */
import { cardOf, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { POOL_SCENARIOS } from "../content/pool.js";
import { initialSetupDraft, toSessionConfig } from "./setup-draft.js";
import { boardModel, characterPanel, threatNote } from "./board-model.js";
import { inspectModel } from "./inspect-model.js";

async function mojoGame(): Promise<GameState> {
  const scenario = POOL_SCENARIOS.find((s) => (s.id as string) === "mojo")!;
  const draft = initialSetupDraft({ scenarioId: "mojo", seatDeckId: "precon:cap-leadership", seed: 4974 });
  const store = new SessionStore(new LocalEngineHost());
  await store.start(toSessionConfig(draft, [{ starterDeckId: "core-spider-man-justice" }], scenario));
  return store.state.game!;
}

const firstOfType = (state: GameState, type: string): InstanceId =>
  Object.keys(state.instances).find((id) => cardOf(state, id as InstanceId)?.type === type) as InstanceId;

const withThreat = (state: GameState, id: InstanceId, threat: number): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...state.instances[id]!, threat } },
});

describe("threat on a card that is not a scheme", () => {
  test("an identity holding threat reports it on its panel and in Inspect", async () => {
    const state = await mojoGame();
    const me = state.players[0]!;
    const identity = me.identity.instanceId;
    expect(characterPanel(state, identity, CORE_DEPS).threat).toBe(0);
    const hit = withThreat(state, identity, 1);
    const model = boardModel(hit, me.playerId, CORE_DEPS);
    expect(model.me.threat).toBe(1);
    expect(inspectModel(hit, identity, null, me.playerId, CORE_DEPS).threatNote).toBe("1 threat");
  });

  test("an ally and a minion report theirs", async () => {
    const state = await mojoGame();
    for (const type of ["ally", "minion"]) {
      const id = firstOfType(state, type);
      if (!id) continue;
      const hit = withThreat(state, id, 3);
      expect(characterPanel(hit, id, CORE_DEPS).threat).toBe(3);
    }
    expect(firstOfType(state, "ally") || firstOfType(state, "minion")).toBeTruthy();
  });

  test("an obligation in the player's area (Paparazzi, Hinder 10) shows its threat in myPlayArea", async () => {
    const state = await mojoGame();
    const me = state.players[0]!;
    const paparazzi = Object.values(state.instances).find((i) => (i.cardId as string) === "39030")!.instanceId;
    const inPlay: GameState = {
      ...withThreat(state, paparazzi, 10),
      players: state.players.map((p) => ({ ...p, playArea: [...p.playArea, paparazzi] })),
    };
    const panel = boardModel(inPlay, me.playerId, CORE_DEPS).myPlayArea.find((p) => p.instanceId === paparazzi);
    expect(panel?.threat).toBe(10);
  });

  test("0 shows nothing, and a scheme never reports threat as a card note", async () => {
    const state = await mojoGame();
    const me = state.players[0]!;
    expect(characterPanel(state, me.identity.instanceId, CORE_DEPS).threat).toBe(0);
    expect(inspectModel(state, me.identity.instanceId, null, me.playerId, CORE_DEPS).threatNote).toBeNull();
    expect(threatNote(0)).toBeNull();
    expect(threatNote(2)).toBe("2 threat");
    const main = state.mainScheme.instanceId;
    expect(inspectModel(state, main, null, me.playerId, CORE_DEPS).threatNote).toBeNull();
  });
});
