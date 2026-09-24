import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE3_DEPS } from "../index.js";
import { STAR_LORD_LEADERSHIP } from "../stld/testing.js";
import { gamoraScenario } from "./support.js";

/**
 * rules-qa-engineer wave 3 pass (docs/phase7-wave3-qa.md has the full report). `gam`/`stld`/`drax`/`vnm` each had
 * only one solo Rhino-standard game before this pass. Adds a 2-player game (Star-Lord + Gamora — neither pack has
 * a natural home for a cross-pack test, so it lives here) and Gamora's own first expert-mode game.
 */
test("Rhino (standard), 2-player: Gamora + Star-Lord (Leadership)", () => {
  const config = gamoraScenario("rhino", { seed: 9, extraPlayers: [STAR_LORD_LEADERSHIP] });
  const created = createGame(config, WAVE3_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE3_DEPS);
  console.info(
    `[wave3 qa smoke] Rhino (standard), 2p — Gamora + Star-Lord: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE3_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 180_000);

test("Rhino (expert), solo: Gamora", () => {
  const config = gamoraScenario("rhino", { seed: 10, difficulty: "expert" });
  const created = createGame(config, WAVE3_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE3_DEPS);
  console.info(
    `[wave3 qa smoke] Rhino (expert) — Gamora: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE3_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);
