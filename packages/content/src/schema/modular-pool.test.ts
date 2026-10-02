import { describe, expect, it } from "vitest";
import {
  cardId,
  encounterSetId,
  scenarioId,
  setAsideModularSetCountFor,
  setCode,
  validateEncounterSet,
  validateScenario,
  validateScenarioEncounterSets,
} from "./index.js";
import type { EncounterSet, ModularSetPool, Scenario } from "./index.js";
import { CORE_ENCOUNTER_SETS } from "../data/core/encounterSets.js";
import { HOOD_SCENARIOS } from "../data/hood/scenarios.js";
import { MOJO_ENCOUNTER_SETS } from "../data/mojo/encounterSets.js";
import { MOJO_SCENARIOS } from "../data/mojo/scenarios.js";

/**
 * docs/phase7-wave6.md §3.63: `Scenario.modularSetPool`, `setAsideModularSetCount`'s per-player form and
 * `EncounterSet.extraModular` (§4 Q43, Q44). Sources: MaGog 39002a, Spiral 39015a, Mojo 39025a, MojoMania insert p. 2.
 */

const GENRES = ["crime", "fantasy", "horror", "sci-fi", "sitcom", "western"];
const mojo = (id: string): Scenario => MOJO_SCENARIOS.find((s) => s.id === id)!;
const SETS: readonly EncounterSet[] = [...CORE_ENCOUNTER_SETS, ...MOJO_ENCOUNTER_SETS];

const base: Scenario = {
  id: scenarioId("fixture"),
  name: "Fixture",
  packCode: setCode("mojo"),
  villainCardId: cardId("39022"),
  mainSchemeCardId: cardId("39025a"),
  encounterSetIds: [encounterSetId("mojo")],
  recommendedModularSetIds: [],
  standardEncounterSetIds: [encounterSetId("standard")],
  expertEncounterSetIds: [encounterSetId("expert")],
  villainStages: { standard: [1, 2], expert: [2, 3] },
  modularSetCount: 0,
};
const pool = (ids: readonly string[], restricted = true): ModularSetPool => ({
  setIds: ids.map(encounterSetId),
  restricted,
});

describe("§3.63 the MojoMania records", () => {
  it("MaGog recommends a genre set but takes any (unrestricted pool); Spiral and Mojo are restricted to the genres", () => {
    expect(mojo("magog").modularSetPool).toEqual(pool(GENRES, false));
    expect(mojo("spiral").modularSetPool).toEqual(pool(GENRES, true));
    expect(mojo("mojo").modularSetPool).toEqual(pool(GENRES, true));
  });

  it("Mojo sets aside 1 + 1 per player and shuffles none in", () => {
    expect(mojo("mojo").setAsideModularSetCount).toEqual({ base: 1, perPlayer: 1 });
    expect(mojo("mojo").modularSetCount).toBe(0);
    expect([1, 2, 3, 4].map((n) => setAsideModularSetCountFor(mojo("mojo"), n))).toEqual([2, 3, 4, 5]);
  });

  it("The Hood keeps a flat 7, and a scenario without the field sets none aside", () => {
    const hood = HOOD_SCENARIOS[0]!;
    expect([1, 4].map((n) => setAsideModularSetCountFor(hood, n))).toEqual([7, 7]);
    expect(setAsideModularSetCountFor(mojo("spiral"), 4)).toBe(0);
  });

  it("Longshot's set is the only extra modular set", () => {
    expect(MOJO_ENCOUNTER_SETS.filter((set) => set.extraModular).map((set) => set.id)).toEqual(["longshot"]);
  });

  it("every record validates against its sets", () => {
    for (const s of MOJO_SCENARIOS) {
      expect(validateScenario(s).errors, s.id).toEqual([]);
      expect(validateScenarioEncounterSets(s, SETS).errors, s.id).toEqual([]);
    }
  });
});

describe("§3.63 validation", () => {
  it("a per-player count needs a whole-number base and a positive perPlayer", () => {
    expect(validateScenario({ ...base, setAsideModularSetCount: { base: 0, perPlayer: 1 } }).errors).toEqual([]);
    for (const bad of [
      { base: -1, perPlayer: 1 },
      { base: 1, perPlayer: 0 },
      { base: 1.5, perPlayer: 1 },
    ])
      expect(validateScenario({ ...base, setAsideModularSetCount: bad }).errors).toContain(
        "scenario setAsideModularSetCount { base, perPlayer } needs a whole-number base and a positive perPlayer",
      );
    expect(validateScenario({ ...base, setAsideModularSetCount: 0 }).errors).toContain(
      "scenario setAsideModularSetCount must be a positive whole number",
    );
  });

  it("a pool is a non-empty list of distinct set ids with a boolean restricted", () => {
    expect(validateScenario({ ...base, modularSetPool: pool([]) }).errors).toContain(
      "scenario modularSetPool.setIds must be a non-empty list of encounter set ids",
    );
    expect(validateScenario({ ...base, modularSetPool: pool(["crime", "crime"]) }).errors).toContain(
      "scenario modularSetPool.setIds lists a set twice",
    );
    const notBoolean = {
      setIds: [encounterSetId("crime")],
      restricted: "yes",
    } as unknown as ModularSetPool;
    expect(validateScenario({ ...base, modularSetPool: notBoolean }).errors).toContain(
      "scenario modularSetPool.restricted must be a boolean",
    );
  });

  it("a restricted pool covers every pick at four players; an unrestricted one need not", () => {
    // Mojo's count at four players: 0 modular + (1 + 4) set aside = 5 of the 6 genre sets.
    const mojoLike = { ...base, setAsideModularSetCount: { base: 1, perPlayer: 1 } };
    expect(validateScenario({ ...mojoLike, modularSetPool: pool(GENRES) }).errors).toEqual([]);
    expect(validateScenario({ ...mojoLike, modularSetPool: pool(GENRES.slice(0, 4)) }).errors).toContain(
      "scenario modularSetPool holds 4 sets, but four players need 5",
    );
    expect(
      validateScenario({ ...base, modularSetCount: 3, modularSetPool: pool(["crime", "horror"]) }).errors,
    ).toContain("scenario modularSetPool holds 2 sets, but four players need 3");
    expect(
      validateScenario({ ...base, modularSetCount: 3, modularSetPool: pool(["crime", "horror"], false) }).errors,
    ).toEqual([]);
  });

  it("pool ids are registered modular sets: not Standard/Expert, the scenario's own, nemesis or extra", () => {
    const sets: EncounterSet[] = [
      ...SETS,
      { id: encounterSetId("std_ii"), name: "Standard II", packCodes: [setCode("hood")], classification: "standard" },
      { id: encounterSetId("x_nemesis"), name: "X", packCodes: [setCode("x")], nemesisOfIdentityId: cardId("1a") },
    ];
    for (const id of ["std_ii", "mojo", "x_nemesis", "longshot"])
      expect(validateScenarioEncounterSets({ ...base, modularSetPool: pool([id]) }, sets).errors).toContain(
        `scenario fixture modularSetPool names ${id}, which is not a modular set`,
      );
    expect(validateScenarioEncounterSets({ ...base, modularSetPool: pool(["nowhere"]) }, sets).errors).toContain(
      "scenario fixture names encounter set nowhere, which is not registered",
    );
  });

  it("an extra modular set is never recommended as a modular set", () => {
    const s = { ...base, recommendedModularSetIds: [encounterSetId("longshot")] };
    expect(validateScenarioEncounterSets(s, SETS).errors).toContain(
      "scenario fixture recommends longshot, which is never counted as a modular set",
    );
  });

  it("extraModular is true or absent", () => {
    const longshot = MOJO_ENCOUNTER_SETS.find((set) => set.id === "longshot")!;
    expect(validateEncounterSet(longshot).errors).toEqual([]);
    expect(validateEncounterSet({ ...longshot, extraModular: false as unknown as true }).errors).toContain(
      "encounter set longshot extraModular must be true when present",
    );
  });
});
