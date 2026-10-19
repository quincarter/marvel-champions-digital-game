import {
  CORE_ENCOUNTER_SETS,
  CORE_SCENARIOS,
  MOJO_SCENARIOS,
  WAVE10_ENCOUNTER_SETS,
  WAVE10_SCENARIOS,
  WAVE6_ENCOUNTER_SETS,
  type Scenario,
} from "@mc/content";
import {
  checkModularPickCount,
  chooseModularSets,
  modularPickCountProblem,
  modularPickCountRange,
  modularPickProblem,
  scenarioSideClause,
} from "./modular-pool.js";

/** docs/phase7-wave6.md §3.63: a modular pool, a per-player set-aside count and a set that is never counted. */

const SETS = [...CORE_ENCOUNTER_SETS, ...WAVE6_ENCOUNTER_SETS];
const GENRES = ["crime", "fantasy", "horror", "sci-fi", "sitcom", "western"];
const scenario = (id: string): Scenario => {
  const record = [...MOJO_SCENARIOS, ...CORE_SCENARIOS].find((s) => s.id === id);
  if (!record) throw new Error(`no scenario ${id}`);
  return record;
};

describe("chooseModularSets: Mojo's per-player set-aside genre sets", () => {
  it.each([1, 2, 3, 4])("sets aside 1 + 1 per player at %i players, all distinct genre sets, none shuffled in", (n) => {
    const choice = chooseModularSets(scenario("mojo"), SETS, { playerCount: n, seed: 11 });
    expect(choice.modularSetIds).toEqual([]);
    expect(choice.setAsideModularSetIds).toHaveLength(1 + n);
    expect(new Set(choice.setAsideModularSetIds).size).toBe(1 + n);
    for (const id of choice.setAsideModularSetIds) expect(GENRES).toContain(id);
  });

  it("is deterministic for a seed", () => {
    const a = chooseModularSets(scenario("mojo"), SETS, { playerCount: 2, seed: 4 });
    const b = chooseModularSets(scenario("mojo"), SETS, { playerCount: 2, seed: 4 });
    expect(a).toEqual(b);
  });

  it("takes the players' set-aside choice from the pool, at the right count", () => {
    const choice = chooseModularSets(scenario("mojo"), SETS, {
      playerCount: 1,
      seed: 1,
      setAsideModularSetIds: ["crime", "sitcom"],
    });
    expect(choice.setAsideModularSetIds).toEqual(["crime", "sitcom"]);
    expect(() =>
      chooseModularSets(scenario("mojo"), SETS, {
        playerCount: 2,
        seed: 1,
        setAsideModularSetIds: ["crime", "sitcom"],
      }),
    ).toThrow(/expected 3 set-aside/);
    expect(() =>
      chooseModularSets(scenario("mojo"), SETS, {
        playerCount: 1,
        seed: 1,
        setAsideModularSetIds: ["crime", "bomb_scare"],
      }),
    ).toThrow(/pool/);
    expect(() =>
      chooseModularSets(scenario("mojo"), SETS, { playerCount: 1, seed: 1, setAsideModularSetIds: ["crime", "crime"] }),
    ).toThrow(/twice/);
  });

  it("never sets Longshot aside or picks it at random (Q43)", () => {
    for (let seed = 0; seed < 30; seed++) {
      const choice = chooseModularSets(scenario("mojo"), SETS, { playerCount: 4, seed });
      expect(choice.setAsideModularSetIds).not.toContain("longshot");
    }
    expect(() =>
      chooseModularSets(scenario("mojo"), SETS, {
        playerCount: 1,
        seed: 1,
        setAsideModularSetIds: ["crime", "longshot"],
      }),
    ).toThrow(/Q43/);
  });
});

describe("chooseModularSets: scenarios without a pool", () => {
  it("keep the recommendation, and Longshot rides along uncounted", () => {
    const choice = chooseModularSets(scenario("rhino"), SETS, {
      playerCount: 1,
      seed: 1,
      extraModularSetIds: ["longshot"],
    });
    expect(choice.modularSetIds).toEqual(["bomb_scare"]);
    expect(choice.setAsideModularSetIds).toEqual([]);
    expect(choice.extraModularSetIds).toEqual(["longshot"]);
  });

  it("refuse a set-aside choice when the scenario sets none aside", () => {
    expect(() =>
      chooseModularSets(scenario("rhino"), SETS, { playerCount: 1, seed: 1, setAsideModularSetIds: ["crime"] }),
    ).toThrow(/expected 0 set-aside/);
  });
});

/** docs/phase7-wave10.md §3.1a: the Civil War side rule (MC56 p. 4; ruling Jan 11, 2026) and the three-or-four count. */
describe("modularPickProblem: the Civil War side rule", () => {
  const CW_SETS = [...CORE_ENCOUNTER_SETS, ...WAVE10_ENCOUNTER_SETS];
  const leader = (id: string): Scenario => WAVE10_SCENARIOS.find((s) => s.id === id)!;

  it("refuses a set of the other side, naming the set, its side and the leader", () => {
    expect(modularPickProblem(leader("resistance-captain-america"), "heroes_for_hire", CW_SETS)).toBe(
      "Heroes for Hire is a registration set; Captain America leads the resistance (MC56 p. 4)",
    );
    expect(modularPickProblem(leader("registration-captain-marvel"), "namor_modular", CW_SETS)).toBe(
      "Namor is a resistance set; Captain Marvel leads the registration side (MC56 p. 4)",
    );
    expect(scenarioSideClause(leader("resistance-spider-woman"))).toBe("Spider-Woman leads the resistance");
    expect(scenarioSideClause(leader("registration-iron-man"))).toBe("Iron Man leads the registration side");
  });

  it("accepts every modular set of the leader's own side, the other leaders' recommendations included (three leaders a side)", () => {
    for (const record of WAVE10_SCENARIOS) {
      const own = WAVE10_SCENARIOS.filter((s) => s.side === record.side).flatMap((s) => s.recommendedModularSetIds);
      expect(own).toHaveLength(12);
      for (const id of own) expect(modularPickProblem(record, id, CW_SETS), `${record.id} ${id}`).toBeNull();
      const other = WAVE10_SCENARIOS.filter((s) => s.side !== record.side).flatMap((s) => s.recommendedModularSetIds);
      for (const id of other) expect(modularPickProblem(record, id, CW_SETS), `${record.id} ${id}`).toMatch(/ set; /);
    }
  });

  it("accepts a neutral set at a sided scenario and a sided set at a scenario with no side (MC56 p. 5)", () => {
    expect(modularPickProblem(leader("registration-iron-man"), "bomb_scare", CW_SETS)).toBeNull();
    expect(modularPickProblem(scenario("rhino"), "heroes_for_hire", CW_SETS)).toBeNull();
    expect(modularPickProblem(scenario("rhino"), "atlanteans", CW_SETS)).toBeNull();
  });

  it("keeps the older refusals ahead of the side: a leader's own set, the other leader's, a competitive set", () => {
    const ironMan = leader("registration-iron-man");
    expect(modularPickProblem(ironMan, "iron_man_leader", CW_SETS)).toBe(
      "iron_man_leader is already part of Registration: Iron Man",
    );
    expect(modularPickProblem(ironMan, "spider_woman_leader", CW_SETS)).toBe(
      "spider_woman_leader belongs to another scenario",
    );
    expect(modularPickProblem(ironMan, "standard_pvp_resistance", CW_SETS)).toBe(
      "standard_pvp_resistance is a competitive-mode set",
    );
    expect(modularPickProblem(ironMan, "standard", CW_SETS)).toBe(
      "standard is a Standard or Expert set, never a modular choice (RRG pp. 40, 19)",
    );
  });
});

describe("the count of modular picks", () => {
  const ironMan = WAVE10_SCENARIOS.find((s) => s.id === "registration-iron-man")!;

  it("is a range at a scenario that has one: three or four at a Civil War leader", () => {
    expect(modularPickCountRange(ironMan)).toEqual({ min: 3, max: 4 });
    expect([2, 3, 4, 5].map((count) => modularPickCountProblem(ironMan, count))).toEqual([
      "Registration: Iron Man uses 3 to 4 modular sets, got 2",
      null,
      null,
      "Registration: Iron Man uses 3 to 4 modular sets, got 5",
    ]);
    expect(() => checkModularPickCount(ironMan, ["paladin", "cape_killer"])).toThrow(
      "Registration: Iron Man uses 3 to 4 modular sets, got 2",
    );
    expect(() => checkModularPickCount(ironMan, ["paladin", "cape_killer", "martial_law"])).not.toThrow();
    expect(() => checkModularPickCount(ironMan, undefined)).not.toThrow();
  });

  it("is one number everywhere else, in the old words", () => {
    expect(modularPickCountRange(scenario("rhino"))).toEqual({ min: 1, max: 1 });
    expect(() => checkModularPickCount(scenario("rhino"), ["bomb_scare", "under_attack"])).toThrow(
      "Rhino uses 1 modular set(s), got 2",
    );
    expect(() => checkModularPickCount(scenario("rhino"), ["bomb_scare"])).not.toThrow();
    // A scenario that draws from a pool is counted by `chooseModularSets`, not here.
    expect(modularPickCountProblem(scenario("mojo"), 7)).toBeNull();
  });
});
