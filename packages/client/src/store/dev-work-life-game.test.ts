import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { POOL_DEPS } from "../content/pool.js";
import { inspectModel } from "../view/inspect-model.js";
import { logLine } from "../view/log-lines.js";
import { playToWorkLifeRefusal, playWorkLifeWithAlly } from "./dev-work-life-game.js";
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

describe("the Work-Life Balance dev game with an ally (#412)", () => {
  test("the ally option is taken on its own, and the log says why confuse was not offered", async () => {
    const store = new SessionStore(new LocalEngineHost());
    const events = (await playWorkLifeWithAlly(store))!;
    expect(events).not.toBeNull();
    expect(store.state.error).toBeNull();
    const chosen = events.find((event) => event.type === "optionChosen")!;
    const game = store.state.game!;
    const line = logLine(chosen, game, game.players[0]!.playerId, POOL_DEPS, false, undefined, {
      events,
      at: events.indexOf(chosen),
    });
    expect(line?.text).toMatch(/^Only option left: .*Not available: .*stalwart and cannot be confused\.$/);
  }, 120_000);
});
