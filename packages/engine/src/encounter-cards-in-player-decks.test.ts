/**
 * docs/phase7-wave5.md §3.5: encounter cards in a player's deck, hand and discard pile. Synthetic cards shaped like
 * Mysterio II (`sm` 27085: "shuffle the top card of the encounter deck into each player's deck"), Maze of Mirrors / Edge
 * of Reality 1B/2B (27087b, 27088b: "Forced Interrupt: When you would draw or discard an encounter card from your deck,
 * deal it to yourself as a facedown encounter card → draw 1 card") and Mysterio I–III (27084–27086: "Forced Response:
 * After you resolve a boost card during Mysterio's activation, place that card on the top of your deck").
 *
 * Sources: MC27 p. 13 "Encounter Cards in Your Player Deck" (facedown in a deck, faceup in a discard pile) and its FAQ
 * on p. 21 ("If multiple cards are drawn due to a game step or card ability, those cards are drawn simultaneously.
 * Afterward, deal each encounter card drawn during that process to yourself as a facedown encounter card").
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1, playFree } from "./testing/wave3.js";

const PHANTOM = stubTreachery({ id: "phantom", boostIcons: 0 });

const MAZE_INTERRUPT = stubAbility("maze.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "encounterCardFromPlayerDeck" } },
  effects: [
    { kind: "dealAsEncounterCard", cards: { kind: "eventTarget" }, player: { kind: "eventPlayer" } },
    { kind: "draw", player: { kind: "eventPlayer" }, amount: { kind: "const", value: 1 } },
  ],
});
const MAZE = stubMainScheme({
  id: "maze",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), abilities: [MAZE_INTERRUPT.ref] }],
});
const QUIET_SCHEME = stubMainScheme({
  id: "quiet",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const BOUND_BY_FEAR = stubAbility("bound.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "boostCardResolved", selfIs: "source" } },
  effects: [
    {
      kind: "moveCards",
      cards: { kind: "ref", ref: { kind: "eventTarget" } },
      to: "deckTop",
      into: { kind: "eventPlayer" },
    },
  ],
});
const MYSTERIO = stubVillain({
  id: "mysterio",
  stages: [{ hp: flat(30), atk: 0, sch: 0, abilities: [BOUND_BY_FEAR.ref] }],
});

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const encounterTop = (n: number) => ({ kind: "encounter", zones: ["deck"], top: { kind: "const", value: n } }) as const;
const SHUFFLE_IN = event("shuffle-in", [
  { kind: "moveCards", cards: encounterTop(1), to: "deckShuffle", into: { kind: "controller" } },
]);
const ON_TOP = event("on-top", [
  { kind: "moveCards", cards: encounterTop(2), to: "deckTop", into: { kind: "controller" } },
]);
const TO_DISCARD = event("to-discard", [
  { kind: "moveCards", cards: encounterTop(1), to: "discard", into: { kind: "controller" } },
]);
const DRAW_TWO = event("draw-two", [
  { kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 2 } },
]);
const MILL_ONE = event("mill-one", [
  {
    kind: "moveCards",
    cards: { kind: "zone", zone: "deck", player: { kind: "controller" }, top: { kind: "const", value: 1 } },
    to: "discard",
  },
]);
const EVENTS = [SHUFFLE_IN, ON_TOP, TO_DISCARD, DRAW_TWO, MILL_ONE];

const depsWith = (...extra: readonly StubAbility[]): EngineDeps => depsOf(...extra, ...EVENTS.map((e) => e.ability));

function start(mainScheme: typeof MAZE, deps: EngineDeps, villain = MYSTERIO): GameState {
  return gameAtFirstTurn({
    cards: [PHANTOM, ...EVENTS.map((e) => e.card)],
    deps,
    villain,
    mainScheme,
    encounter: copiesOf(PHANTOM.id, 20),
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
  });
}

const phantomsIn = (state: GameState, ids: readonly InstanceId[]): readonly InstanceId[] =>
  ids.filter((id) => mustInstance(state, id).cardId === PHANTOM.id);

describe("§3.5 an encounter card moved into a player's zones", () => {
  const deps = depsWith();

  it("is shuffled facedown into the deck, unowned", () => {
    const state = playFree(start(QUIET_SCHEME, deps), deps, SHUFFLE_IN.card.id).state;
    const [id] = phantomsIn(state, mustPlayer(state, P1).deck);
    expect(id).toBeDefined();
    expect(mustInstance(state, id!)).toMatchObject({ ownerId: null, faceup: false });
  });

  it("is faceup in a discard pile, unowned", () => {
    const state = playFree(start(QUIET_SCHEME, deps), deps, TO_DISCARD.card.id).state;
    const [id] = phantomsIn(state, mustPlayer(state, P1).discard);
    expect(id).toBeDefined();
    expect(mustInstance(state, id!)).toMatchObject({ ownerId: null, faceup: true });
  });

  it("drawn with nothing listening, it is dealt facedown and replaced by a draw (§4.1 Q4)", () => {
    // Before §4.1 Q4 it stayed in the hand; the fallback is covered in encounter-card-drawn-fallback.test.ts.
    const onTop = playFree(start(QUIET_SCHEME, deps), deps, ON_TOP.card.id).state;
    const drawn = playFree(onTop, deps, DRAW_TWO.card.id).state;
    expect(phantomsIn(drawn, mustPlayer(drawn, P1).hand)).toHaveLength(0);
    expect(phantomsIn(drawn, mustPlayer(drawn, P1).dealtEncounter)).toHaveLength(2);
    expect(drawn.pendingEncounterFromDeck).toBeUndefined();
  });
});

describe("§3.5 'When you would draw or discard an encounter card from your deck'", () => {
  const deps = depsWith(MAZE_INTERRUPT);

  it("deals each card of one draw after the whole draw, and each replacement is drawn; replay deep-equal", () => {
    const onTop = playFree(start(MAZE, deps), deps, ON_TOP.card.id).state;
    const handBefore = mustPlayer(onTop, P1).hand.length;
    const { state, session, events } = playFree(onTop, deps, DRAW_TWO.card.id);
    const seat = mustPlayer(state, P1);
    expect(phantomsIn(state, seat.dealtEncounter)).toHaveLength(2);
    expect(phantomsIn(state, seat.hand)).toHaveLength(0);
    // +1 given and played, +2 drawn, -2 dealt, +2 drawn instead.
    expect(seat.hand.length).toBe(handBefore + 2);
    const drawnIds = events.flatMap((e) => (e.type === "cardDrawn" ? [e.instanceId] : []));
    const firstDeal = events.findIndex((e) => e.type === "cardMoved" && e.to.kind === "dealtEncounter");
    const secondDraw = events.findIndex((e) => e.type === "cardDrawn" && e.instanceId === drawnIds[1]);
    expect(secondDraw).toBeLessThan(firstDeal);
    expect(drawnIds).toHaveLength(4);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("hears a discard from the deck, and again the draw that replaces it", () => {
    const onTop = playFree(start(MAZE, deps), deps, ON_TOP.card.id).state;
    const milled = playFree(onTop, deps, MILL_ONE.card.id).state;
    const seat = mustPlayer(milled, P1);
    // The milled card is dealt; its "draw 1 card" draws the second, which is dealt in turn.
    expect(phantomsIn(milled, seat.dealtEncounter)).toHaveLength(2);
    expect(phantomsIn(milled, [...seat.hand, ...seat.discard])).toHaveLength(0);
  });
});

describe("§3.5 'After you resolve a boost card during Mysterio's activation'", () => {
  it("moves the boost card before the activation discards it", () => {
    const deps = depsWith(BOUND_BY_FEAR);
    const state = start(QUIET_SCHEME, deps);
    const step = state.step;
    if (step.kind !== "turn") throw new Error(step.kind);
    const { session } = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: step.activePlayerId }]);
    const after = session.state;
    const deck = mustPlayer(after, P1).deck;
    const [top] = deck;
    expect(mustInstance(after, top!)).toMatchObject({ cardId: PHANTOM.id, ownerId: null, faceup: false });
    expect(phantomsIn(after, deck)).toHaveLength(1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
