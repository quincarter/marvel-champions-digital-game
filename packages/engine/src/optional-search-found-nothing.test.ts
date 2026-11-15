/**
 * An optional search ("you may search your deck for a widget") that finds no card it can take says so in the log
 * (`searchFoundNothing`), rather than passing silently (owner decision 2026-11-08, from Call for Backup / Build
 * Support offering only cards that can enter play). A required search keeps its own `preThenUnresolved` line, and a
 * search with something to take, taken or declined, logs no `searchFoundNothing`.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import type { CardSelector, EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession, runCommandsPicking } from "./testing/drive.js";
import { startSession } from "./engine.js";
import { stubEvent } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playFree } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const chosen = (slot: string) => ({ kind: "ref", ref: { kind: "slot", slot } }) as const;
const deckOrDiscard = (name: string): CardSelector => ({
  kind: "zone",
  zone: ["deck", "discard"],
  player: you,
  filter: { name },
});
const WIDGET = stubEvent({ id: "widget", cost: 9 });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const search = (min: number): EffectSpec => ({
  kind: "chooseCards",
  slot: "found",
  from: deckOrDiscard("widget"),
  chooser: you,
  min,
  max: 1,
});
/** A `chooseCards` of up to 1 among the top 2 cards of P1's deck. */
function topTwo(opts: { readonly filter?: { readonly name: string } }): Extract<EffectSpec, { kind: "chooseCards" }> {
  return {
    kind: "chooseCards",
    slot: "found",
    from: { kind: "zone", zone: "deck", player: you, top: { kind: "const", value: 2 }, ...opts },
    chooser: you,
    min: 0,
    max: 1,
  };
}
/** "You may search your deck and discard pile for a widget and add it to your hand." */
const MAY_SEARCH = actionEvent("may-search", [
  search(0),
  { kind: "moveCards", cards: chosen("found"), to: "hand" },
  { kind: "shuffleDeck", player: you },
]);
/** "Search your deck for a widget and add it to your hand." */
const MUST_SEARCH = actionEvent("must-search", [
  {
    kind: "chooseCards",
    slot: "found",
    from: { kind: "zone", zone: "deck", player: you, filter: { name: "widget" } },
    chooser: you,
    min: 1,
    max: 1,
  },
  { kind: "moveCards", cards: chosen("found"), to: "hand" },
]);
/** "You may discard a widget from your hand. Draw 1 card.": optional, but no deck is searched. */
const MAY_DISCARD = actionEvent("may-discard", [
  {
    kind: "chooseCards",
    slot: "found",
    from: { kind: "zone", zone: "hand", player: you, filter: { name: "widget" } },
    chooser: you,
    min: 0,
    max: 1,
  },
  { kind: "moveCards", cards: chosen("found"), to: "discard" },
  { kind: "draw", player: you, amount: { kind: "const", value: 1 } },
]);

/** "Look at the top 2 cards of your deck. You may add 1 of them to your hand.": a look, not a search. */
const LOOK_TOP_2 = actionEvent("look-top-2", [topTwo({}), { kind: "moveCards", cards: chosen("found"), to: "hand" }]);
/** "Search the top 2 cards of your deck for a widget and add it to your hand. (Shuffle.)" */
const SEARCH_TOP_2 = actionEvent("search-top-2", [
  topTwo({ filter: { name: "widget" } }),
  { kind: "moveCards", cards: chosen("found"), to: "hand" },
  { kind: "shuffleDeck", player: you },
]);
/** "Search the top 2 cards of your deck for any card …" (X-Bunker's wording): marked a search (`search: true`). */
const SEARCH_TOP_2_ANY = actionEvent("search-top-2-any", [
  { ...topTwo({}), search: true },
  { kind: "moveCards", cards: chosen("found"), to: "hand" },
  { kind: "shuffleDeck", player: you },
]);

const EVENTS = [MAY_SEARCH, MUST_SEARCH, MAY_DISCARD, LOOK_TOP_2, SEARCH_TOP_2, SEARCH_TOP_2_ANY];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));

/** The first turn with `widgets` widgets in P1's deck and none in their hand or discard pile. */
function withWidgets(widgets: number): GameState {
  const state = gameAtFirstTurn({
    cards: [WIDGET, ...EVENTS.map((e) => e.card)],
    deps,
    deck: [...copiesOf(WIDGET.id, 2), ...EVENTS.flatMap((e) => copiesOf(e.card.id, 3))],
  });
  const isWidget = (id: InstanceId) => state.instances[id]?.cardId === WIDGET.id;
  const seat = mustPlayer(state, P1);
  const kept = [...seat.hand, ...seat.deck, ...seat.discard].filter(isWidget).slice(0, widgets);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            hand: p.hand.filter((id) => !isWidget(id)),
            deck: [...kept, ...p.deck.filter((id) => !isWidget(id))],
            discard: p.discard.filter((id) => !isWidget(id)),
          }
        : p,
    ),
  };
}
const start = (): GameState => withWidgets(0);
const withWidgetInDeck = (): GameState => withWidgets(1);

const foundNothing = (events: readonly GameEvent[]) => events.filter((e) => e.type === "searchFoundNothing");

describe("an optional search that finds nothing it can take", () => {
  it("tells the searcher (searchFoundNothing), and the ability still resolves the rest", () => {
    const { events } = playFree(start(), deps, MAY_SEARCH.card.id);
    expect(foundNothing(events)).toEqual([{ type: "searchFoundNothing", playerId: P1, slot: "found" }]);
    expect(events.some((e) => e.type === "deckShuffled")).toBe(true);
    expect(events.some((e) => e.type === "preThenUnresolved")).toBe(false);
  });

  it("logs nothing of the kind when there is a card to take and it is taken", () => {
    const given = giveCard(withWidgetInDeck(), P1, MAY_SEARCH.card.id);
    const takeAll = (state: GameState) =>
      state.pendingChoice!.prompt.kind === "chooseCards"
        ? state.pendingChoice!.options.slice(0, 1).map((o) => o.optionId)
        : [];
    const { state, events } = runCommandsPicking(given.state, deps, takeAll, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });
    expect(mustPlayer(state, P1).hand.some((id) => state.instances[id]?.cardId === WIDGET.id)).toBe(true);
    expect(foundNothing(events)).toEqual([]);
  });

  it("logs nothing of the kind when there is a card to take and the player declines", () => {
    const { state, events } = playFree(withWidgetInDeck(), deps, MAY_SEARCH.card.id);
    expect(mustPlayer(state, P1).hand.some((id) => state.instances[id]?.cardId === WIDGET.id)).toBe(false);
    expect(foundNothing(events)).toEqual([]);
  });

  it("a required search keeps its own line (preThenUnresolved), not this one", () => {
    const { events } = playFree(start(), deps, MUST_SEARCH.card.id);
    expect(foundNothing(events)).toEqual([]);
    expect(events).toContainEqual({ type: "preThenUnresolved", cause: "searchFoundNothing" });
  });

  it("an optional choice that reads no deck stays silent", () => {
    const { events } = playFree(start(), deps, MAY_DISCARD.card.id);
    expect(foundNothing(events)).toEqual([]);
  });
});

describe("a look at a deck's top cards is not a search (`isOptionalSearch`)", () => {
  /** `card` played by P1 with their deck and discard pile emptied by surgery: the top 2 cards are no cards. */
  function playWithEmptyDeck(card: string) {
    const given = giveCard(start(), P1, card);
    const emptied: GameState = {
      ...given.state,
      players: given.state.players.map((p) => (p.playerId === P1 ? { ...p, deck: [], discard: [] } : p)),
    };
    expect(mustPlayer(emptied, P1).deck).toEqual([]);
    return driveSession(startSession(emptied), deps, [
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    ]);
  }

  it("'look at the top 2 cards' with nothing there logs no searchFoundNothing", () => {
    const { events } = playWithEmptyDeck(LOOK_TOP_2.card.id);
    expect(events.some((e) => e.type === "cardPlayed")).toBe(true);
    expect(foundNothing(events)).toEqual([]);
  });

  it("'search the top 2 cards for a widget' that finds none logs searchFoundNothing", () => {
    // Two cards on top, neither a widget.
    const { events } = playFree(start(), deps, SEARCH_TOP_2.card.id);
    expect(foundNothing(events)).toEqual([{ type: "searchFoundNothing", playerId: P1, slot: "found" }]);
  });

  it("an unfiltered top 2 the effect marks a search (`search: true`) logs searchFoundNothing with nothing there", () => {
    const { events } = playWithEmptyDeck(SEARCH_TOP_2_ANY.card.id);
    expect(foundNothing(events)).toEqual([{ type: "searchFoundNothing", playerId: P1, slot: "found" }]);
  });

  it("'search the top 2 cards for a widget' with a widget on top logs nothing of the kind", () => {
    const { events } = playFree(withWidgetInDeck(), deps, SEARCH_TOP_2.card.id);
    expect(foundNothing(events)).toEqual([]);
  });
});
