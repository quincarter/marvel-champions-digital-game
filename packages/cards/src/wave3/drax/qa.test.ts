import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { WAVE3_DEPS } from "../index.js";
import { VENOM_SEAT, venomScenario } from "../vnm/support.js";
import { draxScenario } from "./support.js";

/**
 * rules-qa-engineer wave 3 pass, `drax` (docs/phase7-wave3-qa.md has the full report). `gam`/`stld`/`drax`/`vnm`
 * each had only one solo Rhino-standard game before this pass; adds a 2-player game (Drax + Venom — neither pack
 * has a natural home for a cross-pack test, so it lives here) and Drax's own first expert-mode game.
 */
test("Rhino (standard), 2-player: Drax + Venom", () => {
  const config = draxScenario("rhino", { seed: 11, extraPlayers: [VENOM_SEAT] });
  const created = createGame(config, WAVE3_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE3_DEPS);
  console.info(
    `[wave3 qa smoke] Rhino (standard), 2p — Drax + Venom: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE3_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 180_000);

test("Rhino (expert), solo: Drax", () => {
  const config = draxScenario("rhino", { seed: 12, difficulty: "expert" });
  const created = createGame(config, WAVE3_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE3_DEPS);
  console.info(
    `[wave3 qa smoke] Rhino (expert) — Drax: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE3_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

test("Rhino (expert), solo: Venom", () => {
  const config = venomScenario("rhino", { seed: 13, difficulty: "expert" });
  const created = createGame(config, WAVE3_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE3_DEPS);
  console.info(
    `[wave3 qa smoke] Rhino (expert) — Venom: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE3_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}, 120_000);

/**
 * docs/phase7-wave3.md §4 Q12 (open question, no FFG ruling — "the rulings file and the FAQ are silent"): "Is
 * 'that minion attacks another enemy' [Moondragon, 19013] an activation?" `19013.moondragon-action` stays in
 * `KNOWN_SKIPPED` per docs/phase7-wave3-scripting.md §7's own module docblock, and §3.23 in docs/phase7-wave3.md
 * is itself marked "open" — no `EffectSpec`/primitive for "an enemy attacking another enemy" exists in the engine
 * yet, so there is nothing to drive a real command against.
 *
 * This is recorded here, deliberately unimplemented, rather than silently dropped: `pnpm dsl`/`pnpm refs` (checked
 * this pass) confirm no `enemyAttacksEnemy`-shaped `EffectSpec` exists anywhere in `packages/engine/src/spec.ts`.
 * When `game-rules-architect` answers Q12 and builds the primitive, this test should become a real one (replacing
 * the `.skip`), not just get deleted — it is the marker that the question was checked, not ignored.
 */
test.skip("Moondragon (19013): 'that minion attacks another enemy' — no primitive exists yet; §4 Q12 is unanswered (docs/phase7-wave3.md §3.23)", () => {
  // Intentionally empty: nothing to drive until §3.23 lands. See the docblock above.
});
