import { CORE_CARDS, encounterSetId } from "@mc/content";
import { activeEncounterDeck, activeVillain, createGame, replay } from "@mc/engine";
import { describe, expect, it, test } from "vitest";
import { inst, instancesOf, playerOf, P1 } from "../../../testing/harness.js";
import { playToOutcome } from "../../../testing/driver.js";
import { WAVE5_DEPS } from "../../index.js";
import { wave5Scenario } from "../../setup.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";
import { spiderManMoralesScenario } from "../spider-man-morales/support.js";

/**
 * The Venom scenario's own setup and two full games (docs/phase7-wave5.md §2.2, wave 5 step 3): Spider-Man (Miles
 * Morales)'s own real precon and a Core precon (`core-captain-marvel-leadership`), each played headlessly by the
 * card-name-agnostic greedy driver to a real outcome, then replayed to a deep-equal final state — the
 * `sandman/scenario.test.ts` shape.
 */
describe("wave5Scenario('venom')", () => {
  it("standard: Venom (I)-(II); his own set + Symbiotic Strength + Standard, one modular; Bell Tower in play, Quiet side", () => {
    const config = ghostSpiderScenario("venom", {
      seed: 1,
      modularSetIds: [encounterSetId("bomb_scare")],
    });
    const created = createGame(config, WAVE5_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const state = created.state;
    expect([activeVillain(state).stageIndex, activeVillain(state).lastStageIndex]).toEqual([0, 1]);
    const tower = instancesOf(state, "27077a")[0];
    expect(tower).toBeDefined();
    expect(state.villainArea).toContain(tower);
    expect(inst(state, tower!).flipped).toBe(false);
    // The nemesis and obligation sets are set aside for Ghost-Spider.
    expect(playerOf(state, P1).setAside.length).toBeGreaterThan(0);
    // Venom + Symbiotic Strength + Standard + Bomb Scare.
    expect(activeEncounterDeck(state).deck.length).toBeGreaterThan(0);
  });

  it("expert: Venom starts at stage (II)-(III)", () => {
    const config = ghostSpiderScenario("venom", {
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
      ghostSpiderScenario("venom", {
        seed: 3,
        difficulty,
        modularSetIds: [encounterSetId("bomb_scare")],
      }).encounterDeck.filter((id) => expertIds.has(id as string));
    expect(inDeck("standard")).toEqual([]);
    expect(inDeck("expert").length).toBeGreaterThan(0);
  });
});

test("Venom, solo: Spider-Man (Miles Morales)", () => {
  const config = spiderManMoralesScenario("venom", { seed: 2026, modularSetIds: [encounterSetId("bomb_scare")] });
  const created = createGame(config, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE5_DEPS);
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE5_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

test("Venom, solo: a Core precon (Captain Marvel / Leadership)", () => {
  const config = wave5Scenario("venom", {
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
