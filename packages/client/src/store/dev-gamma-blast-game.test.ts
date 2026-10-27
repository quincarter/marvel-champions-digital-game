import { describe, expect, it } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { triggerWindowContextOf } from "../view/trigger-window-context.js";
import { startGammaBlastDevGame } from "./dev-gamma-blast-game.js";
import { SessionStore } from "./session-store.js";

describe("the Gamma Blast dev game", () => {
  it("stops on the response window after the sentence, headed by the form change", async () => {
    const store = new SessionStore(new LocalEngineHost());
    expect(await startGammaBlastDevGame(store)).toBe(true);
    const game = store.state.game!;
    const context = triggerWindowContextOf(game, game.pendingChoice!, game.players[0]!.playerId, POOL_DEPS)!;
    expect(context.headline).toBe("You changed to Gamma energy form");
  }, 60_000);
});
