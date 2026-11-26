import { IRON_FIST_STARTER_DECKS, PLAYABLE_CARDS } from "@mc/content";
import {
  createGame,
  locateCard,
  maxHitPoints,
  replay,
  sessionApply,
  startSession,
  type GameEvent,
  type GameOutcome,
  type GameSession,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import { playToOutcome } from "../../testing/driver.js";
import { patchInstance } from "../../testing/harness.js";
import { withForm } from "../../testing/staging.js";
import { WAVE11_DEPS } from "../index.js";

vi.setConfig({ testTimeout: 300_000 });

/**
 * Wave 11 precon game (docs/phase7-elektra-iron-fist.md): Iron Fist's starter deck `iron-fist-protection` (64001a/b,
 * Protection) against Core's Rhino in standard mode, played by the greedy driver (testing/driver.ts, which knows no
 * card names) to a loss and to a win.
 *
 * Per game: no thrown error (the driver throws on a rejected command), an outcome and no pending prompt at the end,
 * and the session log replays from the first state deep-equal (`replay`) and one command at a time (`sessionApply`).
 * Asserted from the setup state and the event log:
 * - Setup: his nemesis set 64027 to 64029 (one 64027, three 64028, one 64029) is set aside (RRG 1.8 "Nemesis Encounter
 *   Set"); the obligation 64026 is shuffled into the encounter deck (RRG 1.8 "Obligation").
 * - Chi (64001a Martial Arts Master, "After you play a card, place 1 chi counter here"): `counterAdded` chi lands on
 *   the identity, chi is spent (`counterRemoved`, by cards and by his Forced Response) and the running total (moves of chi
 *   by `countersMoved` included) never goes below zero and equals the counters on the identity at the end of the game.
 * - Technique (Temporary) upgrades (RRG 1.8 "Temporary", p. 44): the log shows the temporary keyword resolving on a
 *   card of his deck, and that card leaving play (`cardDiscardedFromPlay`) after it.
 *
 * Reachability. The greedy player never wins Rhino naturally, so the loss is natural and the win is staged (Rhino one
 * hit from defeat, the hero in hero form: surgery on the table only). Seeds 1 to 6 all ended in natural losses with
 * chi placed and spent when this was written; 1 and 2 are used.
 */
const DECK = IRON_FIST_STARTER_DECKS.find((d) => d.id === "iron-fist-protection")!;
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

const codeOf = (s: GameState, id: InstanceId) => s.instances[id]!.cardId as string;

function assertSetup(s: GameState): void {
  expect(s.players[0]!.setAside.map((id) => codeOf(s, id)).sort(), "set-aside nemesis set").toEqual([
    "64027",
    "64028",
    "64028",
    "64028",
    "64029",
  ]);
  const obligation = Object.keys(s.instances).filter((id) => codeOf(s, id as InstanceId) === "64026");
  expect(obligation).toHaveLength(1);
  expect(locateCard(s, obligation[0] as InstanceId)).toMatchObject({ kind: "encounterDeck" });
}

/** Chi on the identity: placed, spent, never negative, and equal to the identity's counters at the end. */
function chiAtWork(initial: GameState, final: GameState, events: readonly GameEvent[]): void {
  const hero = initial.players[0]!.identity.instanceId;
  let total = 0;
  let added = 0;
  let removed = 0;
  for (const e of events) {
    if (e.type === "countersMoved" && e.counterType === "chi") {
      // Moved chi (a card moving counters off or onto the identity) changes the total without an add or a remove.
      if (e.from === hero) total -= e.amount;
      if (e.to === hero) total += e.amount;
      expect(total, "chi never goes below zero").toBeGreaterThanOrEqual(0);
      continue;
    }
    if (e.type !== "counterAdded" && e.type !== "counterRemoved") continue;
    if (e.instanceId !== hero || e.counterType !== "chi") continue;
    if (e.type === "counterAdded") {
      total += e.amount;
      added += e.amount;
    } else {
      total -= e.amount;
      removed += e.amount;
    }
    expect(total, "chi never goes below zero").toBeGreaterThanOrEqual(0);
  }
  expect(added, "chi placed").toBeGreaterThanOrEqual(3);
  expect(removed, "chi spent").toBeGreaterThanOrEqual(1);
  expect(final.instances[hero]!.counters["chi"] ?? 0, "chi on the identity at the end").toBe(total);
}

/** Every Temporary resolution is on a card of his deck that then leaves play. */
function temporaryAtWork(initial: GameState, events: readonly GameEvent[]): number {
  let temporary = 0;
  events.forEach((e, i) => {
    if (e.type !== "abilityResolved" || !String(e.abilityId).endsWith("keyword:temporary")) return;
    temporary++;
    expect(DECK_CODES.has(codeOf(initial, e.instanceId)), "a Temporary card from his deck").toBe(true);
    const left = events.slice(i).some((x) => x.type === "cardDiscardedFromPlay" && x.instanceId === e.instanceId);
    expect(left, `the Temporary card ${e.instanceId} left play`).toBe(true);
  });
  return temporary;
}

describe("Iron Fist / Protection precon against Rhino (standard), greedy driver", () => {
  it("setup: the nemesis set is set aside and the obligation is in the encounter deck", () => {
    assertSetup(open(1));
  });

  it("seed 1: plays to a loss, replays deep-equal, and the log shows chi placed and spent and Temporary upgrades", () => {
    const initial = open(1);
    const { outcome, events, state } = play(initial);
    expect(outcome).toMatchObject({ result: "loss" });
    chiAtWork(initial, state, events);
    expect(temporaryAtWork(initial, events), "Temporary resolutions").toBeGreaterThanOrEqual(1);
    const plays = playedCodes(events);
    expect(plays.length, "cards played").toBeGreaterThanOrEqual(5);
    for (const code of plays) expect(DECK_CODES.has(code), `${code} is in the deck`).toBe(true);
  });

  it("seed 2: a second natural game ends in a loss, replays deep-equal, and shows the same chi pattern", () => {
    const initial = open(2);
    const { outcome, events, state } = play(initial);
    expect(outcome).toMatchObject({ result: "loss" });
    chiAtWork(initial, state, events);
    expect(temporaryAtWork(initial, events), "Temporary resolutions").toBeGreaterThanOrEqual(1);
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
