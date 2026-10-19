/**
 * The one pool module every scene/screen/engine session reads
 * (PLAN.md Phase 7 client wiring). This is a thin re-export layer, so
 * the test is mostly "does it actually aggregate Core, wave 1, cycle 1, cycle 2, cycle 3 and cycle 4" rather
 * than exercising rules — the rules themselves are `@mc/engine`'s and
 * `@mc/cards`' own, tested there.
 */
import { describe, expect, test } from "vitest";
import {
  CORE_SCENARIOS,
  CORE_STARTER_DECKS,
  WAVE1_SCENARIOS,
  WAVE1_STARTER_DECKS,
  WAVE2_SCENARIOS,
  WAVE2_STARTER_DECKS,
  WAVE3_SCENARIOS,
  WAVE3_STARTER_DECKS,
  WAVE4_SCENARIOS,
  WAVE4_STARTER_DECKS,
  WAVE5_SCENARIOS,
  WAVE5_STARTER_DECKS,
  WAVE6_STARTER_DECKS,
  WAVE7_SCENARIOS,
  WAVE7_STARTER_DECKS,
  WAVE8_SCENARIOS,
  WAVE8_STARTER_DECKS,
  WAVE9_SCENARIOS,
  WAVE9_STARTER_DECKS,
  WAVE10_SCENARIOS,
  WAVE10_ENCOUNTER_SETS,
  WAVE10_STARTER_DECKS,
  MUT_GEN_SCENARIOS,
  MOJO_SCENARIOS,
  poolVersionOf,
} from "@mc/content";
import { UNSCRIPTED_ENCOUNTER_SET_IDS } from "@mc/cards";
import { createGame } from "@mc/engine";
import {
  POOL_CARDS,
  POOL_DEPS,
  POOL_ENCOUNTER_SETS,
  POOL_HERO_SHELF_PACKS,
  POOL_PACKS,
  POOL_SCENARIOS,
  POOL_STARTER_DECKS,
  POOL_VERSION,
  buildScenario,
  packNameOf,
} from "./pool.js";

describe("POOL_CARDS", () => {
  test("is Core plus every wave 1 and cycle 1 pack — noticeably more than Core alone", () => {
    expect(POOL_CARDS.length).toBeGreaterThan(800);
  });

  test("lists no card twice (the waves are sibling pools that both start from Core)", () => {
    expect(new Set(POOL_CARDS.map((card) => card.id as string)).size).toBe(POOL_CARDS.length);
  });
});

describe("POOL_SCENARIOS", () => {
  test("is Core's three scenarios, wave 1's three, cycle 1's six, cycle 2's five, cycle 3's six, cycle 4's five, then Mutant Genesis' five, MojoMania's three and NeXt Evolution's five, then Age of Apocalypse's five and Agents of S.H.I.E.L.D.'s five and Trickster Takeover's Enchantress and God of Lies, then Civil War's four leaders and Synthezoid Smackdown's two, in that order", () => {
    expect(POOL_SCENARIOS.map((s) => s.id)).toEqual(
      [
        ...CORE_SCENARIOS,
        ...WAVE1_SCENARIOS,
        ...WAVE2_SCENARIOS,
        ...WAVE3_SCENARIOS,
        ...WAVE4_SCENARIOS,
        ...WAVE5_SCENARIOS,
        ...MUT_GEN_SCENARIOS,
        ...MOJO_SCENARIOS,
        ...WAVE7_SCENARIOS,
        ...WAVE8_SCENARIOS,
        ...WAVE9_SCENARIOS,
        ...WAVE10_SCENARIOS,
      ].map((s) => s.id),
    );
    expect(POOL_SCENARIOS.length).toBe(
      23 +
        WAVE5_SCENARIOS.length +
        MUT_GEN_SCENARIOS.length +
        MOJO_SCENARIOS.length +
        WAVE7_SCENARIOS.length +
        WAVE8_SCENARIOS.length +
        7 +
        WAVE10_SCENARIOS.length,
    );
  });
});

describe("POOL_STARTER_DECKS", () => {
  test("is Core's six precons, wave 1's six, cycle 1's six, cycle 2's six, cycle 3's six, cycle 4's six, then cycle 6's, cycle 7's, cycle 8's, cycle 9's and cycle 10's (Tigra and Hulkling)", () => {
    expect(POOL_STARTER_DECKS.map((d) => d.id)).toEqual(
      [
        ...CORE_STARTER_DECKS,
        ...WAVE1_STARTER_DECKS,
        ...WAVE2_STARTER_DECKS,
        ...WAVE3_STARTER_DECKS,
        ...WAVE4_STARTER_DECKS,
        ...WAVE5_STARTER_DECKS,
        ...WAVE6_STARTER_DECKS,
        ...WAVE7_STARTER_DECKS,
        ...WAVE8_STARTER_DECKS,
        ...WAVE9_STARTER_DECKS,
        ...WAVE10_STARTER_DECKS,
      ].map((d) => d.id),
    );
    expect(POOL_STARTER_DECKS.length).toBe(
      24 +
        WAVE4_STARTER_DECKS.length +
        WAVE5_STARTER_DECKS.length +
        WAVE6_STARTER_DECKS.length +
        WAVE7_STARTER_DECKS.length +
        WAVE8_STARTER_DECKS.length +
        WAVE9_STARTER_DECKS.length +
        WAVE10_STARTER_DECKS.length,
    );
    expect(WAVE10_STARTER_DECKS.map((d) => d.id)).toEqual([
      "tigra-aggression",
      "hulkling-protection",
      "wonder-man-justice",
      "hercules-leadership",
    ]);
  });
});

describe("POOL_VERSION", () => {
  test("is poolVersionOf(POOL_CARDS) — not Core's own version", () => {
    expect(POOL_VERSION).toBe(poolVersionOf(POOL_CARDS));
  });
});

describe("packNameOf", () => {
  test("names every scenario pack code the pool's scenarios actually use", () => {
    for (const scenario of POOL_SCENARIOS) {
      expect(packNameOf(scenario.packCode as string), scenario.packCode as string).not.toBe(
        scenario.packCode as string,
      );
    }
    expect(packNameOf("twc")).toBe("The Wrecking Crew");
    expect(packNameOf("core")).toBe("Core Set");
  });

  test("falls back to the code itself for one the pool doesn't know", () => {
    expect(packNameOf("nope")).toBe("nope");
  });

  test("POOL_PACKS covers Core and every wave 1, cycle 1, cycle 2, cycle 3 and cycle 4 (shipped-so-far) cycle 6 to cycle 10 pack (Civil War, Synthezoid Smackdown), with no duplicate codes", () => {
    expect(POOL_PACKS.length).toBe(60);
    expect(new Set(POOL_PACKS.map((p) => p.code as string)).size).toBe(60);
    expect(packNameOf("cw")).toBe("Civil War");
    expect(packNameOf("synthezoid")).toBe("Synthezoid Smackdown");
    expect(packNameOf("wonder_man")).toBe("Wonder Man");
    expect(packNameOf("hercules")).toBe("Hercules");
  });
});

describe("buildScenario", () => {
  test("builds a Core scenario (Rhino) unchanged", () => {
    const config = buildScenario("rhino", {
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 1,
    });
    const setup = createGame(config, POOL_DEPS);
    expect(setup.ok).toBe(true);
  });

  test("builds every wave 1 scenario, including Breakout's four villains", () => {
    for (const scenario of WAVE1_SCENARIOS) {
      const config = buildScenario(scenario.id as string, {
        difficulty: "standard",
        players: [{ starterDeckId: "cap-leadership" }],
        seed: 1,
      });
      const setup = createGame(config, POOL_DEPS);
      expect(setup.ok, `${scenario.id as string}: ${setup.ok ? "" : setup.error.message}`).toBe(true);
    }
  });

  test("builds every cycle 1 scenario, including Kang's separate game areas", () => {
    for (const scenario of WAVE2_SCENARIOS) {
      const config = buildScenario(scenario.id as string, {
        difficulty: "standard",
        players: [{ starterDeckId: "cap-leadership" }],
        seed: 1,
      });
      const setup = createGame(config, POOL_DEPS);
      expect(setup.ok, `${scenario.id as string}: ${setup.ok ? "" : setup.error.message}`).toBe(true);
    }
  });

  test("seats a cycle 1 precon at a wave 1 scenario", () => {
    const config = buildScenario("risky-business", { players: [{ starterDeckId: "qsv-protection" }], seed: 1 });
    expect(createGame(config, POOL_DEPS).ok).toBe(true);
  });

  test("builds every cycle 2 scenario (The Galaxy's Most Wanted's five)", () => {
    for (const scenario of WAVE3_SCENARIOS) {
      const config = buildScenario(scenario.id as string, {
        difficulty: "standard",
        players: [{ starterDeckId: "groot-protection" }],
        seed: 1,
      });
      const setup = createGame(config, POOL_DEPS);
      expect(setup.ok, `${scenario.id as string}: ${setup.ok ? "" : setup.error.message}`).toBe(true);
    }
  });

  test("seats a Core precon at a cycle 2 scenario, and a cycle 2 precon at a Core scenario", () => {
    const atGmw = buildScenario("nebula", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 1 });
    expect(createGame(atGmw, POOL_DEPS).ok).toBe(true);
    const atCore = buildScenario("rhino", { players: [{ starterDeckId: "groot-protection" }], seed: 1 });
    expect(createGame(atCore, POOL_DEPS).ok).toBe(true);
  });

  test("builds every cycle 3 scenario (The Mad Titan's Shadow's five, and The Hood)", () => {
    for (const scenario of WAVE4_SCENARIOS) {
      const config = buildScenario(scenario.id as string, {
        difficulty: "standard",
        players: [{ starterDeckId: "spectrum-leadership" }],
        seed: 1,
      });
      const setup = createGame(config, POOL_DEPS);
      expect(setup.ok, `${scenario.id as string}: ${setup.ok ? "" : setup.error.message}`).toBe(true);
    }
  });

  test("seats a Core precon at a cycle 3 scenario, and a cycle 3 precon at a Core scenario", () => {
    const atMts = buildScenario("ebony-maw", { players: [{ starterDeckId: "core-iron-man-aggression" }], seed: 1 });
    expect(createGame(atMts, POOL_DEPS).ok).toBe(true);
    const atCore = buildScenario("rhino", { players: [{ starterDeckId: "spectrum-leadership" }], seed: 1 });
    expect(createGame(atCore, POOL_DEPS).ok).toBe(true);
  });

  test("builds every cycle 4 (sm) scenario shipped so far (Sandman, Venom, Mysterio, The Sinister Six, Venom Goblin)", () => {
    for (const scenario of WAVE5_SCENARIOS) {
      const config = buildScenario(scenario.id as string, {
        difficulty: "standard",
        players: [{ starterDeckId: "ghost-spider" }],
        seed: 1,
      });
      const setup = createGame(config, POOL_DEPS);
      expect(setup.ok, `${scenario.id as string}: ${setup.ok ? "" : setup.error.message}`).toBe(true);
    }
  });

  test("seats a Core precon at a cycle 4 scenario, and a cycle 4 precon at a Core scenario", () => {
    const atSm = buildScenario("sandman", { players: [{ starterDeckId: "core-iron-man-aggression" }], seed: 1 });
    expect(createGame(atSm, POOL_DEPS).ok).toBe(true);
    const atCore = buildScenario("rhino", { players: [{ starterDeckId: "ghost-spider" }], seed: 1 });
    expect(createGame(atCore, POOL_DEPS).ok).toBe(true);
  });
});

describe("the Civil War box in the pool", () => {
  test("every wave 10 set is in the pool's encounter sets, with both hero packs' nemesis sets and All Versus All", () => {
    const ids = new Set(POOL_ENCOUNTER_SETS.map((set) => set.id as string));
    for (const set of WAVE10_ENCOUNTER_SETS.filter((s) => !UNSCRIPTED_ENCOUNTER_SET_IDS.has(s.id as string)))
      expect(ids.has(set.id as string), set.id as string).toBe(true);
  });

  test("the Wonder Man pack is in the pool as a hero with his precon: shelved in the Civil War cycle", () => {
    expect(POOL_CARDS.some((card) => card.id === "58001a")).toBe(true);
    expect(POOL_STARTER_DECKS.filter((deck) => deck.identityCardId === "58001a").map((d) => d.id)).toEqual([
      "wonder-man-justice",
    ]);
    expect(POOL_HERO_SHELF_PACKS.some((pack) => pack.code === "wonder_man" && pack.cycleId === "cycle10")).toBe(true);
  });

  test("the Hercules pack is in the pool with his precon, shelved in the Civil War cycle, and starts a game with All Versus All", () => {
    expect(POOL_CARDS.some((card) => card.id === "59001a")).toBe(true);
    expect(POOL_STARTER_DECKS.filter((deck) => deck.identityCardId === "59001a").map((d) => d.id)).toEqual([
      "hercules-leadership",
    ]);
    expect(POOL_HERO_SHELF_PACKS.some((pack) => pack.code === "hercules" && pack.cycleId === "cycle10")).toBe(true);
    const config = buildScenario("rhino", {
      players: [{ starterDeckId: "hercules-leadership" }],
      seed: 1,
      modularSetIds: ["all_versus_all"],
    });
    expect(createGame(config, POOL_DEPS).ok).toBe(true);
  });

  test("its four leaders are scenarios of the pack Civil War, and the two precons start a game at one", async () => {
    expect(POOL_SCENARIOS.filter((s) => s.packCode === "cw").map((s) => s.id)).toEqual(
      WAVE10_SCENARIOS.filter((s) => s.packCode === "cw").map((s) => s.id),
    );
    // Synthezoid Smackdown's two leaders follow them on the shelf (docs/phase7-synthezoid.md §4.3; pool-synthezoid.test.ts).
    expect(POOL_SCENARIOS.filter((s) => s.packCode === "synthezoid").map((s) => s.id)).toEqual([
      "registration-she-hulk",
      "resistance-vision",
    ]);
    for (const starterDeckId of ["tigra-aggression", "hulkling-protection"]) {
      const config = buildScenario("registration-iron-man", {
        seed: 1,
        players: [{ starterDeckId }],
      });
      expect(createGame(config, POOL_DEPS).ok, starterDeckId).toBe(true);
    }
  });
});
