import { MUT_GEN_SCENARIOS, MOJO_SCENARIOS, type Scenario } from "@mc/content";
import { createGame } from "@mc/engine";
import { WAVE6_CARDS } from "./cards.js";
import { WAVE6_DEPS } from "./index.js";
import { wave6Scenario } from "./setup.js";

/** Scenario builder tests (docs/phase7-wave6.md §8 step 1): no card is scripted yet, so these read the config. */

const PLAYERS = [{ starterDeckId: "colossus-protection" }] as const;
const find = (id: string): Scenario => {
  const record = [...MUT_GEN_SCENARIOS, ...MOJO_SCENARIOS].find((s) => s.id === id);
  if (!record) throw new Error(`no scenario ${id}`);
  return record;
};
const cardCount = (ids: readonly string[], setId: string): number =>
  WAVE6_CARDS.filter((c) => "encounterSetIds" in c && (c.encounterSetIds as readonly string[]).includes(setId))
    .filter((c) => !["villain", "main_scheme"].includes(c.type))
    .reduce((n, c) => n + (ids.filter((id) => id === c.id).length > 0 ? 1 : 0), 0);

const cardStageNumber = (id: string): number | undefined => {
  const card = WAVE6_CARDS.find((c) => c.id === id);
  return card && card.type === "villain" ? card.sides[0]!.stages[0]!.stageNumber : undefined;
};

describe("wave6Scenario: mut_gen standalone scenarios", () => {
  describe.each(["sabretooth", "project-wideawake", "master-mold", "magneto"])("%s", (id) => {
    const record = find(id);
    it.each(["standard", "expert"] as const)(
      "builds in %s mode with the record's villain, scheme and sets",
      (difficulty) => {
        const config = wave6Scenario(id, { players: PLAYERS, seed: 1, difficulty });
        expect(config.villainCardId).toBe(record.villainCardId);
        expect(config.mainSchemeCardId).toBe(record.mainSchemeCardId);
        expect(config.difficulty).toBe(difficulty === "expert" ? "expert" : undefined);
        const villain = WAVE6_CARDS.find((c) => c.id === record.villainCardId);
        const stages = villain && villain.type === "villain" ? villain.sides[0]!.stages : [];
        const [first, last] = record.villainStages[difficulty];
        expect(stages[config.villainStartStageIndex!]?.stageNumber).toBe(first);
        expect(stages[config.villainLastStageIndex!]?.stageNumber).toBe(last);
        const deck = config.encounterDeck ?? [];
        const sets = [
          ...record.encounterSetIds,
          ...record.recommendedModularSetIds,
          ...record.standardEncounterSetIds,
          ...(difficulty === "expert" ? record.expertEncounterSetIds : []),
        ];
        for (const set of sets) expect(cardCount(deck, set), set).toBeGreaterThan(0);
        expect(deck.length).toBeGreaterThan(0);
        expect(createGame(config, WAVE6_DEPS).ok).toBe(true);
      },
    );
  });

  it("expert mode adds Core's Expert set and standard mode does not", () => {
    const standard = wave6Scenario("magneto", { players: PLAYERS, seed: 1 }).encounterDeck!;
    const expert = wave6Scenario("magneto", { players: PLAYERS, seed: 1, difficulty: "expert" }).encounterDeck!;
    expect(cardCount(standard, "expert")).toBe(0);
    expect(cardCount(expert, "expert")).toBeGreaterThan(0);
    expect(expert.length).toBeGreaterThan(standard.length);
  });

  it("Project Wideawake sets its four Captive allies aside (32087a Setup)", () => {
    expect(wave6Scenario("project-wideawake", { players: PLAYERS, seed: 1 }).setAside).toEqual([
      "32089",
      "32090",
      "32091",
      "32092",
    ]);
  });

  it("Sabretooth sets Robert Kelly (32066) aside, and Find the Senator's back face is not dealt as a card of its own", () => {
    const config = wave6Scenario("sabretooth", { players: PLAYERS, seed: 1 });
    expect(config.setAside).toEqual(["32066"]);
    expect(config.encounterDeck).toContain("32065a");
    expect(config.encounterDeck).not.toContain("32065b");
  });

  it("Master Mold sets Magneto (32172b) aside; Magneto sets nothing aside", () => {
    expect(wave6Scenario("master-mold", { players: PLAYERS, seed: 1 }).setAside).toEqual(["32172b"]);
    expect(wave6Scenario("magneto", { players: PLAYERS, seed: 1 }).setAside).toBeUndefined();
  });

  it("honours an explicit modular set choice", () => {
    const config = wave6Scenario("sabretooth", { players: PLAYERS, seed: 1, modularSetIds: ["brotherhood"] });
    expect(cardCount(config.encounterDeck!, "brotherhood")).toBeGreaterThan(0);
    expect(cardCount(config.encounterDeck!, "mystique")).toBe(0);
  });
});

describe("wave6Scenario: MojoMania", () => {
  it.each(["standard", "expert"] as const)("MaGog builds in %s mode with one named genre set", (difficulty) => {
    const config = wave6Scenario("magog", { players: PLAYERS, seed: 1, difficulty, modularSetIds: ["western"] });
    // Expert mode swaps in MaGog's other face (`expertVillains`, 39001b).
    expect(config.villainCardId).toBe(difficulty === "expert" ? "39001b" : "39001a");
    expect(config.mainSchemeCardId).toBe("39002a");
    expect(config.villainStartStageIndex).toBe(0);
    expect(config.villainLastStageIndex).toBe(0);
    expect(cardCount(config.encounterDeck!, "western")).toBeGreaterThan(0);
    expect(cardCount(config.encounterDeck!, "horror")).toBe(0);
    expect(cardCount(config.encounterDeck!, "expert") > 0).toBe(difficulty === "expert");
  });

  it("Spiral builds with three named genre sets", () => {
    const config = wave6Scenario("spiral", {
      players: PLAYERS,
      seed: 1,
      modularSetIds: ["crime", "horror", "western"],
    });
    expect(config.villainCardId).toBe("39012a");
    expect(config.mainSchemeCardId).toBe("39015a");
    for (const set of ["spiral", "crime", "horror", "western"])
      expect(cardCount(config.encounterDeck!, set), set).toBeGreaterThan(0);
  });

  // docs/phase7-wave6.md §3.63, §4 Q44.
  const GENRES = ["crime", "fantasy", "horror", "sci-fi", "sitcom", "western"];
  const genresIn = (deck: readonly string[]): string[] => GENRES.filter((set) => cardCount(deck, set) > 0);

  it("MaGog without a choice draws one random genre set, the same one for the same seed", () => {
    const deck = wave6Scenario("magog", { players: PLAYERS, seed: 7 }).encounterDeck!;
    expect(genresIn(deck)).toHaveLength(1);
    expect(genresIn(wave6Scenario("magog", { players: PLAYERS, seed: 7 }).encounterDeck!)).toEqual(genresIn(deck));
    const seen = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap((seed) =>
        genresIn(wave6Scenario("magog", { players: PLAYERS, seed }).encounterDeck!),
      ),
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  it("Spiral without a choice draws three distinct random genre sets", () => {
    const config = wave6Scenario("spiral", { players: PLAYERS, seed: 3 });
    expect(genresIn(config.encounterDeck!)).toHaveLength(3);
    expect(createGame(config, WAVE6_DEPS).ok).toBe(true);
  });

  it("MaGog's pool is a recommendation: any modular set may be named", () => {
    const config = wave6Scenario("magog", { players: PLAYERS, seed: 1, modularSetIds: ["brotherhood"] });
    expect(cardCount(config.encounterDeck!, "brotherhood")).toBeGreaterThan(0);
    expect(genresIn(config.encounterDeck!)).toEqual([]);
  });

  it("refuses a wrong count, a set outside a restricted pool, or a non-modular set", () => {
    expect(() => wave6Scenario("spiral", { players: PLAYERS, seed: 1, modularSetIds: ["crime"] })).toThrow(/3 modular/);
    expect(() =>
      wave6Scenario("spiral", { players: PLAYERS, seed: 1, modularSetIds: ["crime", "horror", "brotherhood"] }),
    ).toThrow(/not in the scenario's modular set pool/);
    expect(() => wave6Scenario("magog", { players: PLAYERS, seed: 1, modularSetIds: ["standard"] })).toThrow(
      /not a modular set/,
    );
    expect(() => wave6Scenario("magog", { players: PLAYERS, seed: 1, modularSetIds: ["longshot"] })).toThrow(/Q43/);
  });

  it("Longshot is shuffled in on request, on top of the counted modular sets (Q43)", () => {
    const plain = wave6Scenario("spiral", { players: PLAYERS, seed: 5, modularSetIds: ["crime", "horror", "western"] });
    const withLongshot = wave6Scenario("spiral", {
      players: PLAYERS,
      seed: 5,
      modularSetIds: ["crime", "horror", "western"],
      extraModularSetIds: ["longshot"],
    });
    expect(plain.encounterDeck).not.toContain("39071");
    expect(withLongshot.encounterDeck).toContain("39071");
    expect(withLongshot.encounterDeck!.length).toBe(plain.encounterDeck!.length + 1);
    expect(createGame(withLongshot, WAVE6_DEPS).ok).toBe(true);
    expect(() => wave6Scenario("spiral", { players: PLAYERS, seed: 5, extraModularSetIds: ["crime"] })).toThrow(
      /not an extra modular set/,
    );
  });

  it("Longshot can join a Core scenario too, beside its own modular set", () => {
    const config = wave6Scenario("rhino", { players: PLAYERS, seed: 1, extraModularSetIds: ["longshot"] });
    expect(config.encounterDeck).toContain("39071");
    expect(cardCount(config.encounterDeck!, "bomb_scare")).toBeGreaterThan(0);
  });

  describe("Mojo", () => {
    const ONE = [{ starterDeckId: "core-spider-man-justice" }] as const;
    const FOUR = [
      { starterDeckId: "core-spider-man-justice" },
      { starterDeckId: "core-captain-marvel-leadership" },
      { starterDeckId: "core-iron-man-aggression" },
      { starterDeckId: "core-black-panther-protection" },
    ] as const;

    it("builds in standard mode: Mojo I then II, the MojoMania scheme, no genre set shuffled in, 1 + 1 per player set aside", () => {
      const config = wave6Scenario("mojo", { players: ONE, seed: 1 });
      expect(config.villainCardId).toBe("39022");
      expect(config.mainSchemeCardId).toBe("39025a");
      expect(config.villainStartStageIndex).toBe(0);
      expect(config.villainLastStageIndex).toBe(1);
      for (const set of ["mojo", "standard"]) expect(cardCount(config.encounterDeck!, set), set).toBeGreaterThan(0);
      expect(genresIn(config.encounterDeck!)).toEqual([]);
      expect(config.setAsideModularSets).toHaveLength(2);
      expect(createGame(config, WAVE6_DEPS).ok).toBe(true);
    });

    it("builds in expert mode: Mojo II then III, with the expert set", () => {
      const config = wave6Scenario("mojo", { players: ONE, seed: 1, difficulty: "expert" });
      expect(config.villainStartStageIndex).toBe(1);
      expect(config.villainLastStageIndex).toBe(2);
      expect(cardCount(config.encounterDeck!, "expert")).toBeGreaterThan(0);
      expect(createGame(config, WAVE6_DEPS).ok).toBe(true);
    });

    it.each([
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
    ])("%i player(s): %i genre sets are set aside, each distinct and from the six", (players, aside) => {
      const config = wave6Scenario("mojo", { players: [...FOUR].slice(0, players), seed: 5 });
      const sets = config.setAsideModularSets!.map((s) => s.encounterSetId as string);
      expect(sets).toHaveLength(aside);
      expect(new Set(sets).size).toBe(aside);
      for (const set of sets) expect(GENRES).toContain(set);
      // Their cards are set aside, none of them in the encounter deck.
      for (const { cardIds } of config.setAsideModularSets!)
        for (const id of cardIds) expect(config.encounterDeck).not.toContain(id);
    });

    it("the players may name the sets set aside; a wrong count or a set outside the six is refused", () => {
      const config = wave6Scenario("mojo", { players: ONE, seed: 1, setAsideModularSetIds: ["horror", "sitcom"] });
      expect(config.setAsideModularSets!.map((s) => s.encounterSetId)).toEqual(["horror", "sitcom"]);
      expect(() => wave6Scenario("mojo", { players: ONE, seed: 1, setAsideModularSetIds: ["horror"] })).toThrow(
        /expected 2 set-aside/,
      );
      expect(() =>
        wave6Scenario("mojo", { players: ONE, seed: 1, setAsideModularSetIds: ["horror", "brotherhood"] }),
      ).toThrow(/not in the scenario's modular set pool/);
    });

    it("the same seed sets aside the same sets; other seeds set aside others", () => {
      const sets = (seed: number) =>
        wave6Scenario("mojo", { players: ONE, seed })
          .setAsideModularSets!.map((s) => s.encounterSetId)
          .join();
      expect(sets(4)).toBe(sets(4));
      expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map(sets)).size).toBeGreaterThan(1);
    });
  });
});

describe("wave6Scenario: Mansion Attack", () => {
  const VILLAINS_A = ["32121a", "32122a", "32123a", "32124a"];
  const VILLAINS_B = ["32121b", "32122b", "32123b", "32124b"];

  it("standard: the four (a) villains, one in play at random and the rest set aside, the main scheme is the five-stage card", () => {
    const config = wave6Scenario("mansion-attack", { players: PLAYERS, seed: 1, modularSetIds: [] });
    expect(config.randomStartingVillain).toBe(true);
    expect([config.villainCardId, ...(config.setAsideVillainCardIds ?? [])].map(String).sort()).toEqual(VILLAINS_A);
    expect(config.mainSchemeCardId).toBe("32125a");
    expect(config.victory).toBe("cardAbility");
    expect(config.victoryCondition).toBe(2);
    expect(cardCount(config.encounterDeck!, "mansion_attack")).toBeGreaterThan(0);
    expect(cardCount(config.encounterDeck!, "brotherhood")).toBeGreaterThan(0);
  });

  it("the villains and the main scheme are not in the encounter deck, Save the School is (1A's Setup puts it into play)", () => {
    const config = wave6Scenario("mansion-attack", { players: PLAYERS, seed: 1, modularSetIds: [] });
    const deck = (config.encounterDeck ?? []).map(String);
    for (const id of [...VILLAINS_A, ...VILLAINS_B, "32125a"]) expect(deck).not.toContain(id);
    expect(deck).toContain("32130");
  });

  it("expert: the (b) villains replace the (a) villains, and three are needed", () => {
    const config = wave6Scenario("mansion-attack", {
      players: PLAYERS,
      seed: 1,
      difficulty: "expert",
      modularSetIds: [],
    });
    expect([config.villainCardId, ...(config.setAsideVillainCardIds ?? [])].map(String).sort()).toEqual(VILLAINS_B);
    expect(config.victoryCondition).toBe(3);
    expect(config.villainStartStageIndex).toBe(0);
    expect(config.villainLastStageIndex).toBe(0);
    // The (b) cards are stage 2 in the data and the record says [1, 1]: one-stage cards run from their first stage to their last.
    expect(cardStageNumber(config.villainCardId)).toBe(2);
  });

  it("heroic needs all four villains", () => {
    const config = wave6Scenario("mansion-attack", {
      players: PLAYERS,
      seed: 1,
      modes: { heroic: 1 },
      modularSetIds: [],
    });
    expect(config.victoryCondition).toBe(4);
  });
});
