import { FNE_STARTER_DECKS, PLAYABLE_CARDS } from "@mc/content";
import {
  createGame,
  maxHitPoints,
  replay,
  sessionApply,
  startSession,
  type GameEvent,
  type GameOutcome,
  type GameSession,
  type GameState,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { firstLegal, patchInstance, settle } from "../../../testing/harness.js";
import { playToOutcome } from "../../../testing/driver.js";
import { withForm } from "../../../testing/staging.js";
import { WAVE11_DEPS } from "../../index.js";

vi.setConfig({ testTimeout: 300_000 });

/**
 * Wave 11 precon game (docs/phase7-wave11.md section 8.4 line 13): Daredevil's printed starter deck
 * `fne-daredevil-justice` (60001a/b, the Sense deck 60002 to 60006, Justice, basic) against Core's Rhino in standard
 * mode, played by the greedy driver (testing/driver.ts, which knows no card names) to a loss and to a win.
 *
 * Per game: no thrown error (the driver throws on a rejected command), an outcome and no pending prompt at the end,
 * and the session log replays from the first state deep-equal (`replay`) and one command at a time (`sessionApply`).
 * The log is asserted to show the cards the task names: Superhuman Senses playing Sense upgrades from the Sense deck
 * ("Play" cost and as-if-in-hand, MC60 p. 26; RRG 1.8 "Play, Put Into Play" p. 32), a Sense upgrade returning to the
 * bottom of the Sense deck when it leaves play (Daredevil's Forced Interrupt, a replacement effect, RRG 1.8 p. 37),
 * Focus the Senses (60012) and Justice cards.
 *
 * Reachability. The greedy player never wins Rhino naturally (no plan beyond "attack what is attackable"), so the
 * loss is natural and the win is staged: Rhino one hit from defeat with the hero in hero form (surgery on the table
 * only, as wave9/tt/god-of-lies.game.test.ts does); every rule is exercised by real commands.
 */
const DECK = FNE_STARTER_DECKS.find((d) => d.id === "fne-daredevil-justice")!;
const SENSE_UPGRADES = ["60002", "60003", "60004", "60005", "60006"];
const FOCUS_THE_SENSES = "60012";
/** Justice cards in the deck (aspect `justice`). */
const justiceCodes = new Set(
  DECK.cards
    .map((e) => e.cardId as string)
    .filter((id) => (PLAYABLE_CARDS.find((c) => c.id === id) as { aspect?: string } | undefined)?.aspect === "justice"),
);

function open(seed: number): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const seat = {
    identityCardId: DECK.identityCardId,
    aspects: DECK.aspects,
    deck: DECK.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
  };
  const created = createGame({ ...config, players: [seat] }, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
}

/** Rhino (stage I) one point from defeat, the hero in hero form. */
function stageRhino(state: GameState): GameState {
  const villain = state.activeVillainId;
  const staged = patchInstance(state, villain, {
    damage: maxHitPoints(state, villain, WAVE11_DEPS)! - 1,
    statuses: { ...state.instances[villain]!.statuses, tough: 0 },
  });
  return withForm(staged, { heroForm: 0 });
}

function walk(session: GameSession): GameState {
  let current = startSession(session.log.initialState);
  for (const command of session.log.commands) {
    const result = sessionApply(current, command, WAVE11_DEPS);
    if (!result.ok) throw new Error(`replayed ${command.type} refused: ${result.error.message}`);
    current = result.session;
  }
  return current.state;
}

function play(initial: GameState): { state: GameState; outcome: GameOutcome; events: readonly GameEvent[] } {
  const run = playToOutcome(initial, WAVE11_DEPS, { maxCommands: 3000 });
  const s = run.session.state;
  expect(run.outcome, `no outcome after ${run.commands} commands, round ${run.rounds}`).not.toBeNull();
  expect(s.pendingChoice, "a prompt is still open at the end").toBeNull();
  const replayed = replay(run.session.log, WAVE11_DEPS);
  if (!replayed.ok) throw new Error(`replay failed: ${replayed.error.message}`);
  expect(replayed.state, "replay diverged").toEqual(s);
  expect(walk(run.session), "the command-by-command walk diverged").toEqual(s);
  return { state: s, outcome: run.outcome!, events: replayed.events };
}

const playedCodes = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "cardPlayed" ? [{ code: e.cardId as string, from: e.from, counts: e.countsAsFrom }] : [],
  );

describe("Daredevil / Justice precon against Rhino (standard), greedy driver", () => {
  it("seed 7: plays to a loss (the main scheme completes), replays deep-equal, and the log shows the Sense deck, Focus the Senses and Justice", () => {
    const { outcome, events } = play(open(7));
    expect(outcome).toMatchObject({ result: "loss", reason: "mainSchemeCompleted" });

    const plays = playedCodes(events);
    // Superhuman Senses: Sense upgrades played from the separate deck, counted as played from hand (MC60 p. 26).
    const sensePlays = plays.filter((p) => SENSE_UPGRADES.includes(p.code));
    expect(sensePlays.length, "Sense upgrades played").toBeGreaterThanOrEqual(5);
    for (const p of sensePlays) expect(p.from).toBe("separateDeck");
    // The same upgrade is played again after it left play, so it went back into the Sense deck, not the discard pile.
    const counts = new Map<string, number>();
    for (const p of sensePlays) counts.set(p.code, (counts.get(p.code) ?? 0) + 1);
    expect(Math.max(...counts.values()), "a Sense upgrade played twice").toBeGreaterThanOrEqual(2);

    // The return: a Sense upgrade moved from play to the bottom of the Sense deck (a replacement, RRG 1.8 p. 37).
    const returned = events.filter(
      (e) =>
        e.type === "cardMoved" &&
        SENSE_UPGRADES.includes(e.cardId as string) &&
        e.to.kind === "separateDeck" &&
        e.to.name === "Sense" &&
        e.from.kind !== "separateDeck",
    );
    expect(returned.length, "Sense upgrades returned to the Sense deck").toBeGreaterThanOrEqual(1);
    expect(
      events.some(
        (e) =>
          e.type === "cardMoved" &&
          SENSE_UPGRADES.includes(e.cardId as string) &&
          (e.to.kind === "discard" || e.to.kind === "separateDiscard"),
      ),
      "no Sense upgrade was discarded",
    ).toBe(false);

    expect(
      plays.map((p) => p.code),
      "Focus the Senses played",
    ).toContain(FOCUS_THE_SENSES);
    expect(plays.filter((p) => justiceCodes.has(p.code)).length, "Justice cards played").toBeGreaterThanOrEqual(3);
  });

  it("seed 8: a second natural game ends in a loss (the hero is defeated) and replays deep-equal", () => {
    const { outcome, events } = play(open(8));
    expect(outcome).toMatchObject({ result: "loss", reason: "allPlayersDefeated" });
    expect(playedCodes(events).some((p) => SENSE_UPGRADES.includes(p.code) && p.from === "separateDeck")).toBe(true);
  });

  it("staged: Rhino one hit from defeat in each of his two stages, the greedy player wins, and both legs replay deep-equal", () => {
    let won = 0;
    for (const seed of [1, 2, 3]) {
      // Leg 1: stage I one hit from defeat. The driver is deterministic, so the smallest command budget that has Rhino
      // on stage II is a prefix of the same game.
      const first = stageRhino(open(seed));
      let leg2: GameState | undefined;
      for (let budget = 1; budget <= 80 && !leg2; budget++) {
        const run = playToOutcome(first, WAVE11_DEPS, { maxCommands: budget });
        if (run.outcome) break;
        if (run.session.state.villains[0]!.stageIndex === 1 && !run.session.state.pendingChoice)
          leg2 = run.session.state;
      }
      if (!leg2) continue;
      // Leg 2: stage II one hit from defeat, played to the end from the state leg 1 reached.
      const { outcome } = play(stageRhino(leg2));
      if (outcome.result === "win") won++;
    }
    expect(won, "the greedy player wins at least one staged game").toBeGreaterThanOrEqual(1);
  });
});
