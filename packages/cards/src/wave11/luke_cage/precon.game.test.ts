import { LUKE_CAGE_STARTER_DECKS, PLAYABLE_CARDS } from "@mc/content";
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
 * Wave 11 precon game (docs/phase7-wave11.md section 8.4): Luke Cage's starter deck `luke-cage-leadership` (62001a/b,
 * Leadership, basic; an unverified stand-in list, see its provenance) against Core's Rhino in standard mode, played by
 * the greedy driver (testing/driver.ts, which knows no card names) to a loss and to a win.
 *
 * Per game: no thrown error (the driver throws on a rejected command), an outcome and no pending prompt at the end,
 * and the session log replays from the first state deep-equal (`replay`) and one command at a time (`sessionApply`).
 * The event log is asserted to show Luke Cage's identity at work:
 * - Unbreakable Skin (62001a, MC62): he may hold any number of tough status cards (RRG 1.8 "Status Cards", p. 4: the
 *   card text beats the one-of-each limit); the log shows him holding two or more at once.
 * - His Forced Response (62001a): after a tough status card is discarded from him he takes 1 unpreventable damage
 *   (RRG 1.8 "Forced", p. 18 and the MC62 insert on unpreventable damage, which ignores tough). Every tough card
 *   discarded from him is followed by that damage, dealt by him to himself, flagged unpreventable.
 * and cards from the deck being played.
 *
 * Reachability. The greedy player never wins Rhino naturally (no plan beyond "attack what is attackable"), so the
 * loss is natural and the win is staged: Rhino one hit from defeat with the hero in hero form (surgery on the table
 * only, as fne/daredevil/precon.game.test.ts does); every rule is exercised by real commands.
 */
const DECK = LUKE_CAGE_STARTER_DECKS.find((d) => d.id === "luke-cage-leadership")!;
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

/** Asserts the Forced Response in an event stream; returns how many tough cards left Luke and the most he held. */
function identityAtWork(initial: GameState, events: readonly GameEvent[]): { removals: number; mostHeld: number } {
  const hero = initial.players[0]!.identity.instanceId;
  let held = 0;
  let mostHeld = 0;
  let removals = 0;
  events.forEach((e, i) => {
    if (e.type === "statusGiven" && e.status === "tough" && e.instanceId === hero) {
      held++;
      mostHeld = Math.max(mostHeld, held);
    }
    if (e.type === "statusRemoved" && e.status === "tough" && e.instanceId === hero) {
      held--;
      removals++;
      // The Forced Response: 1 unpreventable damage, from Luke to himself, right after the discard.
      const damage = events
        .slice(i + 1, i + 40)
        .find((x) => x.type === "damageDealt" && x.targetInstanceId === hero && x.unpreventable === true);
      expect(damage, `no unpreventable damage after the tough card discarded at event ${i}`).toMatchObject({
        type: "damageDealt",
        amount: 1,
        sourceInstanceId: hero,
      });
    }
  });
  return { removals, mostHeld };
}

describe("Luke Cage / Leadership precon against Rhino (standard), greedy driver", () => {
  it("seed 2: plays to a loss, replays deep-equal, and the log shows Unbreakable Skin, the Forced Response and the deck's cards", () => {
    const initial = open(2);
    const { outcome, events } = play(initial);
    expect(outcome).toMatchObject({ result: "loss" });
    const { removals, mostHeld } = identityAtWork(initial, events);
    expect(removals, "tough cards discarded from Luke").toBeGreaterThanOrEqual(1);
    expect(mostHeld, "Luke held two or more tough cards at once (Unbreakable Skin)").toBeGreaterThanOrEqual(2);

    const plays = playedCodes(events);
    expect(plays.length, "cards played").toBeGreaterThanOrEqual(5);
    for (const code of plays) expect(DECK_CODES.has(code), `${code} is in the deck`).toBe(true);
  });

  it("seed 10: a second natural game ends in a loss and replays deep-equal", () => {
    const initial = open(10);
    const { outcome, events } = play(initial);
    expect(outcome).toMatchObject({ result: "loss" });
    expect(identityAtWork(initial, events).removals).toBeGreaterThanOrEqual(1);
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
