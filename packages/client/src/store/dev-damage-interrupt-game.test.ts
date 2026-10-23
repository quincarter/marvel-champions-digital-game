import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { damageInterruptReached, startDamageInterruptGame } from "./dev-damage-interrupt-game.js";
import { SessionStore } from "./session-store.js";

describe("the damage-interrupt dev game (#394)", () => {
  test("ending the turn stops on Backflip's window for Rhino's attack", async () => {
    const store = new SessionStore(new LocalEngineHost());
    const finish = await startDamageInterruptGame(store);
    expect(store.state.error).toBeNull();
    expect(damageInterruptReached(store.state.game!)).toBe(false);
    await finish();
    expect(store.state.error).toBeNull();
    expect(damageInterruptReached(store.state.game!)).toBe(true);
  }, 120_000);
});
