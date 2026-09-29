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
 * The Mysterio scenario's own setup and two full games (docs/phase7-wave5.md §2.2, wave 5 step 3): Spider-Man
 * (Miles Morales)'s own real precon and a Core precon (`core-captain-marvel-leadership`), each played headlessly by
 * the card-name-agnostic greedy driver to a real outcome, then replayed to a deep-equal final state — the
 * `sandman/scenario.test.ts`/`venom/scenario.test.ts` shape. Whispers of Paranoia (`sm` 27170–27173, MC27 p. 20,
 * `../modulars/whispers-of-paranoia.ts`) is Mysterio's own recommended modular set.
 */
describe("wave5Scenario('mysterio')", () => {
  it("standard: Mysterio (I)-(II); his own set + Personal Nightmare + Standard, one modular; a Shifting Apparition minion engaged with each player", () => {
    const config = ghostSpiderScenario("mysterio", {
      seed: 1,
      modularSetIds: [encounterSetId("whispers_of_paranoia")],
    });
    const created = createGame(config, WAVE5_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const state = created.state;
    expect([activeVillain(state).stageIndex, activeVillain(state).lastStageIndex]).toEqual([0, 1]);
    const engaged = instancesOf(state, "27091").filter((id) => inst(state, id).engagedWith !== null);
    expect(engaged.length).toBe(1);
    expect(inst(state, engaged[0]!).engagedWith).toBe(P1);
    // The nemesis and obligation sets are set aside for Ghost-Spider.
    expect(playerOf(state, P1).setAside.length).toBeGreaterThan(0);
    // Mysterio + Personal Nightmare + Standard + Whispers of Paranoia.
    expect(activeEncounterDeck(state).deck.length).toBeGreaterThan(0);
  });

  it("expert: Mysterio starts at stage (II)-(III)", () => {
    const config = ghostSpiderScenario("mysterio", {
      seed: 2,
      difficulty: "expert",
      modularSetIds: [encounterSetId("whispers_of_paranoia")],
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
      ghostSpiderScenario("mysterio", {
        seed: 3,
        difficulty,
        modularSetIds: [encounterSetId("whispers_of_paranoia")],
      }).encounterDeck.filter((id) => expertIds.has(id as string));
    expect(inDeck("standard")).toEqual([]);
    expect(inDeck("expert").length).toBeGreaterThan(0);
  });
});

test("Mysterio, solo: Spider-Man (Miles Morales)", () => {
  const config = spiderManMoralesScenario("mysterio", {
    seed: 2026,
    modularSetIds: [encounterSetId("whispers_of_paranoia")],
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

test("Mysterio, solo: a Core precon (Captain Marvel / Leadership)", () => {
  const config = wave5Scenario("mysterio", {
    seed: 2027,
    players: [{ starterDeckId: "core-captain-marvel-leadership" }],
    modularSetIds: [encounterSetId("whispers_of_paranoia")],
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
test("Mysterio, 2 players: Ghost-Spider and Spider-Man (Miles Morales)", () => {
  const config = ghostSpiderScenario("mysterio", {
    seed: 2028,
    modularSetIds: [encounterSetId("whispers_of_paranoia")],
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

// docs/phase7-wave5-qa-sm-scenarios-1.md §2: an expert-mode game (Mysterio starts at stage (II)-(III)) played to a
// real outcome and replayed to a deep-equal final state.
test("Mysterio, solo expert: Ghost-Spider", () => {
  const config = ghostSpiderScenario("mysterio", {
    seed: 2029,
    difficulty: "expert",
    modularSetIds: [encounterSetId("whispers_of_paranoia")],
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
