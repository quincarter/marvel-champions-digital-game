import { cardId } from "@mc/content";
import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE4_DEPS } from "../index.js";
import { wave4Scenario } from "../setup.js";
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
 * **Expert mode is built by hand, not via `spectrumScenario("hela", { difficulty: "expert" })`.** `hela.ts`'s own
 * module docblock: `MTS_SCENARIOS`'s `hela` record has no `expertVillains` (a `card-data-pipeline` gap — MC21 p. 20's
 * own "Villain deck Hela A (Hela B instead for expert mode)" names a whole separate villain card, 21137a, the same
 * shape Escape the Museum's Collector already uses), so `wave4Scenario` would silently build with the standard
 * villain (21136a) regardless of difficulty. Everything else about the expert build (the expert encounter set, stage
 * indices — both cards' single stage is `stageNumber: 1`, so the indices are the same 0/0) is already correct; only
 * `villainCardId` needs the override.
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
  const config = {
    ...wave4Scenario("hela", { players: [{ starterDeckId: "spectrum-leadership" }], seed: 2027, difficulty: "expert" }),
    villainCardId: cardId("21137a"),
  };
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
