/**
 * The setup choices wave 8 adds, asked and answered through the playable pool (docs/phase7-wave8.md section 4.1): Q1
 * (threat on Gene Pool, wherever the Infinites set is), Q9 (the Horsemen's versions), Q10 (Standard III in place of the
 * Standard set at any scenario that uses it) and Q12 (the easier Apocalypse start). Each offer function is checked
 * against `playableScenario`: what is offered builds, what is not offered is refused.
 */
import { PLAYABLE_CARDS } from "@mc/content";
import { createGame } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_SCENARIO_RECORDS } from "../modular-pool.js";
import { PLAYABLE_DEPS, playableScenario } from "./index.js";
import {
  checkPlayableDifficultySets,
  difficultySetAlternativesFor,
  expertSetReplaceable,
  genePoolThreatOffer,
  horsemanSidesOffer,
  playableScenarioOffer,
  scenarioGameSetIds,
  standardSetReplaceable,
} from "./scenario-options.js";

const SEAT = [{ starterDeckId: "core-spider-man-justice" }] as const;
const record = (id: string) => PLAYABLE_SCENARIO_RECORDS.find((scenario) => scenario.id === id)!;

const cardIdsOfSet = (setId: string): Set<string> =>
  new Set(
    PLAYABLE_CARDS.filter(
      (card) => "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId),
    ).map((card) => card.id as string),
  );
const STANDARD = cardIdsOfSet("standard");
const STANDARD_II = cardIdsOfSet("standard_ii");
const STANDARD_III = cardIdsOfSet("standard_iii");
const EXPERT = cardIdsOfSet("expert");
const EXPERT_II = cardIdsOfSet("expert_ii");

const cardsInGame = (config: ReturnType<typeof playableScenario>): string[] => {
  const created = createGame(config, PLAYABLE_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return Object.values(created.state.instances).map((instance) => instance.cardId as string);
};
const count = (ids: readonly string[], set: ReadonlySet<string>): number => ids.filter((id) => set.has(id)).length;

describe("Standard III and the other alternative sets (Q10 = A; The Hood insert p. 2)", () => {
  const replaceable = PLAYABLE_SCENARIO_RECORDS.filter(standardSetReplaceable);
  const notReplaceable = PLAYABLE_SCENARIO_RECORDS.filter((scenario) => !standardSetReplaceable(scenario));

  it("the offer reads the scenario record, not its pack: every scenario on the plain Standard set is offered both", () => {
    expect(replaceable.length).toBeGreaterThan(40);
    expect(new Set(replaceable.map((scenario) => scenario.packCode as string)).size).toBeGreaterThan(8);
    for (const scenario of replaceable)
      expect(difficultySetAlternativesFor(scenario).standard, scenario.id).toEqual(["standard_ii", "standard_iii"]);
    expect(difficultySetAlternativesFor(record("rhino"))).toEqual({
      standard: ["standard_ii", "standard_iii"],
      expert: ["expert_ii"],
    });
    expect(difficultySetAlternativesFor(record("unus"))).toEqual({
      standard: ["standard_ii", "standard_iii"],
      expert: ["expert_ii"],
    });
  });

  it("a scenario that requires no Standard set, or one of its own, is offered none", () => {
    // The Wrecking Crew (Breakout) uses no Standard set.
    expect(notReplaceable.map((scenario) => scenario.id as string)).toContain("breakout");
    for (const scenario of notReplaceable) expect(difficultySetAlternativesFor(scenario).standard).toEqual([]);
    expect(difficultySetAlternativesFor(undefined)).toEqual({ standard: [], expert: [] });
  });

  it("Standard III has no Expert partner: the Expert alternatives are the Expert classification's alone", () => {
    for (const scenario of PLAYABLE_SCENARIO_RECORDS)
      expect(difficultySetAlternativesFor(scenario).expert, scenario.id).toEqual(
        expertSetReplaceable(scenario) ? ["expert_ii"] : [],
      );
  });

  it.each(replaceable.map((scenario) => scenario.id as string))(
    "%s: Standard III replaces the Standard set whole, in standard and in expert",
    (scenarioId) => {
      for (const difficulty of ["standard", "expert"] as const) {
        const printed = cardsInGame(playableScenario(scenarioId, { seed: 9, players: SEAT, difficulty }));
        const chosen = cardsInGame(
          playableScenario(scenarioId, {
            seed: 9,
            players: SEAT,
            difficulty,
            difficultySets: { standard: "standard_iii" as never },
          }),
        );
        expect(count(printed, STANDARD), "the printed game uses Standard").toBeGreaterThan(0);
        expect(count(printed, STANDARD_III)).toBe(0);
        expect(count(chosen, STANDARD)).toBe(0);
        expect(count(chosen, STANDARD_III), "Standard III is in the game").toBeGreaterThan(0);
        // The Expert set is left as it was.
        expect(count(chosen, EXPERT)).toBe(count(printed, EXPERT));
      }
    },
    60_000,
  );

  it("Standard II and Expert II still replace their sets at a scenario of another box", () => {
    const chosen = cardsInGame(
      playableScenario("sandman", {
        seed: 9,
        players: SEAT,
        difficulty: "expert",
        difficultySets: { standard: "standard_ii" as never, expert: "expert_ii" as never },
      }),
    );
    expect(count(chosen, STANDARD) + count(chosen, EXPERT)).toBe(0);
    expect(count(chosen, STANDARD_II)).toBeGreaterThan(0);
    expect(count(chosen, EXPERT_II)).toBeGreaterThan(0);
  });

  it.each(notReplaceable.map((scenario) => scenario.id as string))(
    "%s refuses a Standard replacement rather than building without it",
    (scenarioId) => {
      expect(() =>
        playableScenario(scenarioId, { seed: 9, players: SEAT, difficultySets: { standard: "standard_iii" as never } }),
      ).toThrow("does not use the Standard set");
    },
  );

  it("a set of the wrong classification, or an unknown one, is refused at every wave's scenario", () => {
    for (const scenarioId of [
      "rhino",
      "crossbones",
      "nebula",
      "ebony-maw",
      "sandman",
      "sabretooth",
      "juggernaut",
      "unus",
    ]) {
      expect(() =>
        playableScenario(scenarioId, { seed: 9, players: SEAT, difficultySets: { standard: "expert_ii" as never } }),
      ).toThrow("not in the standard classification");
      expect(() =>
        playableScenario(scenarioId, { seed: 9, players: SEAT, difficultySets: { standard: "standard_iv" as never } }),
      ).toThrow("not a known encounter set");
      expect(() =>
        playableScenario(scenarioId, { seed: 9, players: SEAT, difficultySets: { expert: "standard_iii" as never } }),
      ).toThrow("not in the expert classification");
    }
    expect(() => checkPlayableDifficultySets(record("rhino"), { standard: "standard_iii" as never })).not.toThrow();
    expect(() => checkPlayableDifficultySets(record("rhino"), undefined)).not.toThrow();
  });
});

describe("the Horsemen's versions (Q9 = B)", () => {
  it("only the Four Horsemen offers the choice, four selectors in printed order, defaulting from the mode", () => {
    const offering = PLAYABLE_SCENARIO_RECORDS.filter((scenario) => horsemanSidesOffer(scenario) !== null);
    expect(offering.map((scenario) => scenario.id as string)).toEqual(["four-horsemen"]);
    expect(horsemanSidesOffer(record("four-horsemen"))).toEqual({
      villainNames: ["War", "Famine", "Pestilence", "Death"],
      defaultSides: ["A", "A", "A", "A"],
    });
    expect(horsemanSidesOffer(record("four-horsemen"), { expert: true })?.defaultSides).toEqual(["B", "B", "B", "B"]);
    expect(horsemanSidesOffer(record("four-horsemen"), { heroic: 1 })?.defaultSides).toEqual(["B", "B", "B", "B"]);
    expect(horsemanSidesOffer(undefined)).toBeNull();
  });

  it("the chosen versions reach the game through playableScenario", () => {
    const config = playableScenario("four-horsemen", {
      seed: 1,
      players: SEAT,
      horsemanSides: ["A", "B", "A", "B"],
    });
    expect((config.villains ?? []).map((villain) => villain.villainCardId as string)).toEqual([
      "45081a",
      "45082b",
      "45083a",
      "45084b",
    ]);
    expect(createGame(config, PLAYABLE_DEPS).ok).toBe(true);
  });

  it("every other scenario refuses it, a wave 8 one and an earlier wave's", () => {
    for (const scenarioId of ["unus", "rhino", "breakout", "juggernaut"])
      expect(() =>
        playableScenario(scenarioId, { seed: 1, players: SEAT, horsemanSides: ["A", "A", "A", "A"] }),
      ).toThrow("horsemanSides belongs to the Four Horsemen");
  });
});

describe("the easier Apocalypse start (Q12 = A)", () => {
  it("is offered by Apocalypse on standard and by nothing else", () => {
    const offering = PLAYABLE_SCENARIO_RECORDS.filter((scenario) => playableScenarioOffer(scenario.id).easierStart);
    expect(offering.map((scenario) => scenario.id as string)).toEqual(["apocalypse"]);
    expect(playableScenarioOffer("apocalypse", { difficulty: "expert" }).easierStart).toBe(false);
    expect(playableScenarioOffer("apocalypse", { modes: { expert: true } }).easierStart).toBe(false);
  });

  it("starts Apocalypse on stage I through playableScenario, and is refused on expert and elsewhere", () => {
    const printed = playableScenario("apocalypse", { seed: 1, players: SEAT });
    const easier = playableScenario("apocalypse", { seed: 1, players: SEAT, easierStart: true });
    expect(easier.villainStartStageIndex).toBe((printed.villainStartStageIndex ?? 0) - 1);
    expect(createGame(easier, PLAYABLE_DEPS).ok).toBe(true);
    expect(() =>
      playableScenario("apocalypse", { seed: 1, players: SEAT, difficulty: "expert", easierStart: true }),
    ).toThrow("standard mode option");
    for (const scenarioId of ["unus", "rhino", "stryfe"])
      expect(() => playableScenario(scenarioId, { seed: 1, players: SEAT, easierStart: true })).toThrow(
        "easierStart belongs to the Apocalypse scenario",
      );
  });
});

describe("threat on Gene Pool follows the Infinites set (Q1 = A)", () => {
  const setupOptionsOf = (config: ReturnType<typeof playableScenario>) =>
    (config.setupOptions ?? []).map((option) => [option.option, option.amount]);

  it("is offered where the set is: Unus by its own sets, Apocalypse by its recommendation, any scenario by a pick", () => {
    expect(scenarioGameSetIds(record("unus"))).toEqual(["unus", "infinites", "dystopian_nightmare"]);
    expect(playableScenarioOffer("unus").genePoolThreat).toEqual({ max: 3, recommended: 1 });
    expect(playableScenarioOffer("unus", { difficulty: "expert" }).genePoolThreat).toEqual({ max: 3, recommended: 2 });
    expect(playableScenarioOffer("unus", { modes: { heroic: 2 } }).genePoolThreat?.recommended).toBe(3);
    expect(playableScenarioOffer("apocalypse").genePoolThreat).not.toBeNull();
    expect(playableScenarioOffer("apocalypse", { modularSetIds: ["dark_riders", "hounds"] }).genePoolThreat).toBeNull();
    expect(playableScenarioOffer("rhino").genePoolThreat).toBeNull();
    expect(playableScenarioOffer("rhino", { modularSetIds: ["infinites"] }).genePoolThreat).toEqual({
      max: 3,
      recommended: 1,
    });
    expect(genePoolThreatOffer(["bomb_scare"])).toBeNull();
  });

  it("the offer never fills the amount in: a game built without it places none", () => {
    expect(setupOptionsOf(playableScenario("unus", { seed: 1, players: SEAT, difficulty: "expert" }))).toEqual([]);
  });

  it("a wave 8 scenario takes the amount through playableScenario", () => {
    const config = playableScenario("unus", { seed: 1, players: SEAT, genePoolThreatPerPlayer: 2 });
    expect(setupOptionsOf(config)).toEqual([["infinites.gene-pool-threat", 2]]);
  });

  it("an earlier wave's scenario with Infinites as its modular pick takes it too, and the threat lands on Gene Pool", () => {
    const base = { seed: 1, players: [...SEAT, { starterDeckId: "bishop-leadership" }], modularSetIds: ["infinites"] };
    const threatOnGenePool = (config: ReturnType<typeof playableScenario>): number => {
      const created = createGame(config, PLAYABLE_DEPS);
      if (!created.ok) throw new Error(created.error.message);
      // Gene Pool (45071: permanent, setup) enters play at step 11, before the option's threat is placed.
      const genePool = created.state.villainArea
        .map((id) => created.state.instances[id]!)
        .find((instance) => instance.cardId === "45071");
      if (!genePool) throw new Error("Gene Pool is not in play after setup");
      return genePool.threat ?? 0;
    };
    const without = playableScenario("rhino", base);
    const withThreat = playableScenario("rhino", { ...base, genePoolThreatPerPlayer: 3 });
    expect(setupOptionsOf(withThreat)).toEqual([["infinites.gene-pool-threat", 3]]);
    // 3 per player, two players.
    expect(threatOnGenePool(withThreat)).toBe(threatOnGenePool(without) + 6);
    expect(setupOptionsOf(playableScenario("rhino", { ...base, genePoolThreatPerPlayer: 0 }))).toEqual([]);
  });

  it("a game without the set refuses it, and an amount above 3 is refused", () => {
    expect(() => playableScenario("rhino", { seed: 1, players: SEAT, genePoolThreatPerPlayer: 1 })).toThrow(
      "belongs to a game that uses the Infinites set",
    );
    expect(() => playableScenario("four-horsemen", { seed: 1, players: SEAT, genePoolThreatPerPlayer: 1 })).toThrow(
      "belongs to a game that uses the Infinites set",
    );
    expect(() =>
      playableScenario("rhino", { seed: 1, players: SEAT, modularSetIds: ["infinites"], genePoolThreatPerPlayer: 4 }),
    ).toThrow("1 to 3 per player");
  });
});

describe("playableScenarioOffer", () => {
  it("answers for every playable scenario and throws for one the pool does not have", () => {
    for (const scenario of PLAYABLE_SCENARIO_RECORDS) expect(() => playableScenarioOffer(scenario.id)).not.toThrow();
    expect(() => playableScenarioOffer("no-such-scenario")).toThrow("no playable scenario");
  });

  it('Breakout\'s "extreme" is not expert for these offers', () => {
    expect(playableScenarioOffer("four-horsemen", { difficulty: "extreme" }).horsemanSides?.defaultSides).toEqual([
      "A",
      "A",
      "A",
      "A",
    ]);
  });
});
