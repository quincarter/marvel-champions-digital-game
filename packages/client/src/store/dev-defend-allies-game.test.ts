import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { defendAlliesReached, startDefendAlliesGame } from "./dev-defend-allies-game.js";
import { SessionStore } from "./session-store.js";

describe("the defend-allies dev game (#298)", () => {
  test("its last command opens a defend choice with War Machine and Mockingbird ready and one of them hurt", async () => {
    const store = new SessionStore(new LocalEngineHost());
    const finish = await startDefendAlliesGame(store);
    expect(store.state.error).toBeNull();
    expect(defendAlliesReached(store.state.game!)).toBe(false);
    await finish();
    expect(store.state.error).toBeNull();
    expect(defendAlliesReached(store.state.game!)).toBe(true);
  }, 120_000);
});
