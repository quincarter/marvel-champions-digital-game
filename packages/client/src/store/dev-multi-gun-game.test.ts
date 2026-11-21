import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { multiGunReached, startMultiGunGame } from "./dev-multi-gun-game.js";
import { SessionStore } from "./session-store.js";

describe("the Multi-Gun dev game (issue #911)", () => {
  test("stops on Multi-Gun's choose-a-player with a minion engaged with each seat, both seats offered", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startMultiGunGame(store);
    expect(store.state.error).toBeNull();
    const game = store.state.game!;
    const choice = store.state.legal?.actions.kind === "choice" ? store.state.legal.actions.choice : null;
    expect(multiGunReached(game, choice?.prompt.kind)).toBe(true);
    expect(choice?.options).toHaveLength(2);
  }, 120_000);
});
