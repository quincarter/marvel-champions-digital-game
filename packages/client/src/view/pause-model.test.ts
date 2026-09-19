import { describe, expect, test } from "vitest";
import { POOL_SCENARIOS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import type { SessionConfig } from "../engine/host.js";
import { SessionStore } from "../store/session-store.js";
import { pauseStatusOf } from "./pause-model.js";

const KLAW_TWO: SessionConfig = {
  scenarioId: "klaw",
  difficulty: "expert",
  players: [{ starterDeckId: "core-she-hulk-aggression" }, { starterDeckId: "core-black-panther-protection" }],
  seed: 5,
};

describe("pauseStatusOf", () => {
  test("names the scenario, difficulty, round, phase and seat from a live game", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start(KLAW_TWO);
    const { game, perspectiveId, config } = store.state;
    expect(game).not.toBeNull();
    expect(perspectiveId).not.toBeNull();

    const status = pauseStatusOf(game!, perspectiveId!, config, POOL_SCENARIOS);
    expect(status.scenarioName).toBe("Klaw");
    expect(status.difficultyLabel).toBe("Expert");
    expect(status.round).toBe(game!.round);
    expect(["Setup", "Player phase", "Villain phase"]).toContain(status.phaseLabel);
    expect(status.seatLabel.length).toBeGreaterThan(0);
  });

  test("falls back to a placeholder scenario name and an em-dash difficulty when there is no config", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start(KLAW_TWO);
    const { game, perspectiveId } = store.state;
    const status = pauseStatusOf(game!, perspectiveId!, null, POOL_SCENARIOS);
    expect(status.scenarioName).toBe("This game");
    expect(status.difficultyLabel).toBe("—");
  });
});
