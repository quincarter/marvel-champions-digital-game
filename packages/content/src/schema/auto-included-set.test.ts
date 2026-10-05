import { describe, expect, it } from "vitest";
import {
  autoIncludedSetsOf,
  cardId,
  encounterSetId,
  scenarioId,
  setCode,
  validateEncounterSet,
  validateScenarioEncounterSets,
} from "./index.js";
import type { EncounterSet, Scenario } from "./index.js";
import { CORE_ENCOUNTER_SETS } from "../data/core/encounterSets.js";
import { DEADPOOL_CARDS } from "../data/deadpool/cards.js";
import { DEADPOOL_ENCOUNTER_SETS } from "../data/deadpool/encounterSets.js";
import { WAVE7_ENCOUNTER_SETS, WAVE7_SCENARIOS } from "../data/index.js";

/**
 * docs/phase7-wave7.md §3.74 (§4 Q44: A): `EncounterSet.autoIncluded`. Deadpool insert, "Using the 'Pool Aspect":
 * "When setting up a game in which at least one player is using the 'Pool aspect, shuffle 1 copy of the Crisis of
 * Infinite Deadpools (#37) treachery card into the encounter deck. Set the rest of the Dreadpool modular encounter
 * set aside." RRG 1.8 FAQ, p. 64: "only included if at least one player in the game chooses the 'Pool aspect as (one
 * of) their chosen aspect(s)".
 */

const dreadpool = DEADPOOL_ENCOUNTER_SETS.find((set) => set.id === "dreadpool")!;
const SETS: readonly EncounterSet[] = [...CORE_ENCOUNTER_SETS, ...DEADPOOL_ENCOUNTER_SETS];

const base: Scenario = {
  id: scenarioId("fixture"),
  name: "Fixture",
  packCode: setCode("core"),
  villainCardId: cardId("01094"),
  mainSchemeCardId: cardId("01097"),
  encounterSetIds: [encounterSetId("rhino")],
  recommendedModularSetIds: [encounterSetId("bomb_scare")],
  standardEncounterSetIds: [encounterSetId("standard")],
  expertEncounterSetIds: [encounterSetId("expert")],
  villainStages: { standard: [1, 2], expert: [2, 3] },
  modularSetCount: 1,
};

describe("§3.74 the Dreadpool record", () => {
  it("is the only auto-included set of wave 7: in the game when a player chose 'Pool, Crisis shuffled in", () => {
    expect(WAVE7_ENCOUNTER_SETS.filter((set) => set.autoIncluded).map((set) => set.id)).toEqual(["dreadpool"]);
    expect(dreadpool.autoIncluded).toEqual({
      when: { kind: "aspectChosen", aspect: "pool" },
      shuffledIn: [cardId("44037")],
    });
    expect(validateEncounterSet(dreadpool).errors).toEqual([]);
  });

  it("expands to seven cards, one entry per copy: 44037 shuffled in, six set aside ('Pool-ized twice)", () => {
    const [expanded, ...others] = autoIncludedSetsOf(DEADPOOL_ENCOUNTER_SETS, DEADPOOL_CARDS);
    expect(others).toEqual([]);
    expect(expanded).toEqual({
      encounterSetId: "dreadpool",
      when: { kind: "aspectChosen", aspect: "pool" },
      shuffledIn: ["44037"],
      cardIds: ["44037", "44038", "44039", "44040", "44041", "44041", "44042"],
    });
  });

  it("is left out of a pool that holds none of its cards, and ordinary sets are never expanded", () => {
    expect(autoIncludedSetsOf(DEADPOOL_ENCOUNTER_SETS, [])).toEqual([]);
    expect(autoIncludedSetsOf(CORE_ENCOUNTER_SETS, DEADPOOL_CARDS)).toEqual([]);
  });

  it("no wave 7 scenario lists it", () => {
    for (const scenario of WAVE7_SCENARIOS) {
      const named = [
        ...scenario.encounterSetIds,
        ...scenario.recommendedModularSetIds,
        ...(scenario.modularSetPool?.setIds ?? []),
      ];
      expect(named, scenario.id).not.toContain("dreadpool");
    }
  });
});

describe("§3.74 validation", () => {
  const listed =
    "scenario fixture names set dreadpool, which is included by a setup condition and never listed by a scenario";

  it("a scenario without the set passes", () => {
    expect(validateScenarioEncounterSets(base, SETS).errors).toEqual([]);
  });

  it("refuses a scenario that lists an auto-included set as its own, a recommended or a difficulty set", () => {
    const id = encounterSetId("dreadpool");
    for (const scenario of [
      { ...base, encounterSetIds: [...base.encounterSetIds, id] },
      { ...base, recommendedModularSetIds: [id] },
      { ...base, standardEncounterSetIds: [id] },
      { ...base, expertEncounterSetIds: [id] },
    ])
      expect(validateScenarioEncounterSets(scenario, SETS).errors).toEqual([listed]);
  });

  it("refuses it in a modular set pool: it is never a modular choice", () => {
    const scenario = { ...base, modularSetPool: { setIds: [encounterSetId("dreadpool")], restricted: false } };
    expect(validateScenarioEncounterSets(scenario, SETS).errors).toEqual([
      "scenario fixture modularSetPool names dreadpool, which is not a modular set",
    ]);
  });

  it("the rule needs an aspectChosen condition and at least one card to shuffle in", () => {
    const rule = dreadpool.autoIncluded!;
    expect(validateEncounterSet({ ...dreadpool, autoIncluded: { ...rule, shuffledIn: [] } }).errors).toEqual([
      "encounter set dreadpool autoIncluded.shuffledIn must be a non-empty list of card ids",
    ]);
    const badWhen = { ...rule, when: { kind: "always" } } as unknown as NonNullable<EncounterSet["autoIncluded"]>;
    expect(validateEncounterSet({ ...dreadpool, autoIncluded: badWhen }).errors).toEqual([
      "encounter set dreadpool autoIncluded.when must be an aspectChosen condition naming an aspect",
    ]);
  });

  it("an auto-included set is not also an extra, Standard/Expert or nemesis set", () => {
    const clash =
      "encounter set dreadpool is autoIncluded, so it cannot also be an extra, Standard/Expert or nemesis set";
    expect(validateEncounterSet({ ...dreadpool, extraModular: true }).errors).toEqual([clash]);
    expect(validateEncounterSet({ ...dreadpool, classification: "standard" }).errors).toEqual([clash]);
    expect(validateEncounterSet({ ...dreadpool, nemesisOfIdentityId: cardId("44001a") }).errors).toEqual([clash]);
  });
});
