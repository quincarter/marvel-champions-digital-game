/**
 * The "Allow extra modular sets" house rule (#761) at the scenario builder: `houseModularSetIds` are built as counted
 * modular sets are (contents, separate decks, set-dependent setup options) without counting toward the scenario's number.
 */
import { WAVE8_SCENARIOS } from "@mc/content";
import { createGame } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { modularSetContents } from "../core/setup.js";
import { MODULAR_SETS } from "../testing/modular-matrix.js";
import { PLAYABLE_SCENARIO_RECORDS } from "../modular-pool.js";
import { PLAYABLE_DEPS, playableScenario } from "./index.js";
import {
  genePoolThreatOffer,
  offersGenePoolThreat,
  playableScenarioOffer,
  scenarioGameSetIds,
} from "./scenario-options.js";

const SEAT = [{ starterDeckId: "core-spider-man-justice" }] as const;
const base = { seed: 1, players: SEAT } as const;

const setupOptionsOf = (config: ReturnType<typeof playableScenario>) =>
  (config.setupOptions ?? []).map((option) => [option.option, option.amount]);
const sorted = (ids: readonly string[] | undefined): string[] => [...(ids ?? [])].map(String).sort();

describe("Infinites as a house set", () => {
  it("is offered the Gene Pool threat as when it is counted", () => {
    const counted = playableScenarioOffer("rhino", { modularSetIds: ["infinites"] }).genePoolThreat;
    expect(counted).not.toBeNull();
    expect(playableScenarioOffer("rhino", { modularSetIds: ["bomb_scare"] }).genePoolThreat).toBeNull();
    expect(
      playableScenarioOffer("rhino", { modularSetIds: ["bomb_scare"], houseModularSetIds: ["infinites"] })
        .genePoolThreat,
    ).toEqual(counted);
  });

  it("builds the same threat and Infinity-less Gene Pool setup as when it is the counted pick", () => {
    const counted = playableScenario("rhino", { ...base, modularSetIds: ["infinites"], genePoolThreatPerPlayer: 2 });
    const house = playableScenario("rhino", {
      ...base,
      modularSetIds: ["bomb_scare"],
      houseModularSetIds: ["infinites"],
      genePoolThreatPerPlayer: 2,
    });
    expect(setupOptionsOf(house)).toEqual([["infinites.gene-pool-threat", 2]]);
    expect(setupOptionsOf(house)).toEqual(setupOptionsOf(counted));
    expect(sorted(house.scenarioDecks?.map((deck) => deck.name))).toEqual(
      sorted(counted.scenarioDecks?.map((deck) => deck.name)),
    );
    for (const config of [counted, house]) expect(createGame(config, PLAYABLE_DEPS).ok).toBe(true);
    // Gene Pool (45071, Setup) begins in play and the threat lands on it, as counted.
    const threatOn = (config: typeof house): number => {
      const created = createGame(config, PLAYABLE_DEPS);
      if (!created.ok) throw new Error(created.error.message);
      return (
        created.state.villainArea
          .map((id) => created.state.instances[id]!)
          .find((instance) => instance.cardId === "45071")?.threat ?? -1
      );
    };
    expect(threatOn(house)).toBeGreaterThan(-1);
    expect(threatOn(house)).toBe(threatOn(counted));
  });

  it("refuses an amount when the set is nowhere in the game, and zero is off", () => {
    expect(() =>
      playableScenario("rhino", { ...base, houseModularSetIds: ["under_attack"], genePoolThreatPerPlayer: 1 }),
    ).toThrow("belongs to a game that uses the Infinites set");
    const off = playableScenario("rhino", { ...base, houseModularSetIds: ["infinites"], genePoolThreatPerPlayer: 0 });
    expect(setupOptionsOf(off)).toEqual([]);
  });

  it("at a wave 8 scenario that lacks Infinites, the builder is not given the amount and the house path applies it", () => {
    const scenario = WAVE8_SCENARIOS.find(
      (candidate) =>
        PLAYABLE_SCENARIO_RECORDS.some((record) => record.id === candidate.id) &&
        !offersGenePoolThreat(scenarioGameSetIds(candidate)),
    );
    expect(scenario).toBeDefined();
    if (!scenario) return;
    const config = playableScenario(scenario.id as string, {
      ...base,
      houseModularSetIds: ["infinites"],
      genePoolThreatPerPlayer: 2,
    });
    expect(setupOptionsOf(config)).toEqual([["infinites.gene-pool-threat", 2]]);
    const created = createGame(config, PLAYABLE_DEPS);
    expect(created.ok).toBe(true);
    if (created.ok) {
      const genePool = created.state.villainArea
        .map((id) => created.state.instances[id]!)
        .find((instance) => instance.cardId === "45071");
      expect(genePool?.threat ?? 0).toBeGreaterThanOrEqual(2);
    }
    expect(genePoolThreatOffer([...scenarioGameSetIds(scenario), "infinites"])).not.toBeNull();
  });

  it("refuses a set the scenario already deals, or one named twice", () => {
    expect(() => playableScenario("rhino", { ...base, houseModularSetIds: ["bomb_scare"] })).toThrow(
      "already in the game",
    );
    expect(() => playableScenario("rhino", { ...base, houseModularSetIds: ["infinites", "infinites"] })).toThrow(
      "added twice",
    );
  });
});

describe("a house set must be eligible as a counted pick would be", () => {
  const house = (scenarioId: string, ids: string[]) =>
    playableScenario(scenarioId, { ...base, houseModularSetIds: ids });
  it("refuses a difficulty set and an id that is no modular set", () => {
    expect(() => house("rhino", ["standard_ii"])).toThrow(/Standard or Expert/);
    expect(() => house("rhino", ["standard"])).toThrow(/Standard or Expert/);
    expect(() => house("rhino", ["expert"])).toThrow(/Standard or Expert/);
    expect(() => house("rhino", ["rhino"])).toThrow(/already/);
    expect(() => house("rhino", ["not_a_set"])).toThrow(/not an encounter set/);
  });
  it("refuses a pairing the scenario refuses when counted (a single-villain set at several villains)", () => {
    const multi = PLAYABLE_SCENARIO_RECORDS.find((s) => s.multipleVillains && s.id !== "breakout");
    const single = MODULAR_SETS.find((set) => set.singleVillainOnly);
    expect(multi).toBeDefined();
    expect(single).toBeDefined();
    expect(() => house(multi!.id as string, [single!.id as string])).toThrow(/more than one villain/);
  });
});

describe("a house set is built exactly like the counted one, for every modular set", () => {
  // Counted: base + cards(X). Counted with Bomb Scare: base + cards(B). House: base + cards(B) + cards(X).
  const baseDeck = (setId: string): string[] => {
    const a = sorted(playableScenario("rhino", { ...base, modularSetIds: [setId] }).encounterDeck);
    const b = sorted(playableScenario("rhino", { ...base, modularSetIds: ["bomb_scare"] }).encounterDeck);
    const pool = [...b];
    return a.filter((id) => {
      const at = pool.indexOf(id);
      if (at < 0) return false;
      pool.splice(at, 1);
      return true;
    });
  };
  for (const set of MODULAR_SETS) {
    if (set.id === "bomb_scare") continue;
    it(set.id as string, () => {
      let counted;
      try {
        counted = playableScenario("rhino", { ...base, modularSetIds: [set.id as string] });
      } catch {
        return; // a pairing Rhino refuses is not offered there either
      }
      const house = playableScenario("rhino", {
        ...base,
        modularSetIds: ["bomb_scare"],
        houseModularSetIds: [set.id as string],
      });
      const common = baseDeck(set.id as string);
      const bomb = sorted(playableScenario("rhino", { ...base, modularSetIds: ["bomb_scare"] }).encounterDeck);
      const expected = sorted([...bomb, ...sorted(counted.encounterDeck)]);
      const shared = [...common];
      // house deck == counted(X) + counted(B) - base, where base is what both builds share.
      const want = [...expected];
      for (const id of shared) want.splice(want.indexOf(id), 1);
      expect(sorted(house.encounterDeck)).toEqual(want);
      expect(sorted(house.scenarioDecks?.map((deck) => deck.name))).toEqual(
        sorted(counted.scenarioDecks?.map((deck) => deck.name)),
      );
    });
  }
});

describe("modularSetContents on a pool with a double-sided card and an encounter-backed player card", () => {
  // No modular set in the pool has either today (the data check above), so the rules are shown on a small pool.
  const face = (id: string, other: string) =>
    ({ id, type: "side_scheme", name: id, quantityInSet: 1, encounterSetIds: ["demo"], otherFaceId: other }) as never;
  const pool = [
    face("9001a", "9001b"),
    face("9001b", "9001a"),
    { id: "9002", type: "treachery", name: "t", quantityInSet: 2, encounterSetIds: ["demo"] },
    {
      id: "9003",
      type: "ally",
      name: "Proprietor",
      quantityInSet: 1,
      cardBack: "encounter",
      specificTo: { kind: "scenario", encounterSetId: "demo" },
    },
  ] as never;

  it("deals a double-sided card once, as its front, and an encounter-backed card of the set with the deck", () => {
    expect(sorted(modularSetContents(["demo"], pool).encounterDeck)).toEqual(["9001a", "9002", "9002", "9003"]);
  });
});
