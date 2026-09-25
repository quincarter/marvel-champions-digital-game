import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE4_DEPS } from "../index.js";
import { spectrumScenario } from "./support.js";

/**
 * A real game test for the box's own first scenario, Ebony Maw (docs/phase7-wave4.md §2.2), standard and expert:
 * Spectrum's own real precon (`spectrum-leadership`) against Ebony Maw, played headlessly by the card-name-
 * agnostic greedy driver to a real win or loss, then the session log replayed to a deep-equal final state. Also
 * exercises the encounter AI end to end (villain activation, boost, the Spell environments' own enter/discharge
 * pipeline) across a full game — the kind of cross-ability interaction `ebony-maw.test.ts`'s isolated tests can't
 * catch, and the reason this scenario needed its own `wave4Scenario` wiring (`../setup.ts`'s `buildMtsSingleVillain`)
 * beyond the Core-scenario fallback every earlier wave 4 e2e test used.
 */
test("Ebony Maw (standard), solo: Spectrum", () => {
  const config = spectrumScenario("ebony-maw", { seed: 2026 });
  const created = createGame(config, WAVE4_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE4_DEPS);
  console.info(
    `[wave4 e2e] Ebony Maw (standard) — Spectrum: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE4_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

test("Ebony Maw (expert), solo: Spectrum", () => {
  const config = spectrumScenario("ebony-maw", { seed: 2027, difficulty: "expert" });
  const created = createGame(config, WAVE4_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE4_DEPS);
  console.info(
    `[wave4 e2e] Ebony Maw (expert) — Spectrum: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE4_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
