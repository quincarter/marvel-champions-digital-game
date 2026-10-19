import {
  cardId,
  encounterSetId,
  scenarioId,
  setCode,
  validateScenario,
  validateScenarioVillainOptions,
  type AnyCard,
  type Scenario,
  type VillainOption,
} from "@mc/content";
import { createGame, type GameSetupConfig, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { playableScenario } from "../playable/index.js";
import { playableScenarioOffer, villainChoiceOffer } from "../playable/scenario-options.js";
import { firstLegal, patchInstance, settle } from "../testing/harness.js";
import { defeatWithAttack, withForm } from "../testing/staging.js";
import { WAVE11_CARDS } from "./cards.js";
import { WAVE11_DEPS } from "./index.js";
import {
  WAVE11_GAME_ENCOUNTER_SETS,
  buildWave11Scenario,
  scenarioWithVillain,
  villainOptionOf,
  type Wave11ScenarioOptions,
} from "./setup.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * docs/phase7-wave11-scenarios.md §S3.3: the underling villain as a scenario option. MC60 p. 5: "five of this
 * expansion's scenarios combine one of five interchangeable main schemes with one of the five interchangeable villains".
 * The fixture is Art Museum Heist as §S1.1 describes it (the box's records are a later data task), against the real
 * villain sets: Hammerhead (the default, MC60 p. 8's first), Bullseye, Electro, Purple Man and Typhoid Mary.
 */

const option = (set: string, card: string, extra: Partial<VillainOption> = {}): VillainOption => ({
  villainSetId: encounterSetId(set),
  villainCardId: cardId(card),
  villainStages: { standard: [1, 2], expert: [2, 3] },
  ...extra,
});

const HEIST: Scenario = {
  id: scenarioId("art-museum-heist"),
  name: "Art Museum Heist",
  packCode: setCode("fne"),
  villainCardId: cardId("60086"),
  mainSchemeCardId: cardId("60121a"),
  encounterSetIds: [encounterSetId("hammerhead"), encounterSetId("art_museum_heist")],
  recommendedModularSetIds: [encounterSetId("cops"), encounterSetId("the_owl")],
  standardEncounterSetIds: [encounterSetId("standard")],
  expertEncounterSetIds: [encounterSetId("expert")],
  villainStages: { standard: [1, 2], expert: [2, 3] },
  modularSetCount: 2,
  villainOptions: {
    defaultSetId: encounterSetId("hammerhead"),
    options: [
      option("hammerhead", "60086"),
      option("bullseye", "60065"),
      option("electro", "60076"),
      option("purple_man", "60097"),
      // MC60 p. 5: Typhoid Mary A (standard) / B (expert); Disturbed Psyche 60112 wins the game.
      option("typhoid_mary", "60110b", { villainStages: { standard: [1, 1], expert: [2, 2] }, victory: "cardAbility" }),
    ],
  },
};

const VILLAINS = ["hammerhead", "bullseye", "electro", "purple_man", "typhoid_mary"] as const;
const byId = new Map<string, AnyCard>(WAVE11_CARDS.map((card) => [card.id as string, card]));

const build = (options: Partial<Wave11ScenarioOptions> = {}): GameSetupConfig =>
  buildWave11Scenario(HEIST, { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 3, ...options });

function create(config: GameSetupConfig): GameState {
  const created = createGame(config, WAVE11_DEPS);
  if (!created.ok) throw new Error(`${created.error.code}: ${created.error.message}`);
  return created.state;
}

/** The encounter sets the config's encounter deck draws from, each once. */
const deckSets = (config: GameSetupConfig): Set<string> =>
  new Set(
    (config.encounterDeck ?? []).flatMap((id) => {
      const card = byId.get(id as string);
      return card && "encounterSetIds" in card ? (card.encounterSetIds as readonly string[]) : [];
    }),
  );

describe("the fixture record", () => {
  it("passes the schema and card checks", () => {
    expect(validateScenario(HEIST).errors).toEqual([]);
    expect(validateScenarioVillainOptions(HEIST, WAVE11_CARDS, WAVE11_GAME_ENCOUNTER_SETS).errors).toEqual([]);
  });
});

describe("villainOptionOf and scenarioWithVillain", () => {
  it("absent is the default; the record is unchanged for it", () => {
    expect(villainOptionOf(HEIST)?.villainSetId).toBe("hammerhead");
    expect(scenarioWithVillain(HEIST)).toEqual(HEIST);
    expect(scenarioWithVillain(HEIST, "hammerhead")).toEqual(HEIST);
  });

  it("swaps in the option's villain card, set, stages and victory, keeping the scenario set", () => {
    const mary = scenarioWithVillain(HEIST, "typhoid_mary");
    expect(mary.villainCardId).toBe("60110b");
    expect(mary.encounterSetIds).toEqual(["typhoid_mary", "art_museum_heist"]);
    expect(mary.villainStages).toEqual({ standard: [1, 1], expert: [2, 2] });
    expect(mary.victory).toBe("cardAbility");
    expect(scenarioWithVillain(HEIST, "bullseye").victory).toBeUndefined();
  });

  it("refuses a sixth set, and any set at a scenario whose villain is not a choice", () => {
    expect(() => villainOptionOf(HEIST, "kingpin")).toThrow(
      "Art Museum Heist: kingpin is not one of its villains (hammerhead, bullseye, electro, purple_man, typhoid_mary)",
    );
    expect(() => build({ villainSetId: "kingpin" })).toThrow(/kingpin is not one of its villains/);
    const { villainOptions: _options, ...fixed } = HEIST;
    expect(villainOptionOf(fixed)).toBeNull();
    expect(() =>
      buildWave11Scenario(fixed, {
        players: [{ starterDeckId: "core-spider-man-justice" }],
        seed: 1,
        villainSetId: "bullseye",
      }),
    ).toThrow("Art Museum Heist: the villain is not a setup choice (no villainOptions), got bullseye");
  });
});

describe("buildWave11Scenario: each villain against Art Museum Heist", () => {
  const cases = VILLAINS.flatMap((set) => (["standard", "expert"] as const).map((mode) => [set, mode] as const));

  it.each(cases)(
    "%s, %s: the villain's card, stages and set; no other villain's set; the game is created",
    (set, mode) => {
      const config = build({ villainSetId: set, difficulty: mode });
      const chosen = villainOptionOf(HEIST, set)!;
      expect(config.villainCardId).toBe(chosen.villainCardId);
      const [first, last] = chosen.villainStages[mode];
      expect([config.villainStartStageIndex, config.villainLastStageIndex]).toEqual([first - 1, last - 1]);
      const sets = deckSets(config);
      for (const other of VILLAINS) expect(sets.has(other), other).toBe(other === set);
      for (const own of ["art_museum_heist", "cops", "the_owl", "standard"]) expect(sets.has(own), own).toBe(true);
      expect(sets.has("expert")).toBe(mode === "expert");
      expect(config.difficulty).toBe(mode === "expert" ? "expert" : undefined);
      expect(config.victory).toBe(set === "typhoid_mary" ? "cardAbility" : undefined);
      // No villain or main scheme card is dealt, and a double-sided card once (Establish Trust / Mary Walker 60113a/b).
      for (const id of config.encounterDeck) expect(["villain", "main_scheme"]).not.toContain(byId.get(id)!.type);
      expect(config.encounterDeck).not.toContain("60113b");
      const state = create(config);
      const villain = state.villains.find((v) => v.instanceId === state.activeVillainId)!;
      expect(state.instances[villain.instanceId]!.cardId).toBe(chosen.villainCardId);
      expect(state.scenarioRules.victory).toBe(chosen.victory ?? "finalVillainStage");
    },
  );

  it("no villainSetId builds the same game as the default's set", () => {
    expect(build()).toEqual(build({ villainSetId: "hammerhead" }));
  });
});

describe("Typhoid Mary's game is won by three tokens on Disturbed Psyche, not by the villain deck", () => {
  const psyche = (s: GameState): InstanceId =>
    (Object.keys(s.instances) as InstanceId[]).find((id) => (s.instances[id]!.cardId as string) === "60112")!;
  const strike = (s: GameState): GameState =>
    defeatWithAttack(
      WAVE11_DEPS,
      patchInstance(s, s.players[0]!.identity.instanceId, { exhausted: false }),
      s.activeVillainId!,
    );

  it("each defeat of the villain places a token instead; the third wins", () => {
    const config = build({ villainSetId: "typhoid_mary" });
    const settled = settle(create(config), firstLegal, (st) => st.step.phase === "player", WAVE11_DEPS);
    const s = withForm(settled, { heroForm: 0 });
    expect(s.scenarioRules.victory).toBe("cardAbility");
    const two = strike(strike(s));
    expect(two.outcome).toBeNull();
    expect(two.instances[psyche(two)]!.damage).toBe(2);
    expect(strike(two).outcome).toMatchObject({ result: "win" });
  });
});

describe("the villain choice offered to a setup screen", () => {
  it("lists the five villains by set name, in printed order, with the default", () => {
    expect(villainChoiceOffer(HEIST)).toEqual({
      defaultSetId: "hammerhead",
      options: [
        { villainSetId: "hammerhead", name: "Hammerhead", villainCardId: "60086" },
        { villainSetId: "bullseye", name: "Bullseye", villainCardId: "60065" },
        { villainSetId: "electro", name: "Electro", villainCardId: "60076" },
        { villainSetId: "purple_man", name: "Purple Man", villainCardId: "60097" },
        // The card's first face is Bloody Mary; the set names the villain.
        { villainSetId: "typhoid_mary", name: "Typhoid Mary", villainCardId: "60110b" },
      ],
    });
  });

  it("is null at a scenario whose villain is fixed, and playableScenario refuses a villain there", () => {
    expect(playableScenarioOffer("rhino").villains).toBeNull();
    const seats = [{ starterDeckId: "core-spider-man-justice" }];
    expect(() => playableScenario("rhino", { players: seats, seed: 1, villainSetId: "bullseye" })).toThrow(
      "rhino: the villain is not a setup choice here",
    );
    expect(() => playableScenario("rhino", { players: seats, seed: 1, mainSchemePicks: ["01097"] })).toThrow(
      "rhino: there is one main scheme, not one per player",
    );
  });
});
