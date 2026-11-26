import { describe, expect, test } from "vitest";
import { optionEngagedNamesOf } from "../view/choice-tile-notes.js";
import { playerName } from "../view/names.js";
import { startEngagedTargetGame } from "./dev-engaged-target-game.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "./session-store.js";

describe("the engaged-target dev game (issue #1001)", () => {
  test("stops on Repulsor Blast's choose-an-enemy with each seat's Drone, each named for its seat", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startEngagedTargetGame(store);
    expect(store.state.error).toBeNull();
    const game = store.state.game!;
    const choice = store.state.legal?.actions.kind === "choice" ? store.state.legal.actions.choice : null;
    expect(choice?.prompt.kind).toBe("chooseTarget");
    const names = optionEngagedNamesOf(game, choice!);
    expect([...names.values()].sort()).toEqual(game.players.map((seat) => playerName(game, seat.playerId)).sort());
  }, 120_000);
});
