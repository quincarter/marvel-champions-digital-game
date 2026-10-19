import { JJ_STARTER_DECKS, PLAYABLE_CARDS } from "@mc/content";
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
import { coreScenario } from "../../core/setup.js";
import { playToOutcome } from "../../testing/driver.js";
import { patchInstance } from "../../testing/harness.js";
import { withForm } from "../../testing/staging.js";
import { WAVE11_DEPS } from "../index.js";

vi.setConfig({ testTimeout: 300_000 });

/**
 * Wave 11 precon game (docs/phase7-wave11.md section 8.4): Jessica Jones' starter deck `jj-justice` (61001a/b, Justice)
 * against Core's Rhino in standard mode, played by the greedy driver (testing/driver.ts, which knows no card names).
 *
 * Per game: no thrown error, an outcome and no pending prompt at the end, and the session log replays from the first
 * state deep-equal (`replay`) and one command at a time (`sessionApply`). The event log is asserted to show her
 * identity at work:
 * - Alias Investigations (61002) is in play after setup (61001b Setup: put it into play; Permanent, RRG 1.8
 *   "Permanent", p. 32), so no turn is spent on it.
 * - Gather Evidence (61001a): after she uses a basic power, 1 evidence counter goes on Alias Investigations. Evidence
 *   counters in the log are placed on it in ones (basic powers) or twos (its own Response), and at least one single
 *   counter is placed.
 * - Cards played are all from the deck.
 *
 * Reachability. The greedy player never wins Rhino naturally, so the loss is natural and the win is staged: Rhino one
 * hit from defeat with the hero in hero form (surgery on the table only, as fne/daredevil/precon.game.test.ts does);
 * every rule is exercised by real commands.
 */
const DECK = JJ_STARTER_DECKS.find((d) => d.id === "jj-justice")!;
const DECK_CODES = new Set(DECK.cards.map((e) => e.cardId as string));

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
  return created.state;
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
  events.flatMap((e) => (e.type === "cardPlayed" ? [e.cardId as string] : []));

/** The evidence counters placed on Alias Investigations, by amount, in order. */
function evidencePlaced(initial: GameState, events: readonly GameEvent[]): number[] {
  const alias = Object.values(initial.instances).find((i) => (i.cardId as string) === "61002");
  expect(alias, "Alias Investigations exists").toBeDefined();
  // The game ends with her defeat, which discards her cards, so Setup is read from the log: it was the first move.
  const entered = events.find((e) => e.type === "cardMoved" && e.instanceId === alias!.instanceId);
  expect(entered, "Alias Investigations comes into play from set aside (61001b Setup)").toMatchObject({
    from: { kind: "setAside" },
    to: { kind: "playArea" },
  });
  return events.flatMap((e) =>
    e.type === "counterAdded" && e.counterType === "evidence" && e.instanceId === alias!.instanceId ? [e.amount] : [],
  );
}

describe("Jessica Jones / Justice precon against Rhino (standard), greedy driver", () => {
  it("seed 2: plays to an outcome, replays deep-equal, and the log shows Gather Evidence and the deck's cards", () => {
    const initial = open(2);
    const { events } = play(initial);
    const placed = evidencePlaced(initial, events);
    expect(placed.length, "evidence placements on Alias Investigations").toBeGreaterThanOrEqual(1);
    expect(placed.every((n) => n === 1 || n === 2)).toBe(true);
    expect(placed.filter((n) => n === 1).length, "Gather Evidence placed single counters").toBeGreaterThanOrEqual(1);

    const plays = playedCodes(events);
    expect(plays.length, "cards played").toBeGreaterThanOrEqual(3);
    for (const code of plays) expect(DECK_CODES.has(code), `${code} is in the deck`).toBe(true);
  });

  it("seed 10: a second natural game replays deep-equal and gathers evidence", () => {
    const initial = open(10);
    const { events } = play(initial);
    expect(evidencePlaced(initial, events).length).toBeGreaterThanOrEqual(1);
  });

  it("staged: Rhino one hit from defeat in each of his two stages, the greedy player wins, and both legs replay deep-equal", () => {
    let won = 0;
    for (const seed of [1, 2, 3]) {
      const first = stageRhino(open(seed));
      let leg2: GameState | undefined;
      for (let budget = 1; budget <= 80 && !leg2; budget++) {
        const run = playToOutcome(first, WAVE11_DEPS, { maxCommands: budget });
        if (run.outcome) break;
        if (run.session.state.villains[0]!.stageIndex === 1 && !run.session.state.pendingChoice)
          leg2 = run.session.state;
      }
      if (!leg2) continue;
      const { outcome } = play(stageRhino(leg2));
      if (outcome.result === "win") won++;
    }
    expect(won, "the greedy player wins at least one staged game").toBeGreaterThanOrEqual(1);
  });
});
