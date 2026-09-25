import { cardId } from "@mc/content";
import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE4_DEPS } from "../index.js";
import { spectrumScenario } from "./support.js";

/**
 * A real game test for the box's own fourth scenario, Hela (docs/phase7-wave4.md §2.2), standard and expert:
 * Spectrum's own real precon (`spectrum-leadership`) against Hela, played headlessly by the card-name-agnostic
 * greedy driver to a real win or loss, then the session log replayed to a deep-equal final state. Modeled directly
 * on `ebony-maw-e2e.test.ts`. Exercises the box's most cross-ability-dependent scenario end to end: Odin's own
 * attach/detach/control cycle, the side-scheme chain that reveals Skurge/Nidhogg, Garm/Skurge/Nidhogg's own
 * unconditional rules, and Hela's own flip-instead-of-defeat interrupt — no single isolated test in `hela.test.ts`
 * drives all of them together the way a full playthrough does.
 *
 * Expert mode reads the expert villain (21137a) from `MTS_SCENARIOS`'s `hela.expertVillains`.
 */
test("Hela (standard), solo: Spectrum", () => {
  const config = spectrumScenario("hela", { seed: 2026 });
  const created = createGame(config, WAVE4_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE4_DEPS);
  console.info(
    `[wave4 e2e] Hela (standard) — Spectrum: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE4_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

test("Hela (expert), solo: Spectrum", () => {
  const config = spectrumScenario("hela", { seed: 2027, difficulty: "expert" });
  expect(config.villainCardId).toBe(cardId("21137a"));
  const created = createGame(config, WAVE4_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE4_DEPS);
  console.info(
    `[wave4 e2e] Hela (expert) — Spectrum: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE4_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
