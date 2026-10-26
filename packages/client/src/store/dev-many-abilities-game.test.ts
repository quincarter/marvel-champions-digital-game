import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { MANY_ABILITIES, startManyAbilitiesGame, usableAbilityCount, wantedInPlay } from "./dev-many-abilities-game.js";
import { SessionStore } from "./session-store.js";

describe("the many-abilities dev game", () => {
  test("Captain Marvel's turn with five or more usable abilities on the table", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startManyAbilitiesGame(store);
    expect(store.state.error).toBeNull();
    const game = store.state.game!;
    expect(store.state.legal?.playerId).toBe(game.players[0]!.playerId);
    expect(wantedInPlay(game)).toBeGreaterThanOrEqual(3);
    expect(usableAbilityCount(store)).toBeGreaterThanOrEqual(MANY_ABILITIES);
  }, 120_000);
});
