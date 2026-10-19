import { CORE_STARTER_DECKS, WAVE10_ENCOUNTER_SETS, WAVE10_SCENARIOS } from "@mc/content";
import { COMPETITIVE_MODE_UNAVAILABLE_MESSAGE, createGame } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_ENCOUNTER_SETS, PLAYABLE_SCENARIO_RECORDS } from "../modular-pool.js";
import { WAVE10_DEPS } from "../wave10/index.js";
import { wave10Scenario } from "../wave10/setup.js";
import { PLAYABLE_ABILITIES, PLAYABLE_DEPS, playableScenario, playableStarterDeckSetup } from "./index.js";
import { UNSCRIPTED_ENCOUNTER_SET_IDS, scenarioIsScripted } from "./unscripted.js";
import { civilWarGameModes, civilWarSidesOffer, playableScenarioOffer } from "./scenario-options.js";

/**
 * docs/phase7-wave10.md §3.1b: `playableScenario` routes a Civil War leader to `wave10Scenario`, and
 * `playableScenarioOffer` carries what the client's scenario builder draws (docs/phase7-wave10-client.md section 2.7),
 * and the wave is in the playable pool (C10), plus the Wonder Man and Hercules packs.
 */

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const IRON_MAN = "registration-iron-man";

describe("the Civil War box is joined to the playable pool", () => {
  it("every playable list names its scenarios, sets, starter decks and scripts", () => {
    // Synthezoid Smackdown's two leaders are gated while the pack is scripted (`unscripted.ts`).
    for (const scenario of WAVE10_SCENARIOS)
      expect(
        PLAYABLE_SCENARIO_RECORDS.some((record) => record.id === scenario.id),
        scenario.id,
      ).toBe(scenarioIsScripted(scenario));
    expect(WAVE10_SCENARIOS.filter((scenario) => !scenarioIsScripted(scenario)).map((s) => s.id)).toEqual([
      "registration-she-hulk",
      "resistance-vision",
    ]);
    const sided = PLAYABLE_ENCOUNTER_SETS.filter((set) => set.side !== undefined);
    expect(sided.length).toBeGreaterThan(0);
    for (const id of ["tigra-aggression", "hulkling-protection"])
      expect(playableStarterDeckSetup(id).deck.length, id).toBeGreaterThan(0);
    expect(Object.keys(PLAYABLE_ABILITIES).some((id) => id.startsWith("56"))).toBe(true);
  });

  it("seats Tigra and Hulkling at a leader and starts a game on the playable dependencies", () => {
    for (const starterDeckId of ["tigra-aggression", "hulkling-protection"]) {
      const config = playableScenario(IRON_MAN, { players: [{ starterDeckId }], seed: 1 });
      expect(createGame(config, PLAYABLE_DEPS).ok, starterDeckId).toBe(true);
    }
  });

  it("joins the Wonder Man pack: his nemesis set is playable and his precon is seatable", () => {
    expect(UNSCRIPTED_ENCOUNTER_SET_IDS.has("wonder_man_nemesis")).toBe(false);
    expect(PLAYABLE_ENCOUNTER_SETS.some((set) => set.id === "wonder_man_nemesis")).toBe(true);
    expect(Object.keys(PLAYABLE_ABILITIES).some((id) => id.startsWith("58"))).toBe(true);
    expect(playableStarterDeckSetup("wonder-man-justice").deck).toHaveLength(41);
    const config = playableScenario(IRON_MAN, { players: [{ starterDeckId: "wonder-man-justice" }], seed: 1 });
    expect(createGame(config, PLAYABLE_DEPS).ok).toBe(true);
  });

  it("joins the Hercules pack: his nemesis set and All Versus All are playable and his precon is seatable", () => {
    for (const id of ["hercules_nemesis", "all_versus_all"]) {
      expect(UNSCRIPTED_ENCOUNTER_SET_IDS.has(id), id).toBe(false);
      expect(
        PLAYABLE_ENCOUNTER_SETS.some((set) => set.id === id),
        id,
      ).toBe(true);
    }
    expect(Object.keys(PLAYABLE_ABILITIES).some((id) => id.startsWith("59"))).toBe(true);
    expect(playableStarterDeckSetup("hercules-leadership").deck).toHaveLength(40);
    const config = playableScenario(IRON_MAN, { players: [{ starterDeckId: "hercules-leadership" }], seed: 1 });
    expect(createGame(config, PLAYABLE_DEPS).ok).toBe(true);
    const withSet = playableScenario(IRON_MAN, {
      players: [{ starterDeckId: "hercules-leadership" }],
      seed: 1,
      modularSetIds: ["all_versus_all", "paladin", "cape_killer"],
    });
    expect(createGame(withSet, PLAYABLE_DEPS).ok).toBe(true);
  });

  it("refuses the competitive-only sets as a modular pick", () => {
    const competitive = WAVE10_ENCOUNTER_SETS.filter((set) => set.competitiveOnly);
    expect(competitive.length).toBeGreaterThan(0);
    for (const set of competitive) {
      expect(PLAYABLE_ENCOUNTER_SETS.some((candidate) => candidate.id === set.id)).toBe(
        !UNSCRIPTED_ENCOUNTER_SET_IDS.has(set.id),
      );
      expect(
        () =>
          playableScenario(IRON_MAN, {
            players: [SPIDER_MAN],
            seed: 1,
            modularSetIds: [set.id as string, "paladin", "cape_killer"],
          }),
        set.id,
      ).toThrow();
    }
  });
});

describe("playableScenario at a Civil War leader", () => {
  it("builds what wave10Scenario builds, for the precon and for a custom scenario", () => {
    const seat = CORE_STARTER_DECKS.find((deck) => deck.id === SPIDER_MAN.starterDeckId)!;
    for (const choices of [
      {},
      {
        difficulty: "expert" as const,
        modularSetIds: ["paladin", "cape_killer", "bomb_scare"],
        mainSchemeStageIds: ["56121b", "56123b"],
      },
    ]) {
      const viaPlayable = playableScenario(IRON_MAN, { players: [SPIDER_MAN], seed: 3, ...choices });
      const direct = wave10Scenario(IRON_MAN, { players: [SPIDER_MAN], seed: 3, ...choices });
      expect(viaPlayable.encounterDeck).toEqual(direct.encounterDeck);
      expect(viaPlayable.mainSchemeStageIndexes).toEqual(direct.mainSchemeStageIndexes);
      expect(viaPlayable.villainCardId).toBe("56059");
      expect([viaPlayable.villainStartStageIndex, viaPlayable.villainLastStageIndex]).toEqual([
        direct.villainStartStageIndex,
        direct.villainLastStageIndex,
      ]);
      expect(viaPlayable.players[0]!.identityCardId).toBe(seat.identityCardId);
      const created = createGame(viaPlayable, WAVE10_DEPS);
      expect(created.ok).toBe(true);
    }
  });

  it("refuses the same choices the builder refuses, in the same words", () => {
    const refusal = (options: object): string => {
      try {
        playableScenario(IRON_MAN, { players: [SPIDER_MAN], seed: 1, ...options });
      } catch (error) {
        return (error as Error).message;
      }
      return "accepted";
    };
    expect(refusal({ modularSetIds: ["paladin", "cape_killer"] })).toBe(
      "Registration: Iron Man uses 3 to 4 modular sets, got 2",
    );
    expect(refusal({ modularSetIds: ["paladin", "cape_killer", "defenders"] })).toBe(
      "Registration: Iron Man: Defenders is a resistance set; Iron Man leads the registration side (MC56 p. 4)",
    );
    expect(refusal({ mainSchemeStageIds: ["56199b", "56064b"] })).toBe(
      "Registration: Iron Man: Rallying Call is a resistance stage; Iron Man leads the registration side (MC56 p. 4)",
    );
    expect(refusal({ setAsideModularSetIds: ["paladin"] })).toBe(
      "registration-iron-man: a Civil War scenario sets no modular sets aside (MC56 p. 4)",
    );
    expect(refusal({ difficulty: "extreme" })).toBe(
      'registration-iron-man is a cycle 10 scenario; "extreme" is Breakout\'s own multi-villain challenge',
    );
  });

  it("passes competitive mode on for the engine to refuse", () => {
    const config = playableScenario(IRON_MAN, { players: [SPIDER_MAN], seed: 1, gameMode: "competitive" });
    const created = createGame(config, WAVE10_DEPS);
    expect(created.ok).toBe(false);
    if (!created.ok)
      expect([created.error.code, created.error.message]).toEqual([
        "mode_unavailable",
        COMPETITIVE_MODE_UNAVAILABLE_MESSAGE,
      ]);
  });

  it("an extra modular set is shuffled in once, uncounted", () => {
    const plain = playableScenario(IRON_MAN, { players: [SPIDER_MAN], seed: 1 });
    const extra = playableScenario(IRON_MAN, { players: [SPIDER_MAN], seed: 1, extraModularSetIds: ["longshot"] });
    expect(extra.encounterDeck).toHaveLength(plain.encounterDeck!.length + 1);
  });

  it("a stage pick at a scenario whose stages are not a choice is refused, not dropped", () => {
    expect(() =>
      playableScenario("rhino", { players: [SPIDER_MAN], seed: 1, mainSchemeStageIds: ["56063b", "56064b"] }),
    ).toThrow("rhino: the main scheme's stages are not a setup choice at this scenario");
  });
});

describe("playableScenarioOffer at a Civil War leader", () => {
  it("lists the two sides and their leaders", () => {
    const offer = playableScenarioOffer(IRON_MAN);
    expect(offer.sides).toEqual([
      {
        side: "registration",
        name: "Registration",
        leaders: [
          { scenarioId: "registration-iron-man", name: "Iron Man", leaderCardId: "56059" },
          { scenarioId: "registration-captain-marvel", name: "Captain Marvel", leaderCardId: "56092" },
        ],
      },
      {
        side: "resistance",
        name: "Resistance",
        leaders: [
          { scenarioId: "resistance-captain-america", name: "Captain America", leaderCardId: "56137" },
          { scenarioId: "resistance-spider-woman", name: "Spider-Woman", leaderCardId: "56168" },
        ],
      },
    ]);
    expect(offer.sides).toEqual(civilWarSidesOffer());
  });

  it("gives the count of modular sets as a range, with the problem of the picks made so far", () => {
    expect(playableScenarioOffer(IRON_MAN).modularSetCount).toEqual({ min: 3, max: 4, problem: null });
    expect(
      playableScenarioOffer(IRON_MAN, { modularSetIds: ["paladin", "cape_killer", "martial_law"] }).modularSetCount,
    ).toEqual({ min: 3, max: 4, problem: null });
    expect(playableScenarioOffer(IRON_MAN, { modularSetIds: ["paladin", "cape_killer"] }).modularSetCount).toEqual({
      min: 3,
      max: 4,
      problem: "Registration: Iron Man uses 3 to 4 modular sets, got 2",
    });
    expect(
      playableScenarioOffer(IRON_MAN, {
        modularSetIds: ["paladin", "cape_killer", "martial_law", "mighty_avengers", "the_initiative"],
      }).modularSetCount.problem,
    ).toBe("Registration: Iron Man uses 3 to 4 modular sets, got 5");
  });

  it("lists the box's sixteen modular sets first, each with its side and whether this leader may use it", () => {
    const sets = playableScenarioOffer("resistance-spider-woman").modularSets!;
    const sided = sets.filter((set) => set.side !== null);
    expect(sets.slice(0, 16)).toEqual(sided);
    expect(sided.filter((set) => set.side === "resistance").map((set) => set.id)).toEqual([
      "atlanteans",
      "cloak_and_dagger_modular",
      "defenders",
      "hells_kitchen",
      "namor_modular",
      "new_avengers",
      "secret_avengers",
      "spider_man_modular",
    ]);
    expect(sided.filter((set) => set.side === "registration").map((set) => set.id)).toEqual([
      "cape_killer",
      "dangerous_recruits",
      "heroes_for_hire",
      "maria_hill_modular",
      "martial_law",
      "mighty_avengers",
      "paladin",
      "the_initiative",
    ]);
    for (const set of sided) {
      expect(set.cardCount, set.id).toBe(5);
      expect(set.ok, set.id).toBe(set.side === "resistance");
    }
    expect(sided.filter((set) => set.recommended).map((set) => set.id)).toEqual([
      "cloak_and_dagger_modular",
      "defenders",
      "hells_kitchen",
      "spider_man_modular",
    ]);
    expect(sets.find((set) => set.id === "heroes_for_hire")).toEqual({
      id: "heroes_for_hire",
      name: "Heroes for Hire",
      side: "registration",
      cardCount: 5,
      dominantCardType: "minion",
      recommended: false,
      ok: false,
      problem: "Heroes for Hire is a registration set; Spider-Woman leads the resistance (MC56 p. 4)",
    });
  });

  it("lists neutral sets from other products as usable, and no set that is never a modular choice", () => {
    const sets = playableScenarioOffer(IRON_MAN).modularSets!;
    expect(sets.find((set) => set.id === "bomb_scare")).toEqual({
      id: "bomb_scare",
      name: "Bomb Scare",
      side: null,
      cardCount: 6,
      dominantCardType: "treachery",
      recommended: false,
      ok: true,
      problem: null,
    });
    for (const set of sets.filter((candidate) => candidate.side === null)) expect(set.ok, set.id).toBe(true);
    const ids = sets.map((set) => set.id);
    for (const never of [
      "standard",
      "expert",
      "standard_pvp_registration",
      "standard_pvp_resistance",
      "iron_man_leader",
      "captain_america_leader",
      "registration",
      "resistance",
      "rhino",
      "longshot",
      "hulkling_nemesis",
    ])
      expect(ids, never).not.toContain(never);
    expect(new Set(ids).size).toBe(ids.length);
    for (const set of sets) expect(set.cardCount, set.id).toBeGreaterThan(0);
  });

  it("lists the stage options of the leader's side with the recommendation and the problem of the picks so far", () => {
    const offer = playableScenarioOffer("resistance-captain-america").mainSchemeStages!;
    expect(offer.recommended).toEqual(["56141b", "56142b"]);
    expect(offer.problem).toBeNull();
    // Civil War's four of each number; Synthezoid Smackdown's stage of each number joins when the pack is un-gated
    // (docs/phase7-synthezoid.md §3 M1, `wave10/main-scheme-stage-pool.test.ts`).
    expect(offer.stages.map((stage) => stage.options.map((option) => option.printedCardId))).toEqual([
      ["56141b", "56172b", "56199b", "56200b"],
      ["56142b", "56173b", "56201b", "56202b"],
    ]);
    expect(offer.stages[0]!.options[3]).toEqual({
      printedCardId: "56200b",
      name: "Going Underground",
      stageNumber: 1,
      targetThreat: { base: 0, perPlayer: 7 },
      gist: "The enemy leader gains steady.",
    });
    expect(
      playableScenarioOffer("resistance-captain-america", { mainSchemeStageIds: ["56200b", "56201b"] })
        .mainSchemeStages!.problem,
    ).toBeNull();
    expect(
      playableScenarioOffer("resistance-captain-america", { mainSchemeStageIds: ["56200b", "56064b"] })
        .mainSchemeStages!.problem,
    ).toBe("Negative Zone Prison is a registration stage; Captain America leads the resistance (MC56 p. 4)");
    expect(
      playableScenarioOffer("resistance-captain-america", { mainSchemeStageIds: ["56200b"] }).mainSchemeStages!.problem,
    ).toBe("Choose a stage 2 of Superhero Resistance: one stage of each number is needed.");
  });

  it("offers cooperative mode and names competitive mode as not available yet", () => {
    expect(playableScenarioOffer(IRON_MAN).gameModes).toEqual([
      { mode: "cooperative", available: true, note: null },
      {
        mode: "competitive",
        available: false,
        note: "Competitive mode is coming soon. Play this scenario cooperatively for now.",
      },
    ]);
    expect(playableScenarioOffer(IRON_MAN).gameModes).toEqual(civilWarGameModes());
  });

  it("keeps the Standard and Expert alternatives every scenario with the plain sets gets", () => {
    expect(playableScenarioOffer(IRON_MAN).difficultySets).toEqual(playableScenarioOffer("rhino").difficultySets);
  });
});

describe("playableScenarioOffer at every other scenario", () => {
  it("has no sides, stages, set list or game modes, and one count of modular sets", () => {
    const rhino = playableScenarioOffer("rhino");
    expect([rhino.sides, rhino.mainSchemeStages, rhino.modularSets, rhino.gameModes]).toEqual([null, null, null, null]);
    expect(rhino.modularSetCount).toEqual({ min: 1, max: 1, problem: null });
    expect(playableScenarioOffer("rhino", { modularSetIds: [] }).modularSetCount.problem).toBe(
      "Rhino uses 1 modular set(s), got 0",
    );
    // Every scenario of an earlier wave: the four Civil War leaders are in the playable pool now and do have sides.
    for (const scenario of PLAYABLE_SCENARIO_RECORDS.filter(
      (record) => !WAVE10_SCENARIOS.some((w) => w.id === record.id),
    )) {
      const offer = playableScenarioOffer(scenario.id);
      expect(offer.sides, scenario.id).toBeNull();
      expect(offer.modularSetCount.min, scenario.id).toBe(offer.modularSetCount.max);
    }
  });
});
