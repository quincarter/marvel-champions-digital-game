import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { startRoutedDevGame } from "./dev-routed-game.js";
import { SessionStore } from "./session-store.js";

describe("the Routed dev game", () => {
  test("a defeated villain sits under Routed and the next villain is in play", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await startRoutedDevGame(store);
    expect(store.state.error).toBeNull();
    const game = store.state.game!;
    const routed = game.villainArea.find((id) => game.instances[id]!.tucked.length > 0)!;
    expect(routed).toBeDefined();
    const under = game.instances[routed]!.tucked;
    expect(under).toHaveLength(1);
    expect(game.activeVillainId).not.toBe(under[0]);
    expect(game.outcome).toBeNull();
    expect(game.step.phase).toBe("player");
  }, 120_000);
});
