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
import {
  chosenVillainOf,
  createGame,
  matchesQuery,
  playerId,
  resolveRef,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { chosenVillain } from "../dsl/index.js";
import { playableScenario } from "../playable/index.js";
import { RANDOM_VILLAIN, playableScenarioOffer, villainChoiceOffer } from "../playable/scenario-options.js";
import { firstLegal, patchInstance, settle } from "../testing/harness.js";
import { defeatWithAttack, withForm } from "../testing/staging.js";
import { WAVE11_CARDS } from "./cards.js";
import { WAVE11_DEPS } from "./index.js";
import {
  WAVE11_GAME_ENCOUNTER_SETS,
  buildWave11Scenario,
  scenarioWithVillain,
  villainChoiceOf,
  villainOptionOf,
  wave11Scenario,
  wave11ScenarioRecord,
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
    const option = (id: string, name: string, card: string) => ({ id, villainSetId: id, name, villainCardId: card });
    expect(villainChoiceOffer(HEIST)).toEqual({
      keyedBy: "set",
      defaultId: "hammerhead",
      defaultSetId: "hammerhead",
      random: false,
      chosenVillain: "inPlay",
      options: [
        option("hammerhead", "Hammerhead", "60086"),
        option("bullseye", "Bullseye", "60065"),
        option("electro", "Electro", "60076"),
        option("purple_man", "Purple Man", "60097"),
        // The card's first face is Bloody Mary; the set names the villain.
        option("typhoid_mary", "Typhoid Mary", "60110b"),
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

/**
 * docs/phase7-shadowland.md §4.1: Shadowland's Dark Protégé set holds six villains, each with five of the set's ten
 * linked cards (RRG 1.8 "Linked", p. 27). Shadows in the Night 1A (65001a): "Set the Dark Protégé encounter set aside.
 * Choose 1 random villain from that set and reveal its side A, then shuffle each card linked to that villain into the
 * encounter deck." Shadow Labyrinth 1A (65038a): the same, "(keep the chosen villain set aside)", against Shifting
 * Corridors (65037).
 */
describe("Shadowland: the card-keyed Dark Protégé villain choice", () => {
  const SITN = wave11ScenarioRecord("shadows-in-the-night");
  const LABYRINTH = wave11ScenarioRecord("shadow-labyrinth");
  const DARK_PROTEGE = SITN.villainOptions!.options;
  const VILLAIN_IDS = DARK_PROTEGE.map((option) => option.villainCardId as string);
  const LINKED_IDS = [...new Set(DARK_PROTEGE.flatMap((option) => option.linkedCardIds ?? []))] as string[];
  const linkedOf = (villain: string): readonly string[] =>
    DARK_PROTEGE.find((option) => option.villainCardId === villain)!.linkedCardIds ?? [];
  const seats = [{ starterDeckId: "core-spider-man-justice" }];
  const buildShadow = (id: string, extra: Partial<Wave11ScenarioOptions> = {}): GameSetupConfig =>
    wave11Scenario(id, { players: seats, seed: 7, ...extra });

  /** Where each copy of `cardId` is: "deck" (any encounter deck), "setAside", "villain" or "other". */
  const whereIs = (s: GameState, cardId: string): string[] =>
    (Object.keys(s.instances) as InstanceId[])
      .filter((id) => (s.instances[id]!.cardId as string) === cardId)
      .map((id) => {
        if (s.villains.some((v) => v.instanceId === id && !v.defeated)) return "villain";
        if (s.encounterSetAside.includes(id)) return "setAside";
        if (Object.values(s.encounterDecks).some((deck) => deck.deck.includes(id))) return "deck";
        return "other";
      });

  /** The chosen villain's five linked cards are each once in the deck; the other five each once set aside. */
  const expectLinkedSplit = (s: GameState, villain: string): void => {
    const own = linkedOf(villain);
    expect(own).toHaveLength(5);
    expect(LINKED_IDS).toHaveLength(10);
    for (const id of LINKED_IDS) expect(whereIs(s, id), id).toEqual([own.includes(id) ? "deck" : "setAside"]);
  };

  const chosenCard = (s: GameState): string => s.instances[chosenVillainOf(s)!]!.cardId as string;
  const chosenMatches = (s: GameState): InstanceId[] =>
    (Object.keys(s.instances) as InstanceId[]).filter((id) =>
      matchesQuery(
        s,
        id,
        { chosenVillain: true },
        { selfInstanceId: null, controllerId: playerId("p1"), event: null, bindings: {}, deps: WAVE11_DEPS },
      ),
    );

  it("the builders read the card-keyed record: no set-keyed swap, a random choice for the engine", () => {
    expect(scenarioWithVillain(SITN)).toBe(SITN);
    expect(villainOptionOf(SITN)?.villainCardId).toBe("65012a");
    expect(() => villainOptionOf(SITN, "dark_protege")).toThrow(/choose one by villainCardId/);
    const random = villainChoiceOf(SITN)!;
    expect(random.pick).toBeUndefined();
    expect(random.chosenVillain).toBe("inPlay");
    expect(random.options.map((option) => option.villainCardId)).toEqual(VILLAIN_IDS);
    expect(villainChoiceOf(SITN, RANDOM_VILLAIN)).toEqual(random);
    expect(villainChoiceOf(SITN, "65014a")!.pick).toBe("65014a");
    expect(villainChoiceOf(LABYRINTH)!.chosenVillain).toBe("setAside");
    expect(() => villainChoiceOf(SITN, "65037")).toThrow(/65037 is not one of its villains/);
    expect(villainChoiceOf(HEIST)).toBeNull();
    expect(() => villainChoiceOf(HEIST, "60065")).toThrow(/not chosen by card here/);
    expect(() => buildShadow("shadows-in-the-night", { villainSetId: "dark_protege" })).toThrow(/villainCardId/);
  });

  it("Fear No Evil's set-keyed path is unchanged: no villainChoice in its config", () => {
    expect(build().villainChoice).toBeUndefined();
    expect(build({ villainSetId: "bullseye" }).villainChoice).toBeUndefined();
    expect(() => build({ villainCardId: "60065" })).toThrow(/not chosen by card here/);
  });

  describe("Shadows in the Night: the chosen villain is the villain, side A", () => {
    it.each(VILLAIN_IDS)(
      "%s picked: it is the villain; its linked cards are in the deck, the rest set aside",
      (pick) => {
        const config = buildShadow("shadows-in-the-night", { villainCardId: pick });
        expect(config.villainCardId).toBe(pick);
        expect(config.villainSide).toBe("A");
        // The set itself is not among the deck's sets: the engine adds the chosen villain's five cards only.
        expect(deckSets(config).has("dark_protege")).toBe(false);
        const s = create(config);
        const villain = s.villains.find((v) => v.instanceId === s.activeVillainId)!;
        expect(villain.cardId).toBe(pick);
        expect(villain.side).toBe("A");
        expect(chosenVillainOf(s)).toBe(villain.instanceId);
        expect(chosenMatches(s)).toEqual([villain.instanceId]);
        for (const other of VILLAIN_IDS)
          expect(whereIs(s, other), other).toEqual([other === pick ? "villain" : "setAside"]);
        expectLinkedSplit(s, pick);
      },
    );

    it("no pick draws one with the game's seed: the same seed the same villain, and the seeds reach several", () => {
      const drawn = (seed: number): string => chosenCard(create(buildShadow("shadows-in-the-night", { seed })));
      expect(create(buildShadow("shadows-in-the-night"))).toEqual(create(buildShadow("shadows-in-the-night")));
      expect(buildShadow("shadows-in-the-night", { villainCardId: RANDOM_VILLAIN })).toEqual(
        buildShadow("shadows-in-the-night"),
      );
      const seen = new Set(Array.from({ length: 12 }, (_, seed) => drawn(seed)));
      expect(seen.size).toBeGreaterThan(1);
      for (const villain of seen) expect(VILLAIN_IDS).toContain(villain);
      for (const seed of [0, 1, 2, 3]) {
        const s = create(buildShadow("shadows-in-the-night", { seed }));
        expect(s.villains[0]!.cardId).toBe(chosenCard(s));
        expectLinkedSplit(s, chosenCard(s));
      }
    });
  });

  describe("Shadow Labyrinth: Shifting Corridors is the villain, the chosen one waits set aside", () => {
    it.each(VILLAIN_IDS)("%s picked: set aside as the chosen villain; its linked cards are in the deck", (pick) => {
      const config = buildShadow("shadow-labyrinth", { villainCardId: pick });
      expect(config.villainCardId).toBe("65037");
      const s = create(config);
      expect(s.villains.filter((v) => !v.defeated).map((v) => v.cardId)).toEqual(["65037"]);
      const chosenId = chosenVillainOf(s)!;
      expect(s.instances[chosenId]!.cardId).toBe(pick);
      expect(s.encounterSetAside).toContain(chosenId);
      expect(chosenMatches(s)).toEqual([chosenId]);
      for (const villain of VILLAIN_IDS) expect(whereIs(s, villain), villain).toEqual(["setAside"]);
      expectLinkedSplit(s, pick);
      // Hidden while set aside (rules expert, reading (a)): the chosen villain and the unchosen linked cards facedown.
      const darkProtege = new Set<string>([...VILLAIN_IDS, ...LINKED_IDS]);
      for (const id of s.encounterSetAside)
        if (darkProtege.has(s.instances[id]!.cardId as string)) expect(s.instances[id]!.faceup, id).toBe(false);
    });

    it("a random draw is seeded and the record's villain never changes", () => {
      const a = create(buildShadow("shadow-labyrinth", { seed: 11 }));
      const b = create(buildShadow("shadow-labyrinth", { seed: 11 }));
      expect(chosenCard(a)).toBe(chosenCard(b));
      expect(a).toEqual(b);
      expect(a.villains[0]!.cardId).toBe("65037");
      expectLinkedSplit(a, chosenCard(a));
    });

    it("the scripts' helper names the chosen villain", () => {
      expect(chosenVillain).toEqual({ kind: "find", query: { chosenVillain: true } });
    });

    it("the scripts' helper resolves to the set-aside chosen villain, and to nothing without a choice", () => {
      const context = {
        selfInstanceId: null,
        controllerId: playerId("p1"),
        event: null,
        bindings: {},
        deps: WAVE11_DEPS,
      };
      for (const pick of ["65013a", "65016a"]) {
        const s = create(buildShadow("shadow-labyrinth", { villainCardId: pick }));
        const found = resolveRef(s, chosenVillain, context);
        expect(found).toEqual([chosenVillainOf(s)]);
        expect(s.instances[found[0]!]!.cardId).toBe(pick);
        expect(s.encounterSetAside).toContain(found[0]);
      }
      const heist = create(build());
      expect(chosenVillainOf(heist)).toBeNull();
      expect(resolveRef(heist, chosenVillain, context)).toEqual([]);
    });
  });

  it("offers the six villains by card name, with random the default", () => {
    const offer = villainChoiceOffer(SITN)!;
    expect(offer).toMatchObject({ keyedBy: "card", defaultId: RANDOM_VILLAIN, random: true, chosenVillain: "inPlay" });
    expect(offer.options.map((option) => [option.id, option.name])).toEqual([
      ["65012a", "Archpriestess"],
      ["65013a", "Daredevil"],
      ["65014a", "Elektra"],
      ["65015a", "Gorgon"],
      ["65016a", "Lady Bullseye"],
      ["65017a", "White Tiger"],
    ]);
    expect(villainChoiceOffer(LABYRINTH)!.chosenVillain).toBe("setAside");
  });
});

describe("the engine refuses a malformed villainChoice", () => {
  const refusal = (config: GameSetupConfig): string => {
    const created = createGame(config, WAVE11_DEPS);
    return created.ok ? "created" : created.error.message;
  };

  it("names the problem", () => {
    const config = wave11Scenario("shadows-in-the-night", {
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 1,
    });
    const choice = config.villainChoice!;
    expect(refusal(config)).toBe("created");
    expect(refusal({ ...config, villainChoice: { ...choice, pick: cardId("65037") } })).toMatch(
      /not one of its villains/,
    );
    expect(refusal({ ...config, villainCardId: cardId("65037") })).toMatch(/must be one of the villainChoice villains/);
    expect(refusal({ ...config, villainChoice: { ...choice, chosenVillain: "setAside" } })).toMatch(
      /cannot be a villainChoice villain set aside/,
    );
    expect(refusal({ ...config, villainChoice: { ...choice, options: [] } })).toMatch(/lists no villain/);
    expect(refusal({ ...config, randomStartingVillain: true })).toMatch(/cannot be used with randomStartingVillain/);
  });
});
