/**
 * `TriggerEvent encounterCardDealt` (docs/phase7-wave9.md §3.12): "Response: After a player is dealt an encounter
 * card, …". One event per facedown encounter card dealt, carrying the player and what dealt it, recorded only when an
 * ability in the registry listens and announced between frames, so the cards one step or one effect dealt share one
 * response window (RRG 1.8 "Triggering Condition", p. 45).
 *
 * Sources: RRG 1.8 "Deal, Deal an Encounter Card" (p. 15); "Villain Phase" (p. 47) step three: "Deal one encounter
 * card to each player. Deal one additional card for each hazard icon on a card in play. These additional cards are
 * dealt in player order."; "Player Deck" (p. 33): a player whose deck ran out "deals themself one facedown encounter
 * card".
 *
 * Not heard, and pinned here as the engine's present reading rather than as a ruling: the surge keyword's card. RRG 1.8
 * "Surge" (p. 42) words it as "deals themself a facedown encounter card", while docs/phase7-wave9.md §3.45 reads a
 * surge as a reveal; the engine takes that card and reveals it in one step (`dealEncounterCardTo` with no source).
 *
 * Synthetic cards only: a witness that counts each deal it hears, and the things that deal.
 */

import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSideScheme, stubSupport, stubTreachery } from "./testing/fixtures.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  onTopOfEncounterDeck,
  P1,
  P2,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const n = (value: number) => ({ kind: "const", value }) as const;

const WITNESS_ID = "witness.response";
/** "Forced Response: After a player is dealt an encounter card, place 1 dealt counter here." */
const WITNESS_RESPONSE = stubAbility(WITNESS_ID, {
  trigger: { kind: "response", forced: true, on: { on: "encounterCardDealt" } },
  effects: [{ kind: "addCounters", target: { kind: "self" }, counterType: "dealt", amount: n(1) }],
});
const WITNESS = stubSupport({ id: "witness", cost: 0, abilities: [WITNESS_RESPONSE.ref] });
/** A side scheme printing a hazard icon. */
const LOOKOUT = stubSideScheme({ id: "lookout", startingThreat: 3, icons: ["hazard"], boostIcons: 0 });
/** "Surge." */
const RUSH = stubTreachery({ id: "rush", boostIcons: 0, keywords: [{ name: "surge" }] });
const GRUNT = stubMinion({ id: "grunt", atk: 1, sch: 1, hp: 3, boostIcons: 0 });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const event = (id: string, effects: readonly EffectSpec[], cost?: AbilityCost) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects, ...(cost ? { cost } : {}) });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
// "Deal yourself 1 facedown encounter card."
const DEAL = event("deal", [{ kind: "dealEncounterCard", player: you }]);
// "Deal each player 2 facedown encounter cards."
const DEAL_ALL = event("deal-all", [{ kind: "dealEncounterCard", player: { kind: "each" }, count: n(2) }]);
// "Deal yourself 1 facedown encounter card → draw 1 card."
const PAY = event("pay", [{ kind: "draw", player: you, amount: n(1) }], { dealEncounterCards: 1 });
// "Deal the Grunt to yourself as a facedown encounter card."
const TAKE_GRUNT = event("take-grunt", [
  { kind: "dealAsEncounterCard", cards: { kind: "each", query: { name: "grunt" } }, player: you },
]);
// "Draw 1 card."
const DRAW = event("draw", [{ kind: "draw", player: you, amount: n(1) }]);
const EVENTS = [DEAL, DEAL_ALL, PAY, TAKE_GRUNT, DRAW];

const HEARD: EngineDeps = depsOf(WITNESS_RESPONSE, ...EVENTS.map((e) => e.ability));
/** The same registry without the listener. */
const UNHEARD: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));

function start(deps: EngineDeps, players: 1 | 2 = 1): GameState {
  return gameAtFirstTurn({
    players,
    cards: [WITNESS, LOOKOUT, RUSH, GRUNT, FILLER, ...EVENTS.map((e) => e.card)],
    deps,
    deck: [WITNESS.id, ...EVENTS.map((e) => e.card.id)],
    encounter: [...copiesOf(FILLER.id, 26), LOOKOUT.id, RUSH.id, GRUNT.id],
  });
}

/** A game with P1's witness in play. */
function table(players: 1 | 2 = 1): { readonly state: GameState; readonly witness: InstanceId } {
  const witness = playerCardIntoPlay(start(HEARD, players), WITNESS.id);
  return { state: witness.state, witness: witness.id };
}

/** Every player ends their turn: the villain phase runs through to the next round. */
const playRound = (state: GameState, deps: EngineDeps) =>
  runCommands(state, deps, ...state.players.map((p) => ({ type: "endTurn" as const, playerId: p.playerId })));

/** Each `encounterCardDealt` announced, in order: the player and the source. (An announcement is logged once, as resolved.) */
const deals = (events: readonly GameEvent[]): readonly (readonly [PlayerId, string])[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "encounterCardDealt"
      ? [[e.event.playerId, e.event.source] as const]
      : [],
  );
/** The response windows opened for a deal. */
const windows = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "windowOpened" && e.event.kind === "encounterCardDealt").length;
const counted = (state: GameState, witness: InstanceId) => mustInstance(state, witness).counters.dealt ?? 0;
const moved = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "cardMoved" && e.to.kind === "dealtEncounter").length;
function expectReplays(session: GameSession, deps: EngineDeps) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("encounterCardDealt: after a player is dealt an encounter card", () => {
  it("solo, step three: 1 card, 1 event, 1 window", () => {
    const t = table();
    const { state, events, session } = playRound(t.state, HEARD);
    expect(deals(events)).toEqual([[P1, "villainPhase"]]);
    expect(windows(events)).toBe(1);
    expect(counted(state, t.witness)).toBe(1);
    expect(state.pendingEncounterDealt).toBeUndefined();
    expectReplays(session, HEARD);
  });

  it("two players, step three: 1 event per player in player order, sharing 1 window", () => {
    const t = table(2);
    const { state, events, session } = playRound(t.state, HEARD);
    expect(deals(events)).toEqual([
      [P1, "villainPhase"],
      [P2, "villainPhase"],
    ]);
    expect(windows(events)).toBe(1);
    expect(counted(state, t.witness)).toBe(2);
    expectReplays(session, HEARD);
  });

  it("the window opens after every card of the step is dealt and before any is revealed", () => {
    const t = table(2);
    const { events } = playRound(t.state, HEARD);
    const at = (match: (e: GameEvent) => boolean) => events.findIndex(match);
    const lastDeal = events.findLastIndex((e) => e.type === "cardMoved" && e.to.kind === "dealtEncounter");
    const window = at((e) => e.type === "windowOpened" && e.event.kind === "encounterCardDealt");
    const firstReveal = at((e) => e.type === "encounterCardRevealed");
    expect(lastDeal).toBeGreaterThan(-1);
    expect(window).toBeGreaterThan(lastDeal);
    expect(firstReveal).toBeGreaterThan(window);
  });

  it("a hazard icon in play: the additional card is its own event, in the same window", () => {
    const t = table(2);
    const lookout = encounterCardInVillainArea(t.state, LOOKOUT.id, 3);
    const { state, events } = playRound(lookout.state, HEARD);
    expect(deals(events)).toEqual([
      [P1, "villainPhase"],
      [P2, "villainPhase"],
      [P1, "hazard"],
    ]);
    expect(windows(events)).toBe(1);
    expect(counted(state, t.witness)).toBe(3);
  });

  it("a card effect's deal in the player phase: 1 event at once, and step three's is another", () => {
    const t = table();
    const played = playFree(t.state, HEARD, DEAL.card.id);
    expect(deals(played.events)).toEqual([[P1, "ability"]]);
    expect(windows(played.events)).toBe(1);
    expect(counted(played.state, t.witness)).toBe(1);
    expect(mustPlayer(played.state, P1).dealtEncounter).toHaveLength(1);

    const round = playRound(played.state, HEARD);
    expect(deals(round.events)).toEqual([[P1, "villainPhase"]]);
    expect(counted(round.state, t.witness)).toBe(2);
  });

  it("one effect dealing 2 cards to each of 2 players: 4 events, 1 window", () => {
    const t = table(2);
    const { state, events, session } = playFree(t.state, HEARD, DEAL_ALL.card.id);
    expect(deals(events).map(([, source]) => source)).toEqual(["ability", "ability", "ability", "ability"]);
    expect(
      deals(events)
        .map(([player]) => player)
        .sort(),
    ).toEqual([P1, P1, P2, P2]);
    expect(windows(events)).toBe(1);
    expect(counted(state, t.witness)).toBe(4);
    expectReplays(session, HEARD);
  });

  it("a deal paid as a cost is a deal", () => {
    const t = table();
    const { state, events } = playFree(t.state, HEARD, PAY.card.id);
    expect(deals(events)).toEqual([[P1, "ability"]]);
    expect(counted(state, t.witness)).toBe(1);
  });

  it("a card in play dealt to a player as a facedown encounter card is a deal", () => {
    const t = table();
    const grunt = minionEngagedWith(t.state, GRUNT.id);
    const { state, events } = playFree(grunt.state, HEARD, TAKE_GRUNT.card.id);
    expect(deals(events)).toEqual([[P1, "ability"]]);
    expect(mustPlayer(state, P1).dealtEncounter).toEqual([grunt.id]);
    expect(counted(state, t.witness)).toBe(1);
  });

  it("a player deck that runs out deals its player a card: 1 event", () => {
    const t = table();
    // Surgery: 1 card left in P1's deck, the rest in the discard pile, so drawing it resets the deck.
    const seat = mustPlayer(t.state, P1);
    const [last, ...rest] = seat.deck;
    const thin: GameState = {
      ...t.state,
      players: t.state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: [last!], discard: [...p.discard, ...rest] } : p,
      ),
    };
    const { state, events } = playFree(thin, HEARD, DRAW.card.id);
    expect(events.some((e) => e.type === "playerDeckReset" && e.playerId === P1)).toBe(true);
    expect(deals(events)).toEqual([[P1, "deckReset"]]);
    expect(counted(state, t.witness)).toBe(1);
  });

  it("the surge keyword's card is revealed, not announced as a deal (see the file comment)", () => {
    const t = table();
    // A filler on top for the villain's boost card, then the surge card for step three.
    const stacked = onTopOfEncounterDeck(onTopOfEncounterDeck(t.state, RUSH.id), FILLER.id);
    const { state, events } = playRound(stacked, HEARD);
    expect(events.some((e) => e.type === "surgeTriggered")).toBe(true);
    // Two cards reached P1's dealt cards (step three's and the surge's); only step three's was heard.
    expect(moved(events)).toBe(2);
    expect(deals(events)).toEqual([[P1, "villainPhase"]]);
    expect(counted(state, t.witness)).toBe(1);
  });

  it("a listener in the registry but not in play: nothing announced, no window, nothing left pending", () => {
    const { state, events } = playRound(start(HEARD, 2), HEARD);
    expect(deals(events)).toEqual([]);
    expect(windows(events)).toBe(0);
    expect(moved(events)).toBe(2);
    expect("pendingEncounterDealt" in state).toBe(false);
  });

  it("no listener in the registry: the same log and state as with one out of play, and nothing recorded", () => {
    const unheard = playRound(start(UNHEARD, 2), UNHEARD);
    const heard = playRound(start(HEARD, 2), HEARD);
    expect(unheard.events).toEqual(heard.events);
    expect(unheard.state).toEqual(heard.state);
    expect(unheard.events.some((e) => e.type === "triggerEvent" && e.event.kind === "encounterCardDealt")).toBe(false);
    expect("pendingEncounterDealt" in unheard.state).toBe(false);
    expectReplays(unheard.session, UNHEARD);

    const dealt = playFree(start(UNHEARD), UNHEARD, DEAL.card.id);
    expect(windows(dealt.events)).toBe(0);
    expect("pendingEncounterDealt" in dealt.state).toBe(false);
    expect(mustPlayer(dealt.state, P1).dealtEncounter).toHaveLength(1);
  });
});
