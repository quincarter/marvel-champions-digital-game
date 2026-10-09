/**
 * `faceVisible` (`visibility.ts`): the two rules the client had forked (code review, Piece 12) now live here, and
 * neither opens anything that must stay closed.
 *
 * Sources: RRG 1.8 "Event" (p. 19: a played event is out of play while it resolves); "Look, Looked-At" (p. 27: "only
 * the player who is resolving the ability can look at those cards"); "Set Aside" (p. 39); "Boost" (p. 11: boost cards
 * are dealt facedown); "Encounter Deck" (p. 17).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { PendingChoice } from "./choices.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeEncounterDeck, locateCard, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf } from "./testing/abilities.js";
import { gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";
import { faceHidden, faceVisible, zoneHidden } from "./visibility.js";

const deps: EngineDeps = depsOf();
const start = (): GameState => gameAtFirstTurn({ players: 2, cards: [], deps });

/** Every way of asking: nobody named, the table, and each player. */
const eyes = (state: GameState, id: InstanceId) => ({
  none: faceVisible(state, id),
  table: faceVisible(state, id, { deps }),
  p1: faceVisible(state, id, { viewer: P1, deps }),
  p2: faceVisible(state, id, { viewer: P2, deps }),
});
const all = (value: boolean) => ({ none: value, table: value, p1: value, p2: value });

/** The top card of the encounter deck, taken out of it (facedown, as it was). */
function offDeck(state: GameState): { state: GameState; id: InstanceId } {
  const piles = activeEncounterDeck(state);
  const id = piles.deck[0]!;
  const deckId = state.encounterDeckOrder.find((key) => state.encounterDecks[key]?.deck.includes(id))!;
  expect(mustInstance(state, id).faceup).toBe(false);
  return {
    id,
    state: { ...state, encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.slice(1) } } },
  };
}
const withPlayer = (
  state: GameState,
  playerId: PlayerId,
  change: Partial<GameState["players"][number]>,
): GameState => ({
  ...state,
  players: state.players.map((p) => (p.playerId === playerId ? { ...p, ...change } : p)),
});
/** A decision open for `playerId` that offers `id`. */
const offering = (state: GameState, playerId: PlayerId, id: InstanceId): GameState => ({
  ...state,
  pendingChoice: {
    choiceId: "choice-test",
    playerId,
    prompt: { kind: "chooseCards", slot: "picked" },
    minSelections: 1,
    maxSelections: 1,
    options: [{ optionId: id, label: "a card", ref: { kind: "card", instanceId: id } }],
    frameId: null,
    ordered: false,
  } as unknown as PendingChoice,
});

describe("faceVisible: a card being played", () => {
  it("is visible to every viewer in its player's resolving area, though its faceup flag is not set", () => {
    const state = start();
    const id = mustPlayer(state, P1).hand[0]!;
    const playing = withPlayer(state, P1, { hand: mustPlayer(state, P1).hand.slice(1), resolving: [id] });
    expect(locateCard(playing, id)).toEqual({ kind: "resolving", playerId: P1 });
    expect(mustInstance(playing, id).faceup).toBe(false);
    expect(eyes(playing, id)).toEqual(all(true));
    // Not a facedown card about to be revealed, so an outcome preview does not stop at it.
    expect(faceHidden(playing, id)).toBe(false);
  });
});

describe("faceVisible: a set-aside card an open decision offers", () => {
  it("the scenario's set-aside area: visible to the player deciding and to the table, not to another named viewer", () => {
    const taken = offDeck(start());
    const aside: GameState = { ...taken.state, encounterSetAside: [...taken.state.encounterSetAside, taken.id] };
    expect(locateCard(aside, taken.id)).toEqual({ kind: "encounterSetAside" });
    // Set aside and not offered: closed to everyone.
    expect(eyes(aside, taken.id)).toEqual(all(false));
    expect(faceHidden(aside, taken.id)).toBe(true);

    expect(eyes(offering(aside, P1, taken.id), taken.id)).toEqual({ none: true, table: true, p1: true, p2: false });
    expect(eyes(offering(aside, P2, taken.id), taken.id)).toEqual({ none: true, table: true, p1: false, p2: true });
    expect(faceHidden(offering(aside, P1, taken.id), taken.id)).toBe(false);
    // A decision that offers another card opens nothing here.
    const other = mustPlayer(aside, P1).hand[0]!;
    expect(eyes(offering(aside, P1, other), taken.id)).toEqual(all(false));
  });

  it("a player's own set-aside area: the same", () => {
    const taken = offDeck(start());
    const aside = withPlayer(taken.state, P2, { setAside: [...mustPlayer(taken.state, P2).setAside, taken.id] });
    expect(locateCard(aside, taken.id)).toEqual({ kind: "setAside", playerId: P2 });
    expect(eyes(aside, taken.id)).toEqual(all(false));
    expect(eyes(offering(aside, P1, taken.id), taken.id)).toEqual({ none: true, table: true, p1: true, p2: false });
  });
});

describe("faceVisible: what stays closed", () => {
  it("an encounter deck card that no decision offers", () => {
    const state = start();
    const [top, second] = activeEncounterDeck(state).deck;
    expect(eyes(state, top!)).toEqual(all(false));
    expect(zoneHidden(state, top!, { deps })).toBe(true);
    // Offering the top card does not open the one beneath it.
    expect(eyes(offering(state, P1, top!), second!)).toEqual(all(false));
  });

  it("a facedown encounter card dealt to a player, even while a decision names it", () => {
    const taken = offDeck(start());
    const dealt = withPlayer(taken.state, P2, { dealtEncounter: [taken.id] });
    expect(locateCard(dealt, taken.id)).toEqual({ kind: "dealtEncounter", playerId: P2 });
    expect(eyes(dealt, taken.id)).toEqual(all(false));
    expect(eyes(offering(dealt, P2, taken.id), taken.id)).toEqual(all(false));
  });

  it("a facedown boost card, even while a decision names it", () => {
    const taken = offDeck(start());
    const villain = taken.state.villains[0]!.instanceId;
    const boosted: GameState = {
      ...taken.state,
      instances: {
        ...taken.state.instances,
        [villain]: { ...mustInstance(taken.state, villain), boostCards: [taken.id] },
      },
    };
    expect(locateCard(boosted, taken.id)).toEqual({ kind: "boost", hostInstanceId: villain });
    expect(eyes(boosted, taken.id)).toEqual(all(false));
    expect(eyes(offering(boosted, P1, taken.id), taken.id)).toEqual(all(false));
  });

  it("a facedown card in play that a decision offers (an attack target) is not turned over", () => {
    const taken = offDeck(start());
    const inPlay: GameState = { ...taken.state, villainArea: [...taken.state.villainArea, taken.id] };
    expect(eyes(offering(inPlay, P1, taken.id), taken.id)).toEqual(all(false));
  });

  it("the top of a player's deck with no rule showing it", () => {
    const state = start();
    expect(eyes(state, mustPlayer(state, P2).deck[0]!)).toEqual(all(false));
  });
});
