import { CORE_ENCOUNTER_SETS, CORE_SCENARIOS, MOJO_SCENARIOS, WAVE6_ENCOUNTER_SETS, type Scenario } from "@mc/content";
import { chooseModularSets } from "./modular-pool.js";

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
