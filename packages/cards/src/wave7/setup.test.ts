import { WAVE7_SCENARIOS, type Scenario } from "@mc/content";
import { createGame } from "@mc/engine";
import { WAVE7_CARDS } from "./cards.js";
import { WAVE7_DEPS } from "./index.js";
import { wave7Scenario } from "./setup.js";

/** Scenario builder tests: no wave 7 card is scripted yet, so these read the config and that `createGame` accepts it. */

const PLAYERS = [{ starterDeckId: "cable-leadership" }] as const;
const SCENARIOS = ["morlock-siege", "on-the-run", "juggernaut", "mister-sinister", "stryfe"] as const;
const find = (id: string): Scenario => {
  const record = WAVE7_SCENARIOS.find((s) => s.id === id);
  if (!record) throw new Error(`no scenario ${id}`);
  return record;
};
/** How many distinct cards of `setId` are in `ids` (the scenario's deck or its set-aside list). */
const cardCount = (ids: readonly string[], setId: string): number =>
  WAVE7_CARDS.filter(
    (c) =>
      "encounterSetIds" in c &&
      (c.encounterSetIds as readonly string[]).includes(setId) &&
      !["villain", "main_scheme"].includes(c.type) &&
      ids.includes(c.id),
  ).length;

describe("wave7Scenario", () => {
  it("covers exactly the five box scenarios, and none is refused at the scaffold", () => {
    expect(WAVE7_SCENARIOS.map((s) => s.id).sort()).toEqual([...SCENARIOS].sort());
  });

  describe.each(SCENARIOS)("%s", (id) => {
    const record = find(id);
    it.each(["standard", "expert"] as const)("builds in %s mode with the record's villain, scheme and sets", (mode) => {
      const config = wave7Scenario(id, { players: PLAYERS, seed: 1, difficulty: mode });
      const expert = mode === "expert";
      expect(config.villainCardId).toBe(
        expert && record.expertVillains ? record.expertVillains.villainCardId : record.villainCardId,
      );
      expect(config.mainSchemeCardId).toBe(record.mainSchemeCardId);
      expect(config.difficulty).toBe(expert ? "expert" : undefined);
      const villain = WAVE7_CARDS.find((c) => c.id === config.villainCardId);
      const stages = villain && villain.type === "villain" ? villain.sides[0]!.stages : [];
      if (!record.expertVillains) {
        const [first, last] = record.villainStages[mode];
        expect(stages[config.villainStartStageIndex!]?.stageNumber).toBe(first);
        expect(stages[config.villainLastStageIndex!]?.stageNumber).toBe(last);
      }
      // The scenario's own set, the Standard set (and Expert in expert mode) and the modular sets; Marauders, which
      // holds only villains, is never dealt.
      const deck = config.encounterDeck ?? [];
      const aside = (config.setAside ?? []) as readonly string[];
      const dealtOrAside = [...deck, ...aside];
      const sets = [
        ...record.encounterSetIds.filter((set) => set !== "marauders"),
        ...record.recommendedModularSetIds,
        ...record.standardEncounterSetIds,
        ...(expert ? record.expertEncounterSetIds : []),
      ];
      for (const set of sets) expect(cardCount(dealtOrAside, set), set).toBeGreaterThan(0);
      for (const set of sets.filter((s) => !(config.setAside ?? []).some((a) => cardCount([a], s) > 0)))
        expect(cardCount(deck, set), set).toBeGreaterThan(0);
      if (!expert) expect(cardCount(deck, "expert")).toBe(0);
      expect(createGame(config, WAVE7_DEPS).ok).toBe(true);
    });
  });

  it("every set-aside card is set aside and not also dealt", () => {
    for (const id of SCENARIOS) {
      const config = wave7Scenario(id, { players: PLAYERS, seed: 1 });
      for (const cardId of find(id).setAsideCardIds ?? []) {
        expect(config.setAside, `${id} ${cardId}`).toContain(cardId);
        expect(config.encounterDeck, `${id} ${cardId}`).not.toContain(cardId);
      }
    }
  });

  describe("the Marauders scenarios", () => {
    const VILLAINS = ["40070", "40071", "40072", "40073", "40074", "40075", "40076"];
    it.each(["standard", "expert"] as const)(
      "Morlock Siege draws its villain at random from the set-aside Marauders (%s)",
      (mode) => {
        const config = wave7Scenario("morlock-siege", { players: PLAYERS, seed: 1, difficulty: mode });
        const face = mode === "expert" ? "b" : "a";
        expect(config.randomStartingVillain).toBe(true);
        expect(config.villainsStartSetAside).toBeUndefined();
        expect(config.villainCardId).toBe(`40070${face}`);
        expect(config.setAsideVillainCardIds).toEqual(VILLAINS.slice(1).map((n) => `${n}${face}`));
        expect(config.setAside).toEqual(expect.arrayContaining(["40079", "40080"]));
      },
    );

    it.each(["standard", "expert"] as const)(
      "On the Run starts every villain set aside and its Setup puts one into play (%s)",
      (mode) => {
        const config = wave7Scenario("on-the-run", { players: PLAYERS, seed: 1, difficulty: mode });
        const face = mode === "expert" ? "b" : "a";
        expect(config.villainsStartSetAside).toBe(true);
        expect(config.randomStartingVillain).toBeUndefined();
        expect(config.setAsideVillainCardIds).toEqual(VILLAINS.slice(1).map((n) => `${n}${face}`));
        expect(config.setAside).toContain("40105a");
        const game = createGame(config, WAVE7_DEPS);
        if (!game.ok) throw new Error(JSON.stringify(game));
        // 1A's Setup (scripted in next_evol/on-the-run.ts) puts one of the set-aside villains into play.
        expect(game.state.villains.filter((villain) => !villain.defeated)).toHaveLength(1);
        expect(config.encounterDeck).not.toContain("40070a");
        // Mutant Slayers is required there: its nine cards are dealt.
        expect(cardCount(config.encounterDeck!, "mutant_slayers")).toBe(9);
      },
    );
  });

  it("the Hope Summers scenarios deal Hope Summers (40130, a setup card) with the deck; Mister Sinister sets its three sets aside", () => {
    for (const id of ["juggernaut", "mister-sinister", "stryfe"])
      expect(wave7Scenario(id, { players: PLAYERS, seed: 1 }).encounterDeck, id).toContain("40130");
    const config = wave7Scenario("mister-sinister", { players: PLAYERS, seed: 1 });
    for (const set of ["flight", "super_strength", "telepathy"]) {
      expect(cardCount(config.setAside!, set), set).toBeGreaterThan(0);
      expect(cardCount(config.encounterDeck!, set), set).toBe(0);
    }
  });

  it("refuses a scenario that is not one of the box's five", () => {
    expect(() => wave7Scenario("rhino", { players: PLAYERS, seed: 1 })).toThrow("no wave 7 scenario rhino");
  });
});
