import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE2_DEPS } from "../index.js";
import { wave2Scenario } from "../setup.js";

/**
 * Real-game tests for the `toafk` pack (docs/phase7-wave2-scripting.md "Test conventions"): The Once and Future
 * Kang played headlessly by the card-name-agnostic greedy driver to a real win or loss, then the session log
 * replayed to a deep-equal final state. Before this (rules-qa-engineer wave 2 pass), Kang had never been driven to
 * outcome outside `packages/engine/src/game-areas.test.ts`'s synthetic stub-card `kangGame()` (proving the
 * `separateGameAreas` *primitive*, not this scenario's actual scripted content) — `kang.test.ts`/
 * `kang-encounter-set.test.ts`/`fear-of-kang-constant.test.ts` are all ability-level tests. A 2-player run is
 * required here (task item 1): Kang's own scenario rules are structurally per-player (`separateGameAreas`, each
 * player's own game area, own villain, own copy of the main scheme's stage 3), so a solo game alone never exercises
 * `joinGameArea`/multiple simultaneous areas at all.
 */
test("Kang (standard), solo: Hawkeye (Leadership)", () => {
  const config = wave2Scenario("kang", { players: [{ starterDeckId: "hawkeye-leadership" }], seed: 2026 });
  const created = createGame(config, WAVE2_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE2_DEPS);
  console.info(`[wave2 e2e] Kang (standard, solo) — Hawkeye: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`);
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE2_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

test("Kang (standard), 2-player: Hawkeye and Spider-Woman", () => {
  const config = wave2Scenario("kang", {
    players: [{ starterDeckId: "hawkeye-leadership" }, { starterDeckId: "spider-woman-aggression-justice" }],
    seed: 2027,
  });
  const created = createGame(config, WAVE2_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE2_DEPS);
  console.info(`[wave2 e2e] Kang (standard, 2-player) — Hawkeye/Spider-Woman: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`);
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE2_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
