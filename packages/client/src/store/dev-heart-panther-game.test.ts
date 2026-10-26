import { describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { DevStateHost } from "../engine/dev-state-host.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { codeOf, nextTurn } from "./dev-game-steps.js";
import { HEART_OF_THE_PANTHER, HEART_PANTHER_CONFIG, stageHeartOfThePanther } from "./dev-heart-panther-game.js";
import { SessionStore } from "./session-store.js";

describe("the heart-panther dev game (#425)", () => {
  test("Shuri with the T'Challa ally in play can play Heart of the Panther", async () => {
    const first = new SessionStore(new LocalEngineHost());
    await first.start(HEART_PANTHER_CONFIG);
    await nextTurn(first);
    const store = new SessionStore(new DevStateHost(stageHeartOfThePanther(first.state.game!), POOL_DEPS));
    await store.start(HEART_PANTHER_CONFIG);
    const turn = await nextTurn(store);
    expect(store.state.error).toBeNull();
    const game = store.state.game!;
    const heart = game.players[0]!.hand.find((id) => codeOf(game, id) === HEART_OF_THE_PANTHER);
    expect(heart).toBeDefined();
    const play = turn?.legal.find((entry) => entry.action.kind === "playCard" && entry.action.instanceId === heart);
    expect(play).toBeDefined();
  }, 120_000);
});
