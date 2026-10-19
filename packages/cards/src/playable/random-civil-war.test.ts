import { CORE_STARTER_DECKS, WAVE10_SCENARIOS } from "@mc/content";
import { describe, expect, it } from "vitest";
import { WAVE10_GAME_ENCOUNTER_SETS, wave10MainSchemeCard, wave10Scenario } from "../wave10/setup.js";
import { playableScenario } from "./index.js";
import { randomCivilWarScenario } from "./random-civil-war.js";
import { scenarioIsScripted } from "./unscripted.js";
import { playableScenarioOffer } from "./scenario-options.js";

const SEAT = { starterDeckId: "core-spider-man-justice" } as const;
const SEEDS = Array.from({ length: 400 }, (_, i) => i + 1);
const sideOfSet = (id: string) => WAVE10_GAME_ENCOUNTER_SETS.find((set) => set.id === id)?.side;
const sideOfLeader = (id: string) => WAVE10_SCENARIOS.find((s) => s.id === id)!.side;

describe("randomCivilWarScenario", () => {
  it("is a function of its seed", () => {
    expect(randomCivilWarScenario(7)).toEqual(randomCivilWarScenario(7));
    expect(
      SEEDS.map((s) => JSON.stringify(randomCivilWarScenario(s))).filter((v, i, a) => a.indexOf(v) === i).length,
    ).toBeGreaterThan(300);
  });

  it("covers every leader, stage and set of the side over many seeds, and never mixes sides", () => {
    const leaders = new Set<string>();
    const stages1 = new Set<string>();
    const stages2 = new Set<string>();
    const sets = new Set<string>();
    for (const seed of SEEDS) {
      const r = randomCivilWarScenario(seed);
      const side = sideOfLeader(r.scenarioId);
      leaders.add(r.scenarioId);
      stages1.add(r.mainSchemeStageIds[0]);
      stages2.add(r.mainSchemeStageIds[1]);
      for (const id of r.modularSetIds) {
        sets.add(id);
        expect(sideOfSet(id)).toBe(side);
      }
    }
    // Every offered leader: a gated pack's leaders (`unscripted.ts`) are not drawn.
    expect([...leaders].sort()).toEqual(
      WAVE10_SCENARIOS.filter(scenarioIsScripted)
        .map((s) => s.id as string)
        .sort(),
    );
    const stageIds = (n: number) =>
      WAVE10_SCENARIOS.filter(scenarioIsScripted).flatMap((s) =>
        playableScenarioOffer(s.id)
          .mainSchemeStages!.stages.find((st) => st.stageNumber === n)!
          .options.map((o) => o.printedCardId),
      );
    expect([...stages1].sort()).toEqual([...new Set(stageIds(1))].sort());
    expect([...stages2].sort()).toEqual([...new Set(stageIds(2))].sort());
    const sided = WAVE10_GAME_ENCOUNTER_SETS.filter(
      (set) =>
        set.side !== undefined &&
        playableScenarioOffer(WAVE10_SCENARIOS[0]!.id).modularSets!.some((m) => m.id === set.id),
    ).length;
    expect(sets.size).toBe(sided);
  });

  it("honors the count, default 4", () => {
    expect(randomCivilWarScenario(1).modularSetIds).toHaveLength(4);
    for (const seed of SEEDS.slice(0, 50)) {
      const r = randomCivilWarScenario(seed, { modularCount: 3 });
      expect(r.modularSetIds).toHaveLength(3);
      expect(new Set(r.modularSetIds).size).toBe(3);
    }
    expect(() => randomCivilWarScenario(1, { modularCount: 5 })).toThrow("modular sets");
  });

  it("keeps every pin", () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const r = randomCivilWarScenario(seed, { side: "resistance" });
      expect(sideOfLeader(r.scenarioId)).toBe("resistance");
      const leader = randomCivilWarScenario(seed, { leaderId: "registration-iron-man" });
      expect(leader.scenarioId).toBe("registration-iron-man");
      const offer = playableScenarioOffer("registration-iron-man");
      const stage1 = offer.mainSchemeStages!.stages[0]!.options[seed % 4]!.printedCardId;
      const set = offer.modularSets!.find((m) => m.ok && m.side === "registration")!.id;
      const kept = randomCivilWarScenario(seed, { stage1Id: stage1, modularSetIds: [set], modularCount: 3 });
      expect(sideOfLeader(kept.scenarioId)).toBe("registration");
      expect(kept.mainSchemeStageIds[0]).toBe(stage1);
      expect(kept.modularSetIds[0]).toBe(set);
      expect(kept.modularSetIds).toHaveLength(3);
    }
  });

  it("returns a full pin set unchanged", () => {
    const offer = playableScenarioOffer("resistance-captain-america");
    const stages: [string, string] = [
      offer.mainSchemeStages!.stages[0]!.options[1]!.printedCardId as string,
      offer.mainSchemeStages!.stages[1]!.options[2]!.printedCardId as string,
    ];
    const sets = offer
      .modularSets!.filter((m) => m.ok && m.side === "resistance")
      .slice(0, 3)
      .map((m) => m.id);
    expect(
      randomCivilWarScenario(99, {
        leaderId: "resistance-captain-america",
        stage1Id: stages[0],
        stage2Id: stages[1],
        modularSetIds: sets,
        modularCount: 3,
      }),
    ).toEqual({ scenarioId: "resistance-captain-america", mainSchemeStageIds: stages, modularSetIds: sets });
  });

  it("can draw other products' sets when asked, never the other side's", () => {
    const seen = new Set<string>();
    for (const seed of SEEDS) {
      const r = randomCivilWarScenario(seed, { includeOtherProducts: true });
      for (const id of r.modularSetIds) {
        seen.add(id);
        expect([sideOfLeader(r.scenarioId), undefined]).toContain(sideOfSet(id));
      }
    }
    expect([...seen].some((id) => sideOfSet(id) === undefined)).toBe(true);
  });

  it("always builds a game the validators accept", () => {
    const seat = CORE_STARTER_DECKS.find((deck) => deck.id === SEAT.starterDeckId)!;
    expect(seat).toBeDefined();
    for (const seed of SEEDS.slice(0, 80)) {
      for (const includeOtherProducts of [false, true]) {
        const r = randomCivilWarScenario(seed, { includeOtherProducts, modularCount: 3 + (seed % 2) });
        const options = {
          players: [SEAT],
          seed,
          modularSetIds: r.modularSetIds,
          mainSchemeStageIds: r.mainSchemeStageIds,
        };
        expect(() => wave10Scenario(r.scenarioId, options)).not.toThrow();
        expect(() => playableScenario(r.scenarioId, options)).not.toThrow();
        wave10MainSchemeCard(WAVE10_SCENARIOS.find((s) => s.id === r.scenarioId)!);
      }
    }
  });

  it("refuses impossible pins in the validators' words", () => {
    const resistanceStage =
      playableScenarioOffer("resistance-captain-america").mainSchemeStages!.stages[0]!.options[0]!.printedCardId;
    expect(() => randomCivilWarScenario(1, { leaderId: "registration-iron-man", stage1Id: resistanceStage })).toThrow(
      "is a resistance stage; Iron Man leads the registration side",
    );
    const resistanceSet = playableScenarioOffer("resistance-captain-america").modularSets!.find(
      (m) => m.side === "resistance",
    )!.id;
    expect(() =>
      randomCivilWarScenario(1, { leaderId: "registration-iron-man", modularSetIds: [resistanceSet as string] }),
    ).toThrow("set; Iron Man leads the registration side");
    expect(() => randomCivilWarScenario(1, { side: "resistance", leaderId: "registration-iron-man" })).toThrow(
      "does not lead",
    );
  });
});
