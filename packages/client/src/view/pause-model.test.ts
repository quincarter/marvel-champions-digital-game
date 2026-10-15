import { describe, expect, test } from "vitest";
import { playableScenarioOffer } from "@mc/cards";
import { POOL_ENCOUNTER_SETS, POOL_SCENARIOS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import type { SessionConfig } from "../engine/host.js";
import { SessionStore } from "../store/session-store.js";
import { blindSheetNamesOf, pauseStatusOf, seedSuffixOf } from "./pause-model.js";

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
    expect(status.seed).toBe(5);
    expect(seedSuffixOf(status)).toBe(" · Seed 5");
  });

  test("falls back to a placeholder scenario name and an em-dash difficulty when there is no config", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start(KLAW_TWO);
    const { game, perspectiveId } = store.state;
    const status = pauseStatusOf(game!, perspectiveId!, null, POOL_SCENARIOS);
    expect(status.scenarioName).toBe("This game");
    expect(status.difficultyLabel).toBe("—");
    expect(seedSuffixOf(status)).toBe("");
  });
});

describe("a Civil War game played blind", () => {
  const BLIND: SessionConfig = {
    scenarioId: "registration-iron-man",
    difficulty: "standard",
    players: [{ starterDeckId: "tigra-aggression" }],
    seed: 3,
    blind: true,
    mainSchemeStageIds: ["56121b", "56123b"],
    modularSetIds: ["paladin", "cape_killer", "bomb_scare"],
  };

  test("the status carries the blind sheet with stage 2 and every set hidden at the deal, and names stage 1", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start(BLIND);
    const { game, perspectiveId, config } = store.state;
    const names = blindSheetNamesOf(
      playableScenarioOffer("registration-iron-man"),
      new Map(POOL_ENCOUNTER_SETS.map((set) => [set.id as string, set.name])),
    );
    const sheet = pauseStatusOf(game!, perspectiveId!, config, POOL_SCENARIOS, names).blindSheet!;
    expect(sheet).toHaveLength(3);
    expect(sheet[0]).toMatch(/^Stage 1: .+/);
    expect(sheet[0]).not.toContain("56121b");
    expect(sheet[1]).toBe("Stage 2: hidden");
    // Nothing of the sets has turned up at the deal: no name, only a count.
    expect(sheet[2]).toBe("Modular sets: 3 hidden");
  });

  test("a game that is not blind has no sheet", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start(KLAW_TWO);
    const { game, perspectiveId, config } = store.state;
    const names = blindSheetNamesOf(null, new Map());
    expect(pauseStatusOf(game!, perspectiveId!, config, POOL_SCENARIOS, names).blindSheet).toBeUndefined();
  });

  test("blindSheetNamesOf prints an unknown id as itself", () => {
    const names = blindSheetNamesOf(null, new Map([["paladin", "Paladin"]]));
    expect(names.set("paladin")).toBe("Paladin");
    expect(names.set("unknown_set")).toBe("unknown_set");
    expect(names.stage("56121b")).toBe("56121b");
  });
});
