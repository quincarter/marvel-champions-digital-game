import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE4_DEPS } from "../index.js";
import { spectrumScenario } from "./support.js";

/**
 * A real game test for the box's own third scenario, Thanos (docs/phase7-wave4.md §2.2), standard and expert:
 * Spectrum's own real precon (`spectrum-leadership`) against Thanos, played headlessly by the card-name-agnostic
 * greedy driver to a real win or loss, then the session log replayed to a deep-equal final state. Also exercises
 * the Infinity Gauntlet modular set end to end — the Infinity Stone deck built at setup, stones entering play on
 * both main-scheme reveals and villain activations, the Infinity Gauntlet's own Forced Response resolving a
 * Special or drawing another stone, and (should the deck run dry over a long enough game) its own reshuffle — the
 * kind of cross-ability interaction `thanos.test.ts`/`infinity-gauntlet.test.ts`'s isolated tests can't catch.
 */
test("Thanos (standard), solo: Spectrum", () => {
  const config = spectrumScenario("thanos", { seed: 2026 });
  const created = createGame(config, WAVE4_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE4_DEPS);
  console.info(
    `[wave4 e2e] Thanos (standard) — Spectrum: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE4_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

test("Thanos (expert), solo: Spectrum", () => {
  const config = spectrumScenario("thanos", { seed: 2027, difficulty: "expert" });
  const created = createGame(config, WAVE4_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE4_DEPS);
  console.info(
    `[wave4 e2e] Thanos (expert) — Spectrum: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE4_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
