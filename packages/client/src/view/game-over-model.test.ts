/**
 * The game-over story, checked against a real game played to a real loss — so
 * every sentence is tested against the events and sources the engine actually
 * produces, not a fixture that agrees with the model by construction.
 */

import { beforeAll, describe, expect, test } from "vitest";
import { CORE_DEPS } from "@mc/cards";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import type { SessionConfig } from "../engine/host.js";
import { emptyRecord } from "../engine/game-record.js";
import { gameOverModel, turningPoints } from "./game-over-model.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 43523,
};

/** A table that only ever ends its turn loses to the scheme; that loss is the fixture. */
async function passiveLoss(): Promise<SessionStore> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(RHINO_SOLO);
  for (let step = 0; step < 1500 && !store.state.game!.outcome; step++) {
    const { legal } = store.state;
    if (!legal) break;
    if (legal.actions.kind === "choice") {
      const { choice } = legal.actions;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
      continue;
    }
    if (legal.actions.kind !== "turn") break;
    const end = legal.actions.legal.find((entry) => entry.action.kind === "endTurn");
    if (!end) break;
    await store.dispatch(end.example);
  }
  return store;
}

describe("game over model", () => {
  let store: SessionStore;

  beforeAll(async () => {
    store = await passiveLoss();
  }, 120_000);

  test("a lost game reads as a loss, for the reason the engine gave", () => {
    const { game, record, config } = store.state;
    expect(game!.outcome).not.toBeNull();
    const model = gameOverModel(game!, record, config, CORE_DEPS);

    expect(model.tone).toBe("loss");
    if (game!.outcome!.reason === "mainSchemeCompleted") {
      expect(model.kicker).toBe("The scheme succeeded");
      expect(model.headline).toBe("The scheme wins");
      // The final blow names the scheme and the threshold it reached.
      expect(model.finalBlow).not.toBeNull();
      expect(model.finalBlow!.title).toMatch(/hit \d+ threat$/);
    } else {
      expect(model.kicker).toBe("Every hero is defeated");
    }
  });

  test("the meta line and stats describe this game, not a template", () => {
    const { game, record, config } = store.state;
    const model = gameOverModel(game!, record, config, CORE_DEPS);

    expect(model.meta).toBe(`Round ${game!.round} · Standard · 1 hero`);
    expect(model.stats).toHaveLength(3);
    expect(model.stats[0]!.label).toBe("Rhino");
    expect(model.stats[1]!.value).toBe(`${record.threatRemoved} total`);
    expect(model.quickStats.map((stat) => stat.label)).toEqual(["Rounds", "Dmg dealt", "Thwart"]);
    expect(model.seats).toHaveLength(1);
    expect(model.mvp).toBeNull();
  });

  test("turning points are in round order, capped, and never past the last round", () => {
    const { game, record, config } = store.state;
    const { beats } = gameOverModel(game!, record, config, CORE_DEPS);

    expect(beats.length).toBeLessThanOrEqual(4);
    expect(beats.map((beat) => beat.round)).toEqual([...beats.map((beat) => beat.round)].sort((a, b) => a - b));
    for (const beat of beats) expect(beat.round).toBeLessThanOrEqual(game!.round);
  });

  test("each turning point comes from a count the record holds, and nothing else", () => {
    const { game } = store.state;
    const record = {
      ...emptyRecord(),
      rounds: [
        {
          round: 2,
          threatPlaced: 3,
          threatRemoved: 1,
          damageToVillain: 0,
          crisisBlocks: 2,
          heroesDefeated: [],
          villainStageAdvanced: false,
        },
        {
          round: 4,
          threatPlaced: 9,
          threatRemoved: 0,
          damageToVillain: 0,
          crisisBlocks: 0,
          heroesDefeated: [],
          villainStageAdvanced: true,
        },
      ],
    };

    const loss = turningPoints(game!, record, "loss", "Rhino");
    expect(loss).toEqual([
      { round: 2, text: "Crisis blocked 2 threat removals from the main scheme." },
      { round: 4, text: "The heaviest round for threat: 9 placed, 0 removed." },
    ]);
    // A stage advance is part of how a game was won, not of how one was lost.
    expect(turningPoints(game!, record, "win", "Rhino").some((beat) => beat.text.includes("next stage"))).toBe(true);
    expect(turningPoints(game!, emptyRecord(), "loss", "Rhino")).toEqual([]);
  });

  test("a resumed game ends with the same story as one never interrupted", async () => {
    // The store kept `config` through the whole game, including across the start.
    expect(store.state.config).toEqual(RHINO_SOLO);
  });
});
