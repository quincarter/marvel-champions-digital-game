import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { crowdedReached, startCrowdedGame } from "./dev-crowded-game.js";
import { SessionStore } from "./session-store.js";

describe("the crowded-table dev game", () => {
  test("three seats, a full play area, two minions, side schemes and a full hand on Doctor Strange's turn", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startCrowdedGame(store);
    expect(store.state.error).toBeNull();
    const game = store.state.game!;
    expect(crowdedReached(game)).toBe(true);
    expect(store.state.legal?.playerId).toBe(game.players[0]!.playerId);
    const invocation = game.players[0]!.separateDecks["Invocation"]!;
    expect(invocation.deck.length).toBeGreaterThan(0);
    expect(invocation.discard.length).toBeGreaterThan(0);
    expect(game.players.every((player) => player.discard.length > 0)).toBe(true);
  }, 120_000);
});
