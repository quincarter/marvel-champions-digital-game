/**
 * Heroic and skirmish modes through `playableScenario` (RRG 1.8 "Modes of Play", p. 29; issue #611), and which scenarios
 * offer skirmish (`skirmishOffer`).
 */

import { CORE_STARTER_DECKS, type PlayModes } from "@mc/content";
import { describe, expect, it } from "vitest";
import { PLAYABLE_SCENARIO_RECORDS } from "../modular-pool.js";
import { playableScenario } from "./index.js";
import { playableScenarioOffer } from "./scenario-options.js";

const seats = [{ starterDeckId: CORE_STARTER_DECKS[0]!.id }];
const build = (scenarioId: string, modes: PlayModes) =>
  playableScenario(scenarioId, { players: seats, seed: 1, modes });

describe("heroic mode", () => {
  it("reaches the engine as the heroic level, and combines with expert", () => {
    expect(build("rhino", { heroic: 2 }).heroicLevel).toBe(2);
    const expert = build("rhino", { heroic: 1, expert: true });
    expect(expert.heroicLevel).toBe(1);
    expect(expert.difficulty).toBe("expert");
  });

  it("does not make the game expert: the villain deck is the standard one", () => {
    const plain = build("rhino", {});
    const heroic = build("rhino", { heroic: 4 });
    expect(heroic.villainStartStageIndex).toBe(plain.villainStartStageIndex);
    expect(heroic.villainLastStageIndex).toBe(plain.villainLastStageIndex);
    expect(heroic.encounterDeck).toEqual(plain.encounterDeck);
    expect(plain.heroicLevel).toBeUndefined();
  });

  it("refuses a level that is not a whole number", () => {
    expect(() => build("rhino", { heroic: 1.5 })).toThrow(/whole number/);
    expect(() => build("rhino", { heroic: -1 })).toThrow(/whole number/);
  });
});

describe("skirmish mode", () => {
  it("puts only the chosen version in the villain deck", () => {
    const config = build("rhino", { skirmish: { villainVersion: "2" } });
    expect(config.villainStartStageIndex).toBe(1);
    expect(config.villainLastStageIndex).toBe(1);
  });

  it("offers the stages of the mode being played", () => {
    expect(playableScenarioOffer("rhino").skirmish).toEqual({ versions: ["1", "2"], printed: false });
    expect(playableScenarioOffer("rhino", { modes: { expert: true } }).skirmish).toEqual({
      versions: ["2", "3"],
      printed: false,
    });
    const expert = build("rhino", { expert: true, skirmish: { villainVersion: "3" } });
    expect(expert.villainStartStageIndex).toBe(2);
    expect(expert.difficulty).toBe("expert");
  });

  it("refuses a version the modes do not use", () => {
    expect(() => build("rhino", { skirmish: { villainVersion: "3" } })).toThrow(/not one of/);
    expect(() => build("rhino", { skirmish: {} })).toThrow(/not one of/);
  });

  it("uses the printed rule with no choice where the rulebook has one", () => {
    expect(playableScenarioOffer("loki").skirmish).toEqual({ versions: [], printed: true });
    expect(playableScenarioOffer("mansion-attack").skirmish).toEqual({ versions: [], printed: true });
    expect(playableScenarioOffer("four-horsemen").skirmish).toEqual({ versions: [], printed: true });
    expect(build("loki", { skirmish: {} }).victoryCondition).toBe(1);
    expect(build("mansion-attack", { skirmish: {} }).victoryCondition).toBe(1);
  });

  it.each(["kang", "apocalypse", "god-of-lies", "breakout", "sinister-six", "tower-defense", "batroc"])(
    "is not offered at %s, where one version cannot stand alone or there is nothing to shorten",
    (scenarioId) => {
      expect(playableScenarioOffer(scenarioId).skirmish).toBeNull();
      expect(() => build(scenarioId, { skirmish: {} })).toThrow(/no skirmish mode/);
    },
  );

  it("builds at every scenario that offers a version", () => {
    for (const scenario of PLAYABLE_SCENARIO_RECORDS) {
      const offer = playableScenarioOffer(scenario.id).skirmish;
      for (const villainVersion of offer?.versions ?? []) {
        const config = build(scenario.id, { skirmish: { villainVersion } });
        expect(config.villainStartStageIndex, scenario.id).toBe(config.villainLastStageIndex);
      }
    }
  });
});
