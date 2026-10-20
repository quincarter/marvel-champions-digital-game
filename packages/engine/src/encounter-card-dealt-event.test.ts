/**
 * `GameEvent encounterCardDealt` (issue #287): the client-facing record of a facedown encounter card dealt to a player
 * and what dealt it (`EncounterDealSource`), logged on every deal right after the `cardMoved` into the player's dealt
 * cards, whether or not an ability listens for `TriggerEvent encounterCardDealt`.
 *
 * Sources: RRG 1.8 "Deal, Deal an Encounter Card" (p. 15); "Villain Phase" (p. 47) step three, with one additional card
 * per hazard icon; "Player Deck" (p. 33), a player whose deck ran out "deals themself one facedown encounter card".
 * Not a deal: "reveal the top card of the encounter deck" (RRG 1.8 "Reveal", p. 38) logs none.
 *
 * Synthetic cards only, with no listener in the registry.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubIdentity, stubObligation, stubSideScheme, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playFree } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const n = (value: number) => ({ kind: "const", value }) as const;

/** A side scheme printing a hazard icon. */
const LOOKOUT = stubSideScheme({ id: "lookout", startingThreat: 3, icons: ["hazard"], boostIcons: 0 });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
/** A hero not in the game, and its obligation: revealed, it cannot be given, so another card is revealed at once. */
const ABSENT = stubIdentity({
  id: "absent",
  hp: 10,
  atk: 1,
  thw: 1,
  def: 1,
  rec: 1,
  heroHandSize: 5,
  alterEgoHandSize: 5,
});
const ORPHAN = stubObligation({ id: "absent-obligation", boostIcons: 0 });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
// "Draw 1 card."
const DRAW = event("draw", [{ kind: "draw", player: you, amount: n(1) }]);
// "Reveal the top card of the encounter deck."
const REVEAL_TOP = event("reveal-top", [{ kind: "revealEncounterCard", player: you }]);
const EVENTS = [DRAW, REVEAL_TOP];

const DEPS: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));

function start(players: 1 | 2 = 1): GameState {
  return gameAtFirstTurn({
    players,
    cards: [LOOKOUT, FILLER, ABSENT, ORPHAN, ...EVENTS.map((e) => e.card)],
    deps: DEPS,
    deck: EVENTS.map((e) => e.card.id),
    encounter: [...copiesOf(FILLER.id, 26), LOOKOUT.id, ORPHAN.id],
  });
}

/** Every player ends their turn: the villain phase runs through to the next round. */
const playRound = (state: GameState) =>
  runCommands(state, DEPS, ...state.players.map((p) => ({ type: "endTurn" as const, playerId: p.playerId })));

/** The encounter deck with a card of each of `codes` on top, the first of them topmost (test surgery). */
function stacked(state: GameState, ...codes: readonly string[]): GameState {
  const [deckId, piles] = Object.entries(state.encounterDecks)[0]!;
  const rest = [...piles.deck];
  const top = codes.map((code) => {
    const at = rest.findIndex((id) => mustInstance(state, id).cardId === code);
    if (at < 0) throw new Error(`no ${code} left in the encounter deck`);
    return rest.splice(at, 1)[0]!;
  });
  return { ...state, encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: [...top, ...rest] } } };
}

/** Each `encounterCardDealt` logged, in order: the player and the source. */
const dealt = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "encounterCardDealt" ? [[e.playerId, e.source] as const] : []));

/** Each `encounterCardDealt` sits right after the `cardMoved` that put its card in that player's dealt cards. */
function expectEachFollowsItsMove(events: readonly GameEvent[]) {
  events.forEach((e, index) => {
    if (e.type !== "encounterCardDealt") return;
    const before = events[index - 1];
    expect(before).toMatchObject({
      type: "cardMoved",
      instanceId: e.instanceId,
      to: { kind: "dealtEncounter", playerId: e.playerId },
    });
  });
}

describe("GameEvent encounterCardDealt: a facedown encounter card dealt to a player, and why", () => {
  it("villain phase step three: one per player, source villainPhase, with no listener in the registry", () => {
    const { events, session } = playRound(start(2));
    expect(dealt(events)).toEqual([
      [P1, "villainPhase"],
      [P2, "villainPhase"],
    ]);
    expectEachFollowsItsMove(events);
    const replayed = replay(session.log, DEPS);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a hazard icon in play: the additional card's source is hazard", () => {
    const lookout = encounterCardInVillainArea(start(2), LOOKOUT.id, 3);
    const { events } = playRound(lookout.state);
    expect(dealt(events)).toEqual([
      [P1, "villainPhase"],
      [P2, "villainPhase"],
      [P1, "hazard"],
    ]);
    expectEachFollowsItsMove(events);
  });

  it("a player deck that runs out: its player's card's source is deckReset", () => {
    const state = start();
    // Surgery: 1 card left in P1's deck, the rest in the discard pile, so drawing it resets the deck.
    const [last, ...rest] = mustPlayer(state, P1).deck;
    const thin: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: [last!], discard: [...p.discard, ...rest] } : p,
      ),
    };
    const { events } = playFree(thin, DEPS, DRAW.card.id);
    expect(events.some((e) => e.type === "playerDeckReset" && e.playerId === P1)).toBe(true);
    expect(dealt(events)).toEqual([[P1, "deckReset"]]);
    expectEachFollowsItsMove(events);
  });

  it("an obligation that cannot be given: the card revealed in its place is not dealt, so none is logged for it", () => {
    // A filler on top for the villain's boost card, then the obligation for step three, then its replacement.
    const { events, state } = playRound(stacked(start(), FILLER.id, ORPHAN.id, FILLER.id));
    expect(state.removedFromGame.some((id) => mustInstance(state, id).cardId === ORPHAN.id)).toBe(true);
    // Both cards passed through P1's dealt cards; only step three's was a deal.
    expect(events.filter((e) => e.type === "cardMoved" && e.to.kind === "dealtEncounter")).toHaveLength(2);
    expect(dealt(events)).toEqual([[P1, "villainPhase"]]);
    expectEachFollowsItsMove(events);
  });

  it("revealing the top encounter card is not a deal: none logged", () => {
    const { events } = playFree(start(), DEPS, REVEAL_TOP.card.id);
    expect(events.some((e) => e.type === "encounterCardRevealed")).toBe(true);
    expect(dealt(events)).toEqual([]);
  });
});
