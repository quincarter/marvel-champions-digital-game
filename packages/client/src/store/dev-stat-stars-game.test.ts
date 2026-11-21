import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "./session-store.js";
import { STAT_STAR_ALLIES, startStatStarsGame, type StatStarAlly } from "./dev-stat-stars-game.js";

describe("the stat-stars dev fixture (issue #935)", () => {
  test.each(Object.keys(STAT_STAR_ALLIES) as StatStarAlly[])("puts %s in play on the first turn", async (ally) => {
    const store = new SessionStore(new LocalEngineHost());
    const id = await startStatStarsGame(store, ally);
    expect(id).not.toBeNull();
    expect(store.state.game!.players[0]!.playArea).toContain(id);
  });
});
