import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { ATTACKERS, alliesInPlay, attackersReached, startAttackersGame } from "./dev-attackers-game.js";
import { SessionStore } from "./session-store.js";

describe("the attackers dev game", () => {
  test("Captain Marvel's turn in hero form with three ready allies, so four characters can attack", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startAttackersGame(store);
    expect(store.state.error).toBeNull();
    const game = store.state.game!;
    expect(attackersReached(game)).toBe(true);
    expect(alliesInPlay(game).length).toBeGreaterThanOrEqual(ATTACKERS);
    const attacks = store.state.legal?.actions.kind === "turn" ? store.state.legal.actions.legal : [];
    expect(attacks.filter((entry) => entry.action.kind === "basicAttack").length).toBeGreaterThanOrEqual(ATTACKERS + 1);
  }, 120_000);
});
