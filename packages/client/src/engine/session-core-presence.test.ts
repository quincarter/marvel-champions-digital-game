import { describe, expect, test } from "vitest";
import { MemoryGameStorage } from "./game-storage.js";
import { EngineSessionCore } from "./session-core.js";
import type { SessionConfig } from "./host.js";

const CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 2026,
};

describe("EngineSessionCore.presenceGame", () => {
  test("is null before a game starts, then names the game by its save id", async () => {
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    expect(core.presenceGame()).toBeNull();
    await core.start(CONFIG);
    const summary = core.presenceGame();
    expect(summary?.game).toMatchObject({ kind: "oneOff", villain: "Rhino" });
    expect(summary?.gameKey).toBeTruthy();
    expect(summary?.gameKey).not.toContain("undefined");
  });

  test("without storage the key falls back to the scenario and seed", async () => {
    const core = new EngineSessionCore({});
    await core.start(CONFIG);
    expect(core.presenceGame()?.gameKey).toBe("rhino:2026");
  });
});
