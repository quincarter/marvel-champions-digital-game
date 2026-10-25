import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { POOL_DEPS } from "../content/pool.js";
import { inspectModel } from "../view/inspect-model.js";
import { playToWorkLifeRefusal } from "./dev-work-life-game.js";
import { SessionStore } from "./session-store.js";

describe("the Work-Life Balance dev game (#412)", () => {
  test("Jessica in alter-ego, stalwart from Inspiring Pottery, no ally: Inspect says why the action can't be used", async () => {
    const store = new SessionStore(new LocalEngineHost());
    const workLife = await playToWorkLifeRefusal(store);
    expect(store.state.error).toBeNull();
    expect(workLife).not.toBeNull();
    const game = store.state.game!;
    const me = game.players[0]!.playerId;
    expect(inspectModel(game, workLife!, store.state.legal!.actions, me, POOL_DEPS).status.message).toBe(
      "that ability has no valid target: you control no ally, and Jessica Jones is stalwart and cannot be confused",
    );
  }, 120_000);
});
