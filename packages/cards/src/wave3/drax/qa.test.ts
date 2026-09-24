import { createGame, type GameState, type InstanceId, replay } from "@mc/engine";
import { playToOutcome } from "../../testing/driver.js";
import { firstLegal, inst, P1, type Picker, runWith, settle, toHero, use } from "../../testing/harness.js";
import { WAVE3_DEPS } from "../index.js";
import { playFromHand, startWave3Game } from "../testing.js";
import { VENOM_SEAT, venomScenario } from "../vnm/support.js";
import { draxScenario, engageMinion } from "./support.js";

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
 * docs/phase7-wave3.md §4 Q12, decided by the user on 2026-09-23 (no FFG ruling exists; "the rulings file and the FAQ
 * are silent"): Moondragon's "that minion attacks another enemy" is **an attack, not an activation** (§3.23,
 * `EffectSpec enemyAttacksEnemy`). This was the pin the rules-QA pass left as a `test.skip` while the question was
 * open; it is now the real assertion, on real cards:
 *
 * - Monarch Starstalker (`gmw` 16075, villainous) gets no boost card, although a villainous minion's own activation
 *   always does (RRG 1.8 "Villainous", p. 47);
 * - Tiger Shark (Core 01131, "Forced Response: After Tiger Shark attacks, give him a tough status card") does not get
 *   his tough status card: that ability answers his attack *activation*, which this is not.
 */
describe("§4 Q12 (decided 2026-09-23): Moondragon's attack is an attack, not an activation (19013.moondragon-action)", () => {
  const MONARCH_STARSTALKER = "16075"; // villainous, ATK 2, HP 7
  const TIGER_SHARK = "01131"; // ATK 3, HP 6

  const moondragonReady = () => {
    const hero = runWith(WAVE3_DEPS, startWave3Game(draxScenario("rhino", { seed: 1 })), toHero());
    return playFromHand(hero, "19013", 3);
  };
  const choosing =
    (attacker: string, target: string): Picker =>
    (state) => {
      const prompt = state.pendingChoice?.prompt;
      if (prompt?.kind === "chooseTarget" && prompt.slot === "attacker") return [attacker];
      if (prompt?.kind === "chooseTarget" && prompt.slot === "attacked") return [target];
      return firstLegal(state);
    };
  const encounterCardsLeft = (state: GameState) =>
    Object.values(state.encounterDecks).reduce((sum, piles) => sum + piles.deck.length, 0);

  test("a villainous minion made to attack gets no boost card", () => {
    const { state, id } = moondragonReady();
    const staged = engageMinion(engageMinion(state, MONARCH_STARSTALKER, "q12-monarch"), TIGER_SHARK, "q12-shark");
    const before = encounterCardsLeft(staged);
    const after = settle(
      runWith(WAVE3_DEPS, staged, use(P1, id, "19013.moondragon-action")),
      choosing("q12-monarch", "q12-shark"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(after, "q12-shark" as InstanceId).damage).toBe(2);
    expect(inst(after, "q12-monarch" as InstanceId).boostCards).toEqual([]);
    expect(encounterCardsLeft(after)).toBe(before);
  });

  test("'After Tiger Shark attacks' does not fire: it answers his activation, and this is not one", () => {
    const { state, id } = moondragonReady();
    const staged = engageMinion(engageMinion(state, MONARCH_STARSTALKER, "q12-monarch"), TIGER_SHARK, "q12-shark");
    const after = settle(
      runWith(WAVE3_DEPS, staged, use(P1, id, "19013.moondragon-action")),
      choosing("q12-shark", "q12-monarch"),
      undefined,
      WAVE3_DEPS,
    );
    expect(inst(after, "q12-monarch" as InstanceId).damage).toBe(3);
    expect(inst(after, "q12-shark" as InstanceId).statuses.tough).toBe(0);
  });
});
