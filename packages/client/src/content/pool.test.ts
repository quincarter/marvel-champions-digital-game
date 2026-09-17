/**
 * The one pool module every scene/screen/engine session reads
 * (PLAN.md Phase 7 wave 1 client wiring). This is a thin re-export layer, so
 * the test is mostly "does it actually aggregate Core plus wave 1" rather
 * than exercising rules — the rules themselves are `@mc/engine`'s and
 * `@mc/cards`' own, tested there.
 */
import { describe, expect, test } from "vitest";
import { CORE_SCENARIOS, CORE_STARTER_DECKS, WAVE1_SCENARIOS, WAVE1_STARTER_DECKS, poolVersionOf } from "@mc/content";
import { createGame } from "@mc/engine";
import { POOL_CARDS, POOL_DEPS, POOL_PACKS, POOL_SCENARIOS, POOL_STARTER_DECKS, POOL_VERSION, buildScenario, packNameOf } from "./pool.js";

describe("POOL_CARDS", () => {
  test("is Core plus every wave 1 pack — noticeably more than Core alone", () => {
    expect(POOL_CARDS.length).toBeGreaterThan(450);
  });
});

describe("POOL_SCENARIOS", () => {
  test("is Core's three scenarios then wave 1's three, in that order", () => {
    expect(POOL_SCENARIOS.map((s) => s.id)).toEqual([...CORE_SCENARIOS, ...WAVE1_SCENARIOS].map((s) => s.id));
    expect(POOL_SCENARIOS.length).toBe(6);
  });
});

describe("POOL_STARTER_DECKS", () => {
  test("is Core's six precons then wave 1's six", () => {
    expect(POOL_STARTER_DECKS.map((d) => d.id)).toEqual([...CORE_STARTER_DECKS, ...WAVE1_STARTER_DECKS].map((d) => d.id));
    expect(POOL_STARTER_DECKS.length).toBe(12);
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
      expect(packNameOf(scenario.packCode as string), scenario.packCode as string).not.toBe(scenario.packCode as string);
    }
    expect(packNameOf("twc")).toBe("The Wrecking Crew");
    expect(packNameOf("core")).toBe("Core Set");
  });

  test("falls back to the code itself for one the pool doesn't know", () => {
    expect(packNameOf("nope")).toBe("nope");
  });

  test("POOL_PACKS covers Core and every wave 1 pack, with no duplicate codes", () => {
    expect(POOL_PACKS.length).toBe(9);
    expect(new Set(POOL_PACKS.map((p) => p.code as string)).size).toBe(9);
  });
});

describe("buildScenario", () => {
  test("builds a Core scenario (Rhino) unchanged", () => {
    const config = buildScenario("rhino", { difficulty: "standard", players: [{ starterDeckId: "core-spider-man-justice" }], seed: 1 });
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
});
