/**
 * The surge keyword deals a facedown encounter card and reveals nothing (the owner's decision, docs/phase7-wave9.md
 * §4.1 Q22 = B: "Dealing a facedown encounter card is not revealing it. This should apply outside the villain phase as
 * well."). The card is an ordinary dealt encounter card of the surging player: revealed by step four of the villain
 * phase, in its turn.
 *
 * Sources: RRG 1.8 "Surge" (p. 42): "the player resolving the card deals themself a facedown encounter card from the
 * top of the encounter deck"; "Deal, Deal an Encounter Card" (p. 15): "This card is not revealed at this time. This
 * card is added to the queue of cards that player resolves during the villain phase. If a player is dealt an encounter
 * card during step three or four of the villain phase, the extra encounter card is added to the queue of cards that are
 * being dealt and revealed in those same steps."; "Villain Phase" (p. 47) step four: "The first player reveals each of
 * their encounter cards, one card at a time in the order in which they were dealt, resolving each card based on its
 * card type. Each player repeats this process in player order, until no dealt encounter cards remain."
 *
 * Synthetic cards only. Every treachery here has 0 boost icons, and each villain activation takes 1 boost card off the
 * encounter deck before step three (1 per player).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { PlayerId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1, P2, playFree } from "./testing/wave3.js";
import { faceVisible } from "./visibility.js";

const you = { kind: "controller" } as const;
const n = (value: number) => ({ kind: "const", value }) as const;

/** "Surge." */
const RUSH = stubTreachery({ id: "rush", boostIcons: 0, keywords: [{ name: "surge" }] });
const A = stubTreachery({ id: "a", boostIcons: 0 });
const B = stubTreachery({ id: "b", boostIcons: 0 });
const C = stubTreachery({ id: "c", boostIcons: 0 });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
// "Deal yourself 2 facedown encounter cards."
const DEAL_TWO = event("deal-two", [{ kind: "dealEncounterCard", player: you, count: n(2) }]);
// "Reveal the top card of the encounter deck."
const REVEAL_TOP = event("reveal-top", [{ kind: "revealEncounterCard", player: you }]);
const EVENTS = [DEAL_TWO, REVEAL_TOP];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));

const start = (players: 1 | 2 = 1): GameState =>
  gameAtFirstTurn({
    players,
    cards: [RUSH, A, B, C, FILLER, ...EVENTS.map((e) => e.card)],
    deps,
    deck: EVENTS.map((e) => e.card.id),
    encounter: [...copiesOf(FILLER.id, 20), RUSH.id, RUSH.id, A.id, B.id, C.id],
  });

/** The encounter deck with a card of each of `codes` on top, the first of them topmost (test surgery). */
const stacked = (state: GameState, ...codes: readonly CardId[]): GameState => {
  const [deckId, piles] = Object.entries(state.encounterDecks)[0]!;
  const rest = [...piles.deck];
  const top = codes.map((code) => {
    const at = rest.findIndex((id) => mustInstance(state, id).cardId === code);
    if (at < 0) throw new Error(`no ${code} left in the encounter deck`);
    return rest.splice(at, 1)[0]!;
  });
  return { ...state, encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: [...top, ...rest] } } };
};

/** Every player ends their turn: the villain phase runs through to the next round. */
const playRound = (state: GameState) =>
  runCommands(state, deps, ...state.players.map((p) => ({ type: "endTurn" as const, playerId: p.playerId })));

/** Each reveal, in order: the card and the player revealing it. */
const reveals = (events: readonly GameEvent[]): readonly (readonly [string, PlayerId])[] =>
  events.flatMap((e) => (e.type === "encounterCardRevealed" ? [[e.cardId as string, e.playerId] as const] : []));
const surges = (events: readonly GameEvent[]) => events.filter((e) => e.type === "surgeTriggered").length;
const dealtTo = (state: GameState, player: PlayerId) =>
  mustPlayer(state, player).dealtEncounter.map((id) => mustInstance(state, id).cardId as string);
const deckSize = (state: GameState) => activeEncounterDeck(state).deck.length;
const discarded = (state: GameState) => activeEncounterDeck(state).discard.length;

function expectReplays(session: GameSession) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("Q22: a surge in step four of the villain phase", () => {
  it("with 2 cards already waiting: the surge's card is revealed in the same step, after both", () => {
    // P1 is dealt the surging card and A by an ability in the player phase; the villain's boost card is a filler;
    // step three deals B; the surge deals C.
    const dealt = playFree(stacked(start(), RUSH.id, A.id, FILLER.id, B.id, C.id), deps, DEAL_TWO.card.id);
    expect(dealtTo(dealt.state, P1)).toEqual(["rush", "a"]);
    expect(reveals(dealt.events)).toEqual([]);
    const before = deckSize(dealt.state);

    const { state, events, session } = playRound(dealt.state);
    expect(reveals(events)).toEqual([
      ["rush", P1],
      ["a", P1],
      ["b", P1],
      ["c", P1],
    ]);
    expect(surges(events)).toBe(1);
    // The surge's deal comes after the surging card's reveal and before the next card's.
    const at = (match: (e: GameEvent) => boolean) => events.findIndex(match);
    const surgeAt = at((e) => e.type === "surgeTriggered");
    expect(surgeAt).toBeGreaterThan(at((e) => e.type === "encounterCardRevealed" && e.cardId === RUSH.id));
    expect(surgeAt).toBeLessThan(at((e) => e.type === "encounterCardRevealed" && e.cardId === A.id));
    // 3 cards left the deck this phase (the boost card, step three's card, the surge's); all 5 are discarded.
    expect(deckSize(state)).toBe(before - 3);
    expect(discarded(state)).toBe(5);
    expect(dealtTo(state, P1)).toEqual([]);
    expect(state.step.phase).toBe("player");
    expectReplays(session);
  });

  it("a chain of 2: each surge's card joins the back of the queue and is revealed in that step", () => {
    // P1 holds the first surging card and A; step three deals B; the first surge deals the second surging card, whose
    // own surge deals C.
    const dealt = playFree(stacked(start(), RUSH.id, A.id, FILLER.id, B.id, RUSH.id, C.id), deps, DEAL_TWO.card.id);
    const before = deckSize(dealt.state);
    const { state, events, session } = playRound(dealt.state);
    expect(reveals(events)).toEqual([
      ["rush", P1],
      ["a", P1],
      ["b", P1],
      ["rush", P1],
      ["c", P1],
    ]);
    expect(surges(events)).toBe(2);
    expect(deckSize(state)).toBe(before - 4);
    expect(discarded(state)).toBe(6);
    expect(dealtTo(state, P1)).toEqual([]);
    expectReplays(session);
  });

  it("two players: the first player reveals their surge's card before the second player reveals anything", () => {
    // 2 boost cards (the villain activates against each player), then step three: the surging card to P1, A to P2;
    // the surge deals B to P1.
    const at = stacked(start(2), FILLER.id, FILLER.id, RUSH.id, A.id, B.id);
    const before = deckSize(at);
    const { state, events, session } = playRound(at);
    expect(reveals(events)).toEqual([
      ["rush", P1],
      ["b", P1],
      ["a", P2],
    ]);
    expect(surges(events)).toBe(1);
    expect(deckSize(state)).toBe(before - 5);
    expect(dealtTo(state, P1)).toEqual([]);
    expect(dealtTo(state, P2)).toEqual([]);
    expectReplays(session);
  });

  it("two players: the second player's surge deals to the second player, who reveals it last", () => {
    const at = stacked(start(2), FILLER.id, FILLER.id, A.id, RUSH.id, B.id);
    const { state, events, session } = playRound(at);
    expect(reveals(events)).toEqual([
      ["a", P1],
      ["rush", P2],
      ["b", P2],
    ]);
    expect(events).toContainEqual(expect.objectContaining({ type: "surgeTriggered", playerId: P2 }));
    expect(dealtTo(state, P2)).toEqual([]);
    expectReplays(session);
  });
});

describe("Q22: a surge outside step four", () => {
  it("a surging card revealed in the player phase: its card waits facedown, hidden, and nothing else is revealed", () => {
    const at = stacked(start(), RUSH.id, A.id, FILLER.id, B.id);
    const before = deckSize(at);
    const { state, events, session } = playFree(at, deps, REVEAL_TOP.card.id);
    expect(state.step.phase).toBe("player");
    expect(reveals(events)).toEqual([["rush", P1]]);
    expect(surges(events)).toBe(1);
    expect(dealtTo(state, P1)).toEqual(["a"]);
    expect(deckSize(state)).toBe(before - 2);
    expect(discarded(state)).toBe(1);
    const [waiting] = mustPlayer(state, P1).dealtEncounter;
    expect(mustInstance(state, waiting!)).toMatchObject({ faceup: false, dealtFromEncounterDeck: true });
    expect(faceVisible(state, waiting!)).toBe(false);
    expect(state.stack).toEqual([]);
    expectReplays(session);

    // The next step four reveals it first, then step three's card: "in the order in which they were dealt".
    const round = playRound(state);
    expect(reveals(round.events)).toEqual([
      ["a", P1],
      ["b", P1],
    ]);
    expect(surges(round.events)).toBe(0);
    // Nothing between the end of the turn and step four turned it up.
    const firstReveal = round.events.findIndex((e) => e.type === "encounterCardRevealed");
    const stepFour = round.events.findIndex((e) => e.type === "stepChanged" && e.to.kind === "revealEncounterCards");
    expect(stepFour).toBeGreaterThan(-1);
    expect(firstReveal).toBeGreaterThan(stepFour);
    expect(dealtTo(round.state, P1)).toEqual([]);
    expect(discarded(round.state)).toBe(4);
    expectReplays(round.session);
  });

  it("two players, the second player's turn: the card waits in front of the player who surged", () => {
    const first = runCommands(stacked(start(2), RUSH.id, A.id), deps, { type: "endTurn", playerId: P1 });
    const { state, events } = playFree(first.state, deps, REVEAL_TOP.card.id, P2);
    expect(reveals(events)).toEqual([["rush", P2]]);
    expect(dealtTo(state, P1)).toEqual([]);
    expect(dealtTo(state, P2)).toEqual(["a"]);

    // Villain phase: 2 boost cards, step three's B to P1 and C to P2. P2 reveals the waiting card before step three's.
    const round = runCommands(stacked(state, FILLER.id, FILLER.id, B.id, C.id), deps, {
      type: "endTurn",
      playerId: P2,
    });
    expect(reveals(round.events)).toEqual([
      ["b", P1],
      ["a", P2],
      ["c", P2],
    ]);
    expectReplays(round.session);
  });
});
