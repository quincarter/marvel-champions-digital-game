import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { codeOf } from "./dev-game-steps.js";
import { startSyncRatioGame } from "./dev-sync-ratio-game.js";
import { SessionStore } from "./session-store.js";

describe("the Sync Ratio dev game", () => {
  test("SP//dr in hero form in round 2, with Speed-Metal Alloy on her and SP//dr ready", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startSyncRatioGame(store);
    expect(store.state.error).toBeNull();
    const game = store.state.game!;
    const me = game.players[0]!;
    expect(me.identity.form).toBe("hero");
    expect(game.round).toBe(2);
    const worn = game.instances[me.identity.instanceId]!.attachments.map((id) => codeOf(game, id));
    expect(worn).toContain("31012");
  });
});
