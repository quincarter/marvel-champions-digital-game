import { JJ_STARTER_DECKS, LUKE_CAGE_STARTER_DECKS, PLAYABLE_CARDS, cardId } from "@mc/content";
import {
  createGame,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameOutcome,
  type GameSession,
  type GameState,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../core/setup.js";
import { playToOutcome } from "../testing/driver.js";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  payWith,
  play,
  settle,
} from "../testing/harness.js";
import { withForm } from "../testing/staging.js";
import { WAVE11_DEPS } from "./index.js";

vi.setConfig({ testTimeout: 300_000 });

/**
 * Wave 11 two-player precon game: Jessica Jones (`jj-justice`, 61001) and Luke Cage (`luke-cage-leadership`, 62001)
 * against Core's Rhino in standard mode, played by the greedy driver (testing/driver.ts). Each seat is built from its
 * own starter deck (`starterDeckId` only names Core decks, so the seats are written out as the single-hero precon
 * games do).
 *
 * Per game: no thrown error, an outcome and no pending prompt at the end, and the session log replays from the first
 * state deep-equal (`replay`) and one command at a time (`sessionApply`).
 *
 * Unbreakable Bond (61027 / 62024, a verbatim reprint): "Team-Up (Jessica Jones and Luke Cage). Hero Action (thwart):
 * Remove 3 threat from a scheme. Heal a total of 3 damage from among Jessica Jones and Luke Cage." RRG 1.8 "Team-Up"
 * (p. 43): it cannot be played unless a friendly character matching each name is in play. The greedy driver may never
 * draw it (neither starter list holds it), so the focused checks stage it into a hand and play it by real commands.
 */
const JJ = JJ_STARTER_DECKS.find((d) => d.id === "jj-justice")!;
const LUKE = LUKE_CAGE_STARTER_DECKS.find((d) => d.id === "luke-cage-leadership")!;
const DECK_CODES = new Set([...JJ.cards, ...LUKE.cards].map((e) => e.cardId as string));
const P2 = "p2" as PlayerId;
const SPIDER_MAN = "01001a";
const FILLER = "01091";

const seatOf = (d: typeof JJ | typeof LUKE) => ({
  identityCardId: d.identityCardId,
  aspects: d.aspects,
  deck: d.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
});

const baseConfig = (seed: number) =>
  coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);

function open(seed: number): GameState {
  const created = createGame({ ...baseConfig(seed), players: [seatOf(JJ), seatOf(LUKE)] }, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return created.state;
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

function playGame(initial: GameState): { state: GameState; outcome: GameOutcome; events: readonly GameEvent[] } {
  const run = playToOutcome(initial, WAVE11_DEPS, { maxCommands: 4000 });
  const s = run.session.state;
  expect(run.outcome, `no outcome after ${run.commands} commands, round ${run.rounds}`).not.toBeNull();
  expect(s.pendingChoice, "a prompt is still open at the end").toBeNull();
  const replayed = replay(run.session.log, WAVE11_DEPS);
  if (!replayed.ok) throw new Error(`replay failed: ${replayed.error.message}`);
  expect(replayed.state, "replay diverged").toEqual(s);
  expect(walk(run.session), "the command-by-command walk diverged").toEqual(s);
  return { state: s, outcome: run.outcome!, events: replayed.events };
}

describe("Jessica Jones + Luke Cage precons against Rhino (standard), two players, greedy driver", () => {
  for (const seed of [2, 10]) {
    it(`seed ${seed}: plays to an outcome, replays deep-equal, and only deck cards are played`, () => {
      const { events } = playGame(open(seed));
      const plays = events.flatMap((e) => (e.type === "cardPlayed" ? [e.cardId as string] : []));
      expect(plays.length, "cards played").toBeGreaterThanOrEqual(3);
      for (const code of plays) expect(DECK_CODES.has(code), `${code} is in a deck`).toBe(true);
    });
  }
});

describe("Unbreakable Bond (61027 / 62024): Team-Up (Jessica Jones and Luke Cage), RRG 1.8 p. 43", () => {
  const toPlayerPhase = (s: GameState) => settle(s, firstLegal, (x) => x.step.phase === "player", WAVE11_DEPS);

  const staged = (code: string, player: PlayerId, jjDamage: number, lukeDamage: number) => {
    let s = toPlayerPhase(withForm(withForm(open(1), { heroForm: 0 }), { heroForm: 0 }, P2));
    s = patchInstance(s, identityOf(s, P1), { damage: jjDamage });
    s = patchInstance(s, identityOf(s, P2), { damage: lukeDamage });
    s = patchInstance(s, s.mainScheme.instanceId, { threat: 10 });
    const given = moveToHand(s, player, code);
    const id = given.ids[0]!;
    const command: Command = play(player, id, payWith(given.state, player, 1, [id]));
    return { state: given.state, command };
  };

  const run = (state: GameState, command: Command): GameState => {
    let session = startSession(state);
    const first = sessionApply(session, command, WAVE11_DEPS);
    if (!first.ok) throw new Error(`${command.type} rejected: ${first.error.code}: ${first.error.message}`);
    session = first.session;
    for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
      if (guard > 100) throw new Error("choices did not settle");
      const c = session.state.pendingChoice;
      const next = sessionApply(
        session,
        {
          type: "resolveChoice",
          playerId: c.playerId,
          choiceId: c.choiceId,
          selectedOptionIds: firstLegal(session.state),
        },
        WAVE11_DEPS,
      );
      if (!next.ok) throw new Error(`resolveChoice rejected: ${next.error.message}`);
      session = next.session;
    }
    const replayed = replay(session.log, WAVE11_DEPS);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
    return session.state;
  };

  const damageOf = (s: GameState) => inst(s, identityOf(s, P1)).damage + inst(s, identityOf(s, P2)).damage;

  for (const [code, player, label] of [
    ["61027", P1, "Jessica's copy, played by Jessica"],
    ["62024", P2, "Luke's copy, played by Luke"],
  ] as const) {
    it(`${label}: removes 3 threat and heals a total of 3 from the two heroes`, () => {
      const { state, command } = staged(code, player, 2, 4);
      expect(damageOf(state)).toBe(6);
      const after = run(state, command);
      expect(mainThreat(after)).toBe(7);
      expect(damageOf(after)).toBe(3);
    });
  }

  it("heals only what is there: 1 damage on each heals 2 in all, and still removes 3 threat", () => {
    const { state, command } = staged("61027", P1, 1, 1);
    const after = run(state, command);
    expect(mainThreat(after)).toBe(7);
    expect(damageOf(after)).toBe(0);
  });

  it("is refused while Luke Cage is not in play (Jessica seated with Spider-Man instead)", () => {
    const spider = {
      identityCardId: cardId(SPIDER_MAN),
      aspects: ["justice"] as const,
      deck: Array.from({ length: 40 }, () => cardId(FILLER)),
    };
    const created = createGame(
      { ...baseConfig(1), requireLegalDecks: false, players: [seatOf(JJ), spider] } as never,
      WAVE11_DEPS,
    );
    if (!created.ok) throw new Error(created.error.message);
    const ready = toPlayerPhase(withForm(created.state, { heroForm: 0 }));
    const given = moveToHand(ready, P1, "61027");
    const id = given.ids[0]!;
    const result = sessionApply(
      startSession(given.state),
      play(P1, id, payWith(given.state, P1, 1, [id])),
      WAVE11_DEPS,
    );
    expect(result.ok, "Team-Up needs Luke Cage in play").toBe(false);
  });
});
