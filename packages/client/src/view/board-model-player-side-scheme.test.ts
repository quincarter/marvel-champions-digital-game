/**
 * A player side scheme's threat meter (issue #763): it empties toward 0 like any side scheme, so it has a `meterMax`
 * and is drawn filled, in the player's own color (`playerScheme`) rather than the villain side's red.
 */

import { describe, expect, test } from "vitest";
import type { AnyCard, CardId } from "@mc/content";
import type { GameState, InstanceId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { schemePanel } from "./board-model.js";
import { POOL_DEPS } from "../content/pool.js";

/** The live game with its main scheme's instance standing in for a player side scheme with `threat` on it. */
async function withPlayerSideScheme(threat: number): Promise<{ state: GameState; id: InstanceId }> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 7,
  });
  const game = store.state.game!;
  const id: InstanceId = game.mainScheme.instanceId;
  const cardId = "test-player-scheme" as CardId;
  const card = {
    id: cardId,
    type: "player_side_scheme",
    name: "Render Medical Aid",
    startingThreat: { base: 0, perPlayer: 3 },
  } as unknown as AnyCard;
  const state: GameState = {
    ...game,
    cardPool: { ...game.cardPool, [cardId]: card },
    instances: { ...game.instances, [id]: { ...game.instances[id]!, cardId, threat } },
  };
  return { state, id };
}

describe("a player side scheme's threat meter (#763)", () => {
  test("is drawn against the threat it entered play with, in the player's color", async () => {
    const { state, id } = await withPlayerSideScheme(2);
    const panel = schemePanel(state, id, POOL_DEPS, false);
    expect(panel.meterMax).toBe(3);
    expect(panel.threat).toBe(2);
    expect(panel.playerScheme).toBe(true);
  });

  test("never sits below the threat now on it", async () => {
    const { state, id } = await withPlayerSideScheme(5);
    expect(schemePanel(state, id, POOL_DEPS, false).meterMax).toBe(5);
  });
});
