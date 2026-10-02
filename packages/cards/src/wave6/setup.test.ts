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

  it("Master Mold sets Magneto (32172b) aside; the others set nothing aside", () => {
    expect(wave6Scenario("master-mold", { players: PLAYERS, seed: 1 }).setAside).toEqual(["32172b"]);
    for (const id of ["sabretooth", "magneto"]) {
      expect(wave6Scenario(id, { players: PLAYERS, seed: 1 }).setAside, id).toBeUndefined();
    }
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

  it("MaGog and Spiral refuse without a modular choice (§3.63)", () => {
    expect(() => wave6Scenario("magog", { players: PLAYERS, seed: 1 })).toThrow(/not yet supported: §3\.63/);
    expect(() => wave6Scenario("spiral", { players: PLAYERS, seed: 1 })).toThrow(/not yet supported: §3\.63/);
  });

  it("refuses a wrong count or a non-genre set", () => {
    expect(() => wave6Scenario("spiral", { players: PLAYERS, seed: 1, modularSetIds: ["crime"] })).toThrow(/3 modular/);
    expect(() => wave6Scenario("magog", { players: PLAYERS, seed: 1, modularSetIds: ["brotherhood"] })).toThrow(
      /genre set/,
    );
  });

  it("Mojo is not yet supported (§3.63)", () => {
    expect(() => wave6Scenario("mojo", { players: PLAYERS, seed: 1 })).toThrow(/not yet supported: §3\.63/);
  });
});

describe("wave6Scenario: not yet supported", () => {
  it.each(["standard", "expert"] as const)("Mansion Attack throws in %s mode (§3.18)", (difficulty) => {
    expect(() => wave6Scenario("mansion-attack", { players: PLAYERS, seed: 1, difficulty })).toThrow(
      /not yet supported: §3\.18/,
    );
  });
});
