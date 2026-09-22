/**
 * `ValueSpec deckCount`: how many cards are in a player's deck — the sibling of `handCount`, and the measure a
 * "half of their deck" text needs before a `zone` `CardSelector`'s `top` can name the cards.
 *
 * Rounding is deliberately *not* part of this value: it is a plain count, and the halving is `scaled.divide`, whose
 * `round` is required. RRG 1.8 "Modifiers" (p. 29): "Fractional values are rounded up after all modifiers have been
 * applied" — so a text that prints no rounding halves up, and one that prints "(rounded down)" says so.
 *
 * Synthetic cards only; the engine never names a card.
 */
import { cardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { Command } from "./commands.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { mustPlayer } from "./query.js";
import { resolveValue, type EffectContext } from "./select.js";
import type { EffectSpec, PlayerRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent } from "./testing/fixtures.js";
import { DEFAULT_DECK, giveCards, newGame, runWith } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const controller: PlayerRef = { kind: "controller" };
const scoped: PlayerRef = { kind: "scoped" };
const deckCount = (player: PlayerRef = controller): ValueSpec => ({ kind: "deckCount", player });

/** "Draw 2 cards": the plainest way to move the deck without touching it by hand. */
const DRAW_ACTION = stubAbility("draw2.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "draw", player: controller, amount: { kind: "const", value: 2 } }],
});
const DRAW2 = stubEvent({ id: "draw2", cost: 0, abilities: [DRAW_ACTION.ref] });

/** "Each player removes the top half of their deck (rounded down) from the game": the shape the value exists for. */
const halfDeck = (player: PlayerRef, round: "down" | "up"): EffectSpec => ({
  kind: "moveCards",
  cards: {
    kind: "zone",
    zone: "deck",
    player,
    top: { kind: "scaled", value: deckCount(player), divide: { by: 2, round } },
  },
  to: "removedFromGame",
});
const REMOVE_HALF_ACTION = stubAbility("remove-half.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "forEachPlayer", players: { kind: "each" }, effects: [halfDeck(scoped, "down")] }],
});
const REMOVE_HALF = stubEvent({ id: "remove-half", cost: 0, abilities: [REMOVE_HALF_ACTION.ref] });

const DEPS = depsOf(DRAW_ACTION, REMOVE_HALF_ACTION);
const EXTRA_CARDS = [DRAW2, REMOVE_HALF];
const DECK = [...DEFAULT_DECK, ...Array.from({ length: 3 }, () => DRAW2.id), REMOVE_HALF.id];

const game = (players = 1) =>
  newGame({ players, extraCards: EXTRA_CARDS, deck: DECK.map((id) => cardId(id)), deps: DEPS });
const run = (state: GameState, ...commands: readonly Command[]) => runWith(DEPS, state, ...commands);
const play = (id: InstanceId, player: PlayerId = p1): Command => ({
  type: "playCard",
  playerId: player,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});

const context = (player: PlayerId = p1): EffectContext => ({
  selfInstanceId: null,
  controllerId: player,
  event: null,
  bindings: {},
  deps: DEPS,
});
const count = (state: GameState, player: PlayerId = p1): number =>
  resolveValue(state, deckCount(), context(player), DEPS);
/** Test-only surgery so deck parity (odd vs. even) is exact rather than whatever the shuffle left. */
const deckOfSize = (state: GameState, size: number, player: PlayerId = p1): GameState => ({
  ...state,
  players: state.players.map((p) => (p.playerId === player ? { ...p, deck: p.deck.slice(0, size) } : p)),
});

describe("ValueSpec deckCount", () => {
  it("is the number of cards in that player's deck, and 0 for an empty deck", () => {
    const state = game();
    expect(count(state)).toBe(mustPlayer(state, p1).deck.length);
    expect(count(deckOfSize(state, 7))).toBe(7);
    expect(count(deckOfSize(state, 0))).toBe(0);
  });

  it("drops by one per card drawn", () => {
    const {
      state,
      ids: [draw2],
    } = giveCards(game(), p1, DRAW2.id);
    const before = count(state);
    const after = run(state, play(draw2 as InstanceId));
    expect(count(after)).toBe(before - 2);
    expect(count(after)).toBe(mustPlayer(after, p1).deck.length);
  });

  it("reads each player's own deck, not the first player's", () => {
    const state = deckOfSize(deckOfSize(game(2), 9, p1), 4, p2);
    expect([count(state, p1), count(state, p2)]).toEqual([9, 4]);
  });

  it("halves the way the text says, RRG 1.8 'Modifiers' (p. 29) rounding fractions up when it is silent", () => {
    const half = (size: number, round: "down" | "up") =>
      resolveValue(
        deckOfSize(game(), size),
        { kind: "scaled", value: deckCount(), divide: { by: 2, round } },
        context(),
        DEPS,
      );
    expect([half(9, "down"), half(9, "up"), half(8, "down"), half(8, "up")]).toEqual([4, 5, 4, 4]);
    expect([half(1, "down"), half(1, "up"), half(0, "down"), half(0, "up")]).toEqual([0, 1, 0, 0]);
  });

  it("feeds a zone selector's `top`: 'each player removes the top half of their deck (rounded down)'", () => {
    const {
      state,
      ids: [removeHalf],
    } = giveCards(game(2), p1, REMOVE_HALF.id);
    const sized = deckOfSize(deckOfSize(state, 9, p1), 4, p2);
    const topFourOfP1 = mustPlayer(sized, p1).deck.slice(0, 4);
    const after = run(sized, play(removeHalf as InstanceId));
    // 9 -> removes 4 (floor), leaving 5, and exactly the top 4 went; p2's own 4 -> removes 2, leaving 2.
    expect(mustPlayer(after, p1).deck).toEqual(mustPlayer(sized, p1).deck.slice(4));
    expect(mustPlayer(after, p2).deck).toEqual(mustPlayer(sized, p2).deck.slice(2));
    for (const id of topFourOfP1) expect(mustPlayer(after, p1).deck).not.toContain(id);
  });

  it("is measured before the cards move, so the half is of the starting deck", () => {
    const {
      state,
      ids: [removeHalf],
    } = giveCards(game(), p1, REMOVE_HALF.id);
    const sized = deckOfSize(state, 10);
    expect(count(run(sized, play(removeHalf as InstanceId)))).toBe(5); // not 10 -> 5 -> 2
  });
});
