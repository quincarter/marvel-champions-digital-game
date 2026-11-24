import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { codeOf } from "./dev-game-steps.js";
import { REPURPOSE, REPURPOSE_TECH_WANTED, startRepurposeGame, techInPlay } from "./dev-repurpose-game.js";
import { SessionStore } from "./session-store.js";

describe("the Repurpose dev game", () => {
  test("Iron Man in hero form with seven Tech upgrades in play and Repurpose in hand", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startRepurposeGame(store);
    expect(store.state.error).toBeNull();
    const game = store.state.game!;
    const me = game.players[0]!;
    expect(game.outcome).toBeFalsy();
    expect(me.identity.form).toBe("hero");
    expect(techInPlay(game).length).toBeGreaterThanOrEqual(REPURPOSE_TECH_WANTED);
    expect(me.hand.some((id) => codeOf(game, id) === REPURPOSE)).toBe(true);
    const actions = store.state.legal?.actions;
    expect(actions?.kind).toBe("turn");
    const playable = actions?.kind === "turn" ? actions.legal : [];
    expect(
      playable.some((entry) => entry.action.kind === "playCard" && codeOf(game, entry.action.instanceId) === REPURPOSE),
      "Repurpose can be played",
    ).toBe(true);
  });
});
