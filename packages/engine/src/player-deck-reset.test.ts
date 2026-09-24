/**
 * docs/phase7-wave3.md §4 Q15 (resolved): a player deck is reset the moment it empties, not on its next read.
 *
 * Sources: RRG 1.8 "Player Deck" (p. 33): "If a player deck empties, the player shuffles their discard pile to make a
 * new deck. That player immediately deals themself one facedown encounter card"; a deck emptied while drawing keeps
 * drawing from the new deck; a deck emptied while discarding from it stops the discarding; an empty deck with an empty
 * discard pile resets as soon as a card reaches the discard pile. Ruling, Apr 30, 2026 (3) answer 7: "The deck is
 * reshuffled **before** the currently resolving card enters the discard pile."
 *
 * The one check is `settlePlayerDecks` (`ctx.ts`), run after every `moveCard` out of a player's deck or into a player's
 * discard pile, so draws, discards from the deck, searches and mills all follow it.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent } from "./testing/fixtures.js";
import { RESOURCE } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const yourIdentity: TargetRef = { kind: "identityOf", player: you };
const n = (value: number): ValueSpec => ({ kind: "const", value });
/** Records what the rest of the event sees: the deck's size and the facedown encounter cards dealt so far. */
const READ: readonly EffectSpec[] = [
  { kind: "addCounters", target: yourIdentity, counterType: "deckSeen", amount: { kind: "deckCount", player: you } },
  {
    kind: "addCounters",
    target: yourIdentity,
    counterType: "dealtSeen",
    amount: { kind: "dealtEncounterCount", player: you },
  },
];
const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects } satisfies AbilityDefinition);
  return { ability, card: stubEvent({ id, cost: 0, abilities: [ability.ref] }) };
};

/** "Draw 1 card." then read. */
const DRAW_ONE = event("draw-one", [{ kind: "draw", player: you, amount: n(1) }, ...READ]);
/** "Draw 3 cards." */
const DRAW_THREE = event("draw-three", [{ kind: "draw", player: you, amount: n(3) }]);
/** "Discard the top 2 cards of your deck." then read (a mill: `moveCards`). */
const MILL_TWO = event("mill-two", [
  { kind: "moveCards", cards: { kind: "zone", zone: "deck", player: you, top: n(2) }, to: "discard" },
  ...READ,
]);
/** "Search your deck for an event and add it to your hand." then read. */
const SEARCH = event("search", [
  {
    kind: "moveCards",
    cards: { kind: "zone", zone: "deck", player: you, filter: { categories: ["event"] }, topmostOnly: true },
    to: "hand",
  },
  ...READ,
]);
/** "Deal 100 damage to each other player's identity": eliminates P2. */
const KILL = event("kill", [
  {
    kind: "dealDamage",
    target: { kind: "identityOf", player: { kind: "others", of: you } },
    amount: n(100),
  },
]);
const EVENTS = [DRAW_ONE, DRAW_THREE, MILL_TWO, SEARCH, KILL];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));
/** A card that does nothing where it lies. */
const FILL: CardId = RESOURCE.id;

const start = (players: 1 | 2 = 1): GameState =>
  gameAtFirstTurn({
    cards: EVENTS.map((e) => e.card),
    deps,
    players,
    deck: [...EVENTS.flatMap((e) => [e.card.id, e.card.id]), ...copiesOf(FILL, 8)],
  });

/**
 * Test surgery: `player`'s hand is exactly `hand`, their deck `deck` (top first) and their discard pile `discard`, all
 * taken from the cards they own; every other card is set aside.
 */
function arrange(
  state: GameState,
  piles: { hand: readonly CardId[]; deck: readonly CardId[]; discard: readonly CardId[] },
  player: PlayerId = P1,
) {
  const owner = mustPlayer(state, player);
  const spare = [...owner.hand, ...owner.deck, ...owner.discard];
  const take = (wanted: readonly CardId[]): InstanceId[] =>
    wanted.map((card) => {
      const index = spare.findIndex((id) => mustInstance(state, id).cardId === card);
      if (index < 0) throw new Error(`${player} has no spare ${card}`);
      return spare.splice(index, 1)[0]!;
    });
  const hand = take(piles.hand);
  const deck = take(piles.deck);
  const discard = take(piles.discard);
  return {
    hand,
    deck,
    discard,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player ? { ...p, hand, deck, discard, setAside: [...p.setAside, ...spare] } : p,
      ),
    },
  };
}

const playFirst = (arranged: { state: GameState; hand: readonly InstanceId[] }) =>
  driveSession(startSession(arranged.state), deps, [
    { type: "playCard", playerId: P1, cardInstanceId: arranged.hand[0]!, payment: [], attachToInstanceId: null },
  ]);
const seen = (state: GameState, name: string): number =>
  mustInstance(state, mustPlayer(state, P1).identity.instanceId).counters[name] ?? 0;

describe("§4 Q15: a player deck resets the moment it empties", () => {
  it("a draw that empties the deck resets it before the rest of the effect reads it, and the event is not in it", () => {
    const set = arrange(start(), { hand: [DRAW_ONE.card.id], deck: [FILL], discard: [FILL, FILL, MILL_TWO.card.id] });
    const after = playFirst(set).session.state;
    const player = mustPlayer(after, P1);
    // Before this change the rest of the event saw an empty deck and no encounter card (0 and 0).
    expect(seen(after, "deckSeen")).toBe(3);
    expect(seen(after, "dealtSeen")).toBe(1);
    // Answer 7: the event was still resolving when the deck reset, so it is not shuffled into the new deck.
    expect(player.deck).toHaveLength(3);
    expect(player.deck).toEqual(expect.arrayContaining(set.discard));
    expect(player.discard).toEqual([set.hand[0]]);
    expect(player.hand).toContain(set.deck[0]);
    expect(player.dealtEncounter).toHaveLength(1);
  });

  it("a draw goes on from the new deck, logging the reset between the draws", () => {
    const set = arrange(start(), { hand: [DRAW_THREE.card.id], deck: [FILL], discard: [FILL, FILL, FILL, FILL] });
    const { session, events } = playFirst(set);
    expect(mustPlayer(session.state, P1).hand).toHaveLength(3);
    expect(mustPlayer(session.state, P1).dealtEncounter).toHaveLength(1);
    const trail = events
      .filter((e: GameEvent) => e.type === "cardDrawn" || e.type === "deckShuffled" || e.type === "playerDeckReset")
      .map((e) => e.type);
    expect(trail).toEqual(["cardDrawn", "deckShuffled", "playerDeckReset", "cardDrawn", "cardDrawn"]);
  });

  it("a mill that empties the deck resets it at once, with the milled cards in it", () => {
    const set = arrange(start(), { hand: [MILL_TWO.card.id], deck: [FILL, FILL], discard: [FILL] });
    const after = playFirst(set).session.state;
    expect(seen(after, "deckSeen")).toBe(3);
    expect(seen(after, "dealtSeen")).toBe(1);
    expect(mustPlayer(after, P1).deck).toEqual(expect.arrayContaining([...set.deck, ...set.discard]));
    expect(mustPlayer(after, P1).discard).toEqual([set.hand[0]]);
  });

  it("a search that takes the deck's last card resets it at once", () => {
    const set = arrange(start(), { hand: [SEARCH.card.id], deck: [DRAW_ONE.card.id], discard: [FILL, FILL] });
    const after = playFirst(set).session.state;
    expect(mustPlayer(after, P1).hand).toContain(set.deck[0]);
    expect(seen(after, "deckSeen")).toBe(2);
    expect(seen(after, "dealtSeen")).toBe(1);
  });

  it("an empty deck with an empty discard pile resets when the first card reaches the discard pile", () => {
    const set = arrange(start(), { hand: [DRAW_ONE.card.id], deck: [FILL], discard: [] });
    const after = playFirst(set).session.state;
    // The draw emptied the deck with nothing to reshuffle; the rest of the event saw it empty.
    expect(seen(after, "deckSeen")).toBe(0);
    expect(seen(after, "dealtSeen")).toBe(0);
    // The event itself was the first card into the discard pile: the deck reset then, with its penalty.
    expect(mustPlayer(after, P1).deck).toEqual([set.hand[0]]);
    expect(mustPlayer(after, P1).discard).toEqual([]);
    expect(mustPlayer(after, P1).dealtEncounter).toHaveLength(1);
  });

  it("an eliminated player's deck is emptied into its discard pile without a reset", () => {
    const set = arrange(start(2), { hand: [KILL.card.id], deck: [FILL, FILL], discard: [FILL] });
    const { session, events } = playFirst(set);
    expect(mustPlayer(session.state, P2).eliminated).toBe(true);
    // RRG 1.8 "Player Elimination" (p. 33) steps 4 and 5: the cards go to the discard pile and are removed with it.
    expect(events.some((e) => e.type === "playerDeckReset" && e.playerId === P2)).toBe(false);
    expect(mustPlayer(session.state, P2).deck).toEqual([]);
  });

  it("replays to the same state", () => {
    const set = arrange(start(), { hand: [DRAW_THREE.card.id], deck: [FILL], discard: [FILL, FILL, FILL] });
    const { session } = playFirst(set);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
