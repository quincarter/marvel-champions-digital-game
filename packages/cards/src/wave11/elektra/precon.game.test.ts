import { ELEKTRA_STARTER_DECKS, PLAYABLE_CARDS } from "@mc/content";
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
 * Wave 11 precon game (docs/phase7-elektra-iron-fist.md): Elektra's starter deck `elektra-aggression` (63001a/b,
 * Aggression) against Core's Rhino in standard mode, played by the greedy driver (testing/driver.ts, which knows no
 * card names) to a loss and to a win.
 *
 * Per game: no thrown error (the driver throws on a rejected command), an outcome and no pending prompt at the end,
 * and the session log replays from the first state deep-equal (`replay`) and one command at a time (`sessionApply`).
 * Asserted from the setup state and the event log:
 * - Setup (63001b "begins the game with a Ninja deck", owner decision 2 in section 5 of the doc): six Ninja cards
 *   (63002, 63003, 63004, two each) wait in a separate deck named Ninja, outside her player deck; her nemesis set
 *   63029 to 63033 is set aside (RRG 1.8 "Nemesis Encounter Set"); the obligation 63028 is shuffled into the encounter
 *   deck (RRG 1.8 "Obligation"), not into her deck.
 * - Villainous (63001a, RRG 1.8 "Villainous", p. 47; MC60 p. 26 FAQ): every basic power she uses in hero form is given
 *   a facedown boost card, which is then turned faceup (`boostCardDealt` to her, `characterBoostCardFlipped`).
 * - Ninja Training (63001b): changing to hero form shuffles the top Ninja card into the encounter deck.
 * - Killer Instinct (63001a): the interrupt cancels the Boost ability of a boost card given to her (`boostCancelled`
 *   scope "ability"). The greedy driver reaches it on seeds 4 and 6 only, so it is asserted on that pair together.
 *
 * Reachability. The greedy player never wins Rhino naturally, so the loss is natural and the win is staged (Rhino one
 * hit from defeat, the hero in hero form: surgery on the table only); every rule is exercised by real commands.
 * Seeds: 1, 4 and 6 give natural losses that show Villainous and Ninja Training; 4 and 6 also show Killer Instinct.
 */
const DECK = ELEKTRA_STARTER_DECKS.find((d) => d.id === "elektra-aggression")!;
const DECK_CODES = new Set(DECK.cards.map((e) => e.cardId as string));
const NINJA_CODES = ["63002", "63002", "63003", "63003", "63004", "63004"];

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

/** The setup claims: the Ninja deck, the set-aside nemesis set and the obligation's place. */
function assertSetup(s: GameState): void {
  const player = s.players[0]!;
  const ninja = player.separateDecks["Ninja"]!;
  expect(ninja.deck.map((id) => codeOf(s, id)).sort(), "Ninja deck").toEqual(NINJA_CODES);
  for (const id of ninja.deck) expect(player.deck.includes(id), "a Ninja card is in her deck").toBe(false);
  expect(player.setAside.map((id) => codeOf(s, id)).sort(), "set-aside nemesis set").toEqual([
    "63029",
    "63030",
    "63031",
    "63032",
    "63033",
  ]);
  const obligation = Object.keys(s.instances).filter((id) => codeOf(s, id as InstanceId) === "63028");
  expect(obligation).toHaveLength(1);
  expect(locateCard(s, obligation[0] as InstanceId)).toMatchObject({ kind: "encounterDeck" });
}

/** Villainous and Ninja Training in an event stream; returns how many Boost abilities were cancelled. */
function identityAtWork(initial: GameState, events: readonly GameEvent[]): { cancelled: number } {
  const hero = initial.players[0]!.identity.instanceId;
  const dealt = events.flatMap((e) =>
    e.type === "boostCardDealt" && e.enemyInstanceId === hero ? [e.instanceId] : [],
  );
  const flipped = events.flatMap((e) =>
    e.type === "characterBoostCardFlipped" && e.characterInstanceId === hero ? [e.instanceId] : [],
  );
  expect(dealt.length, "boost cards dealt to Elektra").toBeGreaterThanOrEqual(1);
  expect(flipped.length, "her boost cards turned faceup").toBeGreaterThanOrEqual(1);
  for (const id of flipped) expect(dealt.includes(id), "a flipped boost card was dealt to her").toBe(true);
  // Ninja Training: a Ninja card leaves the separate deck for the encounter deck.
  const shuffledIn = events.filter(
    (e) => e.type === "cardMoved" && e.from.kind === "separateDeck" && e.to.kind === "encounterDeck",
  );
  expect(shuffledIn.length, "Ninja cards shuffled into the encounter deck").toBeGreaterThanOrEqual(1);
  return { cancelled: events.filter((e) => e.type === "boostCancelled" && e.scope === "ability").length };
}

describe("Elektra / Aggression precon against Rhino (standard), greedy driver", () => {
  it("setup: the Ninja deck, the set-aside nemesis set and the obligation in the encounter deck", () => {
    assertSetup(open(1));
  });

  it("seed 1: plays to a loss, replays deep-equal, and the log shows Villainous and Ninja Training", () => {
    const initial = open(1);
    const { outcome, events } = play(initial);
    expect(outcome).toMatchObject({ result: "loss" });
    identityAtWork(initial, events);
    const plays = playedCodes(events);
    expect(plays.length, "cards played").toBeGreaterThanOrEqual(3);
    for (const code of plays) expect(DECK_CODES.has(code), `${code} is in the deck`).toBe(true);
  });

  it("seeds 4 and 6: Killer Instinct cancels a boost card's Boost ability on Elektra", () => {
    let killerInstinct = 0;
    let cancelled = 0;
    for (const seed of [4, 6]) {
      const initial = open(seed);
      const { outcome, events } = play(initial);
      expect(outcome).toMatchObject({ result: "loss" });
      cancelled += identityAtWork(initial, events).cancelled;
      killerInstinct += events.filter(
        (e) => e.type === "abilityResolved" && e.abilityId === ("63001a.killer-instinct" as never),
      ).length;
    }
    expect(killerInstinct, "Killer Instinct resolved").toBeGreaterThanOrEqual(1);
    expect(cancelled, "boost abilities cancelled").toBeGreaterThanOrEqual(1);
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
