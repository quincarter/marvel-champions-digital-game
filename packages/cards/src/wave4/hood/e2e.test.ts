import { encounterSetId, type DifficultySetChoice } from "@mc/content";
import { auditVillainPhases, createGame, replay, type GameEvent, type GameState } from "@mc/engine";
import { expect, test } from "vitest";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE4_DEPS } from "../index.js";
import { hoodScenario } from "./support.js";

/**
 * Real games of The Hood (docs/phase7-wave4.md §2.3), standard and expert, played headlessly by the card-name-agnostic
 * greedy driver to a real win or loss, then replayed from the session log to a deep-equal final state and re-checked
 * by the villain-phase audit (whose step-one acceleration now includes gained icons, §3.57).
 *
 * The modular sets: Making Connections 1A's Setup sets 7 aside and shuffles 1 in during setup (in expert, The Hood (II)'s
 * When Revealed shuffles in a second), and every later "choose 1 set-aside modular encounter set at random, then shuffle
 * it into the encounter deck" (The Hood II/III, Promised Prosperity, Crime State, Field Recruitment) moves one whole set
 * from the set-aside area into the encounter deck, checked here against the log. The expert game uses Standard II and
 * Expert II (§4 Q5), so Formidable Foe starts in play on its Expert face.
 */

const BOTH_II: DifficultySetChoice = { standard: encounterSetId("standard_ii"), expert: encounterSetId("expert_ii") };

function playHood(label: string, config: ReturnType<typeof hoodScenario>, setAsideAtStart: number) {
  const created = createGame(config, WAVE4_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE4_DEPS);
  console.info(
    `[wave4 e2e] ${label}: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE4_DEPS);
  expect(replayed.ok).toBe(true);
  if (!replayed.ok) return;
  expect(replayed.state).toEqual(result.session.state);
  expect(auditVillainPhases(result.session.log, WAVE4_DEPS).violations).toEqual([]);
  checkModularSets(result.session.log.initialState, replayed.state, replayed.events, setAsideAtStart);
}

/** Each shuffle-in moved one whole set that was set aside, out of the set-aside area and into the encounter deck. */
function checkModularSets(initial: GameState, final: GameState, events: readonly GameEvent[], atStart: number) {
  expect(initial.setAsideModularSets).toHaveLength(atStart);
  const shuffledIn = events.flatMap((e) => (e.type === "setAsideModularSetShuffledIn" ? [e] : []));
  const initialSets = new Set(initial.setAsideModularSets!.map((s) => s.encounterSetId));
  for (const event of shuffledIn) {
    expect(initialSets.has(event.encounterSetId)).toBe(true);
    for (const id of event.instanceIds) {
      expect(initial.encounterSetAside).toContain(id);
      expect(final.encounterSetAside).not.toContain(id);
    }
  }
  console.info(
    `[wave4 e2e]   modular sets shuffled in during play: ${shuffledIn.map((e) => e.encounterSetId).join(", ") || "none"}`,
  );
  // Each pinned seed reaches at least one in-play shuffle-in (a villain stage or main scheme stage instructing it).
  expect(shuffledIn.length).toBeGreaterThanOrEqual(1);
  expect(final.setAsideModularSets ?? []).toHaveLength(atStart - shuffledIn.length);
  expect(new Set(shuffledIn.map((e) => e.encounterSetId)).size).toBe(shuffledIn.length);
}

test("The Hood (standard), solo: Spider-Man", () => {
  // 7 set aside, 1 shuffled in by 1A's Setup before the log begins.
  playHood("The Hood (standard) — Spider-Man", hoodScenario("the-hood", { seed: 2026 }), 6);
}, 180_000);

test("The Hood (standard), 2-player: Spider-Man and Captain Marvel", () => {
  playHood(
    "The Hood (standard, 2-player) — Spider-Man/Captain Marvel",
    hoodScenario("the-hood", { seed: 2031, extraPlayers: [{ starterDeckId: "core-captain-marvel-leadership" }] }),
    6,
  );
}, 180_000);

test("The Hood (expert, Standard II and Expert II), solo: Spider-Man", () => {
  const config = hoodScenario("the-hood", { seed: 2027, difficulty: "expert", difficultySets: BOTH_II });
  expect(config.difficulty).toBe("expert");
  // Expert starts at The Hood (II), whose When Revealed shuffles in a second set during setup: 5 remain.
  playHood("The Hood (expert, Standard II/Expert II) — Spider-Man", config, 5);
}, 180_000);
