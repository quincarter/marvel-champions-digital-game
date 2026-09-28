import { CORE_CARDS, encounterSetId } from "@mc/content";
import { activeEncounterDeck, activeVillain, createGame, replay } from "@mc/engine";
import { describe, expect, it, test } from "vitest";
import { inst, instancesOf, playerOf, P1 } from "../../../testing/harness.js";
import { playToOutcome } from "../../../testing/driver.js";
import { WAVE5_DEPS } from "../../index.js";
import { wave5Scenario } from "../../setup.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";

/**
 * The Sandman scenario's own setup and two full games (docs/phase7-wave5.md §2.2, wave 5 step 3): Ghost-Spider's
 * own real precon (`ghost-spider`) and a Core precon (`core-captain-marvel-leadership`), each played headlessly by
 * the card-name-agnostic greedy driver to a real outcome, then replayed to a deep-equal final state — the
 * `wave4/mts/thanos-e2e.test.ts` shape.
 */
describe("wave5Scenario('sandman')", () => {
  it("standard: Sandman (I)-(II); his own set + City in Chaos + Standard, one modular; City Streets in play with 4 sand counters", () => {
    const config = ghostSpiderScenario("sandman", {
      seed: 1,
      modularSetIds: [encounterSetId("bomb_scare")],
    });
    const created = createGame(config, WAVE5_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const state = created.state;
    expect([activeVillain(state).stageIndex, activeVillain(state).lastStageIndex]).toEqual([0, 1]);
    const streets = instancesOf(state, "27065")[0];
    expect(streets).toBeDefined();
    expect(state.villainArea).toContain(streets);
    expect(inst(state, streets!).counters["sand"]).toBe(4);
    // The nemesis and obligation sets are set aside for Ghost-Spider.
    expect(playerOf(state, P1).setAside.length).toBeGreaterThan(0);
    // Sandman + City in Chaos + Standard + Bomb Scare.
    expect(activeEncounterDeck(state).deck.length).toBeGreaterThan(0);
  });

  it("expert: Sandman starts at stage (II)-(III)", () => {
    const config = ghostSpiderScenario("sandman", {
      seed: 2,
      difficulty: "expert",
      modularSetIds: [encounterSetId("bomb_scare")],
    });
    const created = createGame(config, WAVE5_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    expect([activeVillain(created.state).stageIndex, activeVillain(created.state).lastStageIndex]).toEqual([1, 2]);
  });

  it("expert adds Core's Expert encounter set; standard doesn't (RRG 1.8 \"Modes of Play\", Expert Mode)", () => {
    const expertIds = new Set(
      CORE_CARDS.filter(
        (card) => "encounterSetIds" in card && card.encounterSetIds.includes(encounterSetId("expert")),
      ).map((card) => card.id as string),
    );
    expect(expertIds.size).toBeGreaterThan(0);
    const inDeck = (difficulty: "standard" | "expert") =>
      ghostSpiderScenario("sandman", {
        seed: 3,
        difficulty,
        modularSetIds: [encounterSetId("bomb_scare")],
      }).encounterDeck.filter((id) => expertIds.has(id as string));
    expect(inDeck("standard")).toEqual([]);
    expect(inDeck("expert").length).toBeGreaterThan(0);
  });

  it("builds The Sinister Six (multipleVillains) too — its own scenario tests live in wave5/sm/sinister-six/", () => {
    expect(() =>
      wave5Scenario("sinister-six", { seed: 1, players: [{ starterDeckId: "ghost-spider" }] }),
    ).not.toThrow();
  });
});

test("Sandman, solo: Ghost-Spider", () => {
  const config = ghostSpiderScenario("sandman", { seed: 2026, modularSetIds: [encounterSetId("bomb_scare")] });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

test("Sandman, solo: a Core precon (Captain Marvel / Leadership)", () => {
  const config = wave5Scenario("sandman", {
    seed: 2027,
    players: [{ starterDeckId: "core-captain-marvel-leadership" }],
    modularSetIds: [encounterSetId("bomb_scare")],
  });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

// docs/phase7-wave5-qa-sm-scenarios-1.md §2: a 2-player game (Ghost-Spider + Spider-Man (Miles Morales)) played
// to a real outcome and replayed to a deep-equal final state.
test("Sandman, 2 players: Ghost-Spider and Spider-Man (Miles Morales)", () => {
  const config = ghostSpiderScenario("sandman", {
    seed: 2028,
    modularSetIds: [encounterSetId("bomb_scare")],
    extraPlayers: [{ starterDeckId: "spider-man-morales" }],
  });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 180_000);

// docs/phase7-wave5-qa-sm-scenarios-1.md §2: an expert-mode game (Sandman starts at stage (II)-(III)) played to a
// real outcome and replayed to a deep-equal final state.
test("Sandman, solo expert: Ghost-Spider", () => {
  const config = ghostSpiderScenario("sandman", {
    seed: 2029,
    difficulty: "expert",
    modularSetIds: [encounterSetId("bomb_scare")],
  });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 180_000);
