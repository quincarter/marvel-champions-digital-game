/**
 * Heroic and skirmish modes through `playableScenario` (RRG 1.8 "Modes of Play", p. 29; issue #611), and which scenarios
 * offer skirmish (`skirmishOffer`).
 */

import { CORE_STARTER_DECKS, type PlayModes } from "@mc/content";
import { createGame } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_SCENARIO_RECORDS } from "../modular-pool.js";
import { PLAYABLE_DEPS, playableScenario } from "./index.js";
import { playableScenarioOffer } from "./scenario-options.js";
import { firstLegal, settle } from "../testing/harness.js";

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

  it.each([-1, 1.5, Infinity])("refuses heroic level %s at the engine's own door", (heroicLevel) => {
    const game = createGame({ ...build("rhino", {}), heroicLevel }, PLAYABLE_DEPS);
    expect(game.ok).toBe(false);
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

  describe("at Fear No Evil, against the chosen Underling villain (MC60 p. 5; issue #995)", () => {
    const UNDERLING_SCENARIOS = [
      "art-museum-heist",
      "the-getaway",
      "protection-racket",
      "the-raft-breakout",
      "stop-the-presses",
    ];

    it.each(UNDERLING_SCENARIOS)("offers the chosen villain's versions at %s", (scenarioId) => {
      expect(playableScenarioOffer(scenarioId).skirmish).toEqual({ versions: ["1", "2"], printed: false });
      expect(playableScenarioOffer(scenarioId, { villainSetId: "electro", modes: { expert: true } }).skirmish).toEqual({
        versions: ["2", "3"],
        printed: false,
      });
      // Typhoid Mary is one double-sided card that wins by its own text: nothing to shorten.
      expect(playableScenarioOffer(scenarioId, { villainSetId: "typhoid_mary" }).skirmish).toBeNull();
      expect(() =>
        playableScenario("art-museum-heist", {
          players: seats,
          seed: 1,
          villainSetId: "typhoid_mary",
          modes: { skirmish: { villainVersion: "1" } },
        }),
      ).toThrow(/no skirmish mode/);
    });

    it("plays Electro III without Electric Charge, which only stages I and II find (RRG 1.8 p. 29)", () => {
      // Skirmish puts "only the chosen version" into play: Electro III's When Revealed places counters on Electric
      // Charge but never finds it, so the Permanent card stays set aside and Electro's charge effects do nothing.
      const charge = (villainVersion: string) => {
        const config = playableScenario("art-museum-heist", {
          players: seats,
          seed: 1,
          villainSetId: "electro",
          modes: { expert: true, skirmish: { villainVersion } },
        });
        const game = createGame(config, PLAYABLE_DEPS);
        if (!game.ok) throw new Error("no game");
        // Through setup to the first player turn.
        const state = settle(game.state, firstLegal, (s) => s.step.phase === "player", PLAYABLE_DEPS);
        const villain = state.villains[0]!;
        const card = Object.values(state.instances).find((i) => (i.cardId as string) === "60079");
        return { stage: villain.stageIndex, attachedTo: card?.attachedTo ?? null, villainId: villain.instanceId, card };
      };
      const two = charge("2");
      expect(two.stage).toBe(1);
      expect(two.attachedTo).toBe(two.villainId);
      expect(two.card?.counters["charge"]).toBe(2);
      const three = charge("3");
      expect(three.stage).toBe(2);
      expect(three.attachedTo).toBeNull();
      expect(three.card?.counters["charge"] ?? 0).toBe(0);
    });

    it("is not offered at Kingpin, one double-sided villain card per mode", () => {
      expect(playableScenarioOffer("kingpin").skirmish).toBeNull();
    });

    it("sets up a game at every villain and version, in both difficulties", () => {
      for (const villainSetId of ["hammerhead", "bullseye", "electro", "purple_man"])
        for (const expert of [{}, { expert: true as const }]) {
          const offer = playableScenarioOffer("art-museum-heist", { villainSetId, modes: expert }).skirmish;
          expect(offer?.versions.length, villainSetId).toBe(2);
          for (const villainVersion of offer!.versions) {
            const config = playableScenario("art-museum-heist", {
              players: seats,
              seed: 1,
              villainSetId,
              modes: { ...expert, skirmish: { villainVersion } },
            });
            const label = `${villainSetId} ${villainVersion}`;
            expect(config.villainStartStageIndex, label).toBe(Number(villainVersion) - 1);
            expect(config.villainLastStageIndex, label).toBe(Number(villainVersion) - 1);
            expect(createGame(config, PLAYABLE_DEPS).ok, label).toBe(true);
          }
        }
    });
  });

  it("sets up a game at every scenario and version, in both difficulties", () => {
    for (const scenario of PLAYABLE_SCENARIO_RECORDS) {
      for (const expert of [{}, { expert: true as const }]) {
        const offer = playableScenarioOffer(scenario.id, { modes: expert }).skirmish;
        for (const villainVersion of offer?.versions ?? []) {
          const config = build(scenario.id, { ...expert, heroic: 2, skirmish: { villainVersion } });
          expect(config.villainStartStageIndex, scenario.id).toBe(Number(villainVersion) - 1);
          expect(config.villainLastStageIndex, scenario.id).toBe(Number(villainVersion) - 1);
          const game = createGame(config, PLAYABLE_DEPS);
          expect(game.ok && game.state.scenarioRules.heroicLevel, scenario.id).toBe(2);
        }
      }
    }
  });
});
