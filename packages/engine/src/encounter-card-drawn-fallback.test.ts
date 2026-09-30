/**
 * docs/phase7-wave5.md §4.1 Q4 (maintainer ruling): an encounter card drawn or discarded from a player's deck that
 * nothing replaces is dealt to that player as a facedown encounter card, and they draw 1 card. It is the handling Maze
 * of Mirrors / Edge of Reality 1B/2B print (`sm` 27087b, 27088b: "Forced Interrupt: When you would draw or discard an
 * encounter card from your deck, deal it to yourself as a facedown encounter card → draw 1 card."), used as the engine's
 * fallback. Before the ruling (§3.5's default) such a card stayed in the hand.
 *
 * Sources: MC27 p. 13 "Encounter Cards in Your Player Deck" and its p. 21 FAQ (every card of one draw is drawn before
 * any is dealt); RRG 1.8 "Ability" (pp. 4-5: only player card abilities are barred during setup, so an encounter
 * card's forced interrupt resolves at the opening draw, and the fallback does too).
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeckId, handSize, mustInstance, mustPlayer } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, giveCard, HERO } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playFree } from "./testing/wave3.js";

const PHANTOM = stubTreachery({ id: "phantom", boostIcons: 0 });

const MAZE_INTERRUPT = stubAbility("maze.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "encounterCardFromPlayerDeck" } },
  effects: [
    { kind: "dealAsEncounterCard", cards: { kind: "eventTarget" }, player: { kind: "eventPlayer" } },
    { kind: "draw", player: { kind: "eventPlayer" }, amount: { kind: "const", value: 1 } },
  ],
});
/** Hears the event but leaves the card where it is: the fallback still deals it. */
const BYSTANDER_INTERRUPT = stubAbility("bystander.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "encounterCardFromPlayerDeck" } },
  effects: [{ kind: "draw", player: { kind: "eventPlayer" }, amount: { kind: "const", value: 1 } }],
});
const scheme = (id: string, abilities: readonly StubAbility[] = []) =>
  stubMainScheme({
    id,
    stages: [
      {
        startingThreat: flat(0),
        targetThreat: flat(99),
        acceleration: flat(0),
        abilities: abilities.map((a) => a.ref),
      },
    ],
  });
const QUIET = scheme("quiet");
const MAZE = scheme("maze", [MAZE_INTERRUPT]);
const BYSTANDER = scheme("bystander", [BYSTANDER_INTERRUPT]);
const VILLAIN = stubVillain({ id: "illusionist", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const encounterTop = (n: number) => ({ kind: "encounter", zones: ["deck"], top: { kind: "const", value: n } }) as const;
const ON_TOP = event("on-top", [
  { kind: "moveCards", cards: encounterTop(2), to: "deckTop", into: { kind: "controller" } },
]);
const draw = (n: number): EffectSpec => ({
  kind: "draw",
  player: { kind: "controller" },
  amount: { kind: "const", value: n },
});
const DRAW_ONE = event("draw-one", [draw(1)]);
const DRAW_TWO = event("draw-two", [draw(2)]);
const MILL_ONE = event("mill-one", [
  {
    kind: "moveCards",
    cards: { kind: "zone", zone: "deck", player: { kind: "controller" }, top: { kind: "const", value: 1 } },
    to: "discard",
  },
]);
const EVENTS = [ON_TOP, DRAW_ONE, DRAW_TWO, MILL_ONE];
const CARDS = [PHANTOM, VILLAIN, QUIET, MAZE, BYSTANDER, ...EVENTS.map((e) => e.card)];

const depsWith = (...extra: readonly StubAbility[]): EngineDeps => depsOf(...extra, ...EVENTS.map((e) => e.ability));

function start(mainScheme: typeof QUIET, deps: EngineDeps): GameState {
  return gameAtFirstTurn({
    cards: [PHANTOM, ...EVENTS.map((e) => e.card)],
    deps,
    villain: VILLAIN,
    mainScheme,
    encounter: copiesOf(PHANTOM.id, 20),
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
  });
}

/** Two phantoms from the encounter deck on top of P1's deck (through a played event, so no surgery). */
const withTwoOnTop = (mainScheme: typeof QUIET, deps: EngineDeps): GameState =>
  playFree(start(mainScheme, deps), deps, ON_TOP.card.id).state;

/** P1's hand size once `card` is handed to them and played, before the event draws anything. */
const handBeforePlaying = (state: GameState, card: typeof DRAW_ONE.card.id): number =>
  mustPlayer(giveCard(state, P1, card).state, P1).hand.length - 1;
const phantomsIn = (state: GameState, ids: readonly InstanceId[]): readonly InstanceId[] =>
  ids.filter((id) => mustInstance(state, id).cardId === PHANTOM.id);
const drawnIds = (events: readonly GameEvent[]): readonly InstanceId[] =>
  events.flatMap((e) => (e.type === "cardDrawn" ? [e.instanceId] : []));
const dealtIds = (events: readonly GameEvent[]): readonly InstanceId[] =>
  events.flatMap((e) => (e.type === "cardMoved" && e.to.kind === "dealtEncounter" ? [e.instanceId] : []));

function expectReplays(session: GameSession, deps: EngineDeps): void {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("§4.1 Q4 an encounter card drawn from a player's deck with nothing listening", () => {
  const deps = depsWith();

  it("is dealt facedown to that player, who draws 1 card instead; replay deep-equal", () => {
    const onTop = withTwoOnTop(QUIET, deps);
    const [first] = mustPlayer(onTop, P1).deck;
    const handBefore = handBeforePlaying(onTop, DRAW_ONE.card.id);
    const { state, session, events } = playFree(onTop, deps, DRAW_ONE.card.id);
    const seat = mustPlayer(state, P1);
    expect(seat.dealtEncounter).toContain(first);
    expect(mustInstance(state, first!)).toMatchObject({ ownerId: null, faceup: false });
    expect(phantomsIn(state, seat.hand)).toHaveLength(0);
    // The event was announced (initiated and resolved), with no interrupt window.
    const logged = events.filter((e) => e.type === "triggerEvent" && e.event.kind === "encounterCardFromPlayerDeck");
    expect(logged.map((e) => (e.type === "triggerEvent" ? e.phase : null))).toContain("resolved");
    // +1 given and played; the second phantom is found by the replacement draw and dealt in turn, and its own
    // replacement draw finds a player card: one card in hand from the "draw 1".
    expect(dealtIds(events)).toHaveLength(2);
    expect(drawnIds(events)).toHaveLength(3);
    expect(seat.hand.length).toBe(handBefore + 1);
    expect(state.pendingEncounterFromDeck).toBeUndefined();
    expectReplays(session, deps);
  });

  it("draws every card of a two-card draw before dealing either", () => {
    const onTop = withTwoOnTop(QUIET, deps);
    const handBefore = handBeforePlaying(onTop, DRAW_TWO.card.id);
    const { state, session, events } = playFree(onTop, deps, DRAW_TWO.card.id);
    const seat = mustPlayer(state, P1);
    expect(phantomsIn(state, seat.dealtEncounter)).toHaveLength(2);
    expect(phantomsIn(state, seat.hand)).toHaveLength(0);
    const firstDeal = events.findIndex((e) => e.type === "cardMoved" && e.to.kind === "dealtEncounter");
    const secondDraw = events.findIndex((e) => e.type === "cardDrawn" && e.instanceId === drawnIds(events)[1]);
    expect(secondDraw).toBeLessThan(firstDeal);
    expect(drawnIds(events)).toHaveLength(4);
    expect(seat.hand.length).toBe(handBefore + 2);
    expectReplays(session, deps);
  });

  it("discarded from the deck, it is dealt the same way and a card is drawn", () => {
    const onTop = withTwoOnTop(QUIET, deps);
    const [first, second] = mustPlayer(onTop, P1).deck;
    const handBefore = handBeforePlaying(onTop, MILL_ONE.card.id);
    const { state, session, events } = playFree(onTop, deps, MILL_ONE.card.id);
    const seat = mustPlayer(state, P1);
    // The milled phantom is dealt; its "draw 1 card" draws the second, which is dealt in turn.
    expect(dealtIds(events)).toEqual([first, second]);
    expect(phantomsIn(state, [...seat.hand, ...seat.discard])).toHaveLength(0);
    expect(state.encounterDecks[activeEncounterDeckId(state)]!.discard).not.toContain(first);
    expect(seat.hand.length).toBe(handBefore + 1);
    expectReplays(session, deps);
  });

  it("drawn by the end-of-phase draw, it is dealt and the hand still ends at hand size", () => {
    const onTop = withTwoOnTop(QUIET, deps);
    const [first, second] = mustPlayer(onTop, P1).deck;
    const { session, events } = driveSession(startSession(onTop), deps, [{ type: "endTurn", playerId: P1 }]);
    expect(dealtIds(events)).toEqual(expect.arrayContaining([first, second]));
    const seat = mustPlayer(session.state, P1);
    expect(phantomsIn(session.state, seat.hand)).toHaveLength(0);
    expect(seat.hand.length).toBe(handSize(session.state, P1, deps));
    expectReplays(session, deps);
  });
});

describe("§4.1 Q4 with a listener", () => {
  it("the printed interrupt handles each card once and the fallback does nothing", () => {
    const deps = depsWith(MAZE_INTERRUPT);
    const onTop = withTwoOnTop(MAZE, deps);
    const handBefore = handBeforePlaying(onTop, DRAW_TWO.card.id);
    const { state, session, events } = playFree(onTop, deps, DRAW_TWO.card.id);
    const seat = mustPlayer(state, P1);
    expect(phantomsIn(state, seat.dealtEncounter)).toHaveLength(2);
    // Two drawn, two dealt, two replacement draws: not four.
    expect(dealtIds(events)).toHaveLength(2);
    expect(drawnIds(events)).toHaveLength(4);
    expect(seat.hand.length).toBe(handBefore + 2);
    expectReplays(session, deps);
  });

  it("one that leaves the card where it went does not stop the fallback", () => {
    const deps = depsWith(BYSTANDER_INTERRUPT);
    const onTop = withTwoOnTop(BYSTANDER, deps);
    const [first] = mustPlayer(onTop, P1).deck;
    const { state, events } = playFree(onTop, deps, MILL_ONE.card.id);
    expect(mustPlayer(state, P1).dealtEncounter).toContain(first);
    expect(dealtIds(events).filter((id) => id === first)).toHaveLength(1);
  });
});

describe("§4.1 Q4 at setup", () => {
  /** A main scheme whose Setup ability puts the top encounter card on top of the first player's deck. */
  const SEED_SETUP = stubAbility("seeded.setup", {
    trigger: { kind: "setup" },
    effects: [{ kind: "moveCards", cards: encounterTop(1), to: "deckTop", into: { kind: "firstPlayer" } }],
  });
  const SEEDED = scheme("seeded", [SEED_SETUP]);
  const deps = depsWith(SEED_SETUP);
  const create = (mainScheme: typeof QUIET) => {
    const created = createGame(
      {
        seed: 21,
        cards: [...DEFAULT_CARDS, ...CARDS, SEEDED],
        villainCardId: VILLAIN.id,
        mainSchemeCardId: mainScheme.id,
        encounterDeck: copiesOf(PHANTOM.id, 20),
        players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK] }],
      },
      deps,
    );
    if (!created.ok) throw new Error(created.error.message);
    return created;
  };

  it("an encounter card drawn in the opening hand is dealt facedown, and a card is drawn in its place", () => {
    // Setup abilities resolve before the opening draw (RRG 1.8 Appendix II steps 12 and 14).
    const { state, events } = create(SEEDED);
    const [phantom] = dealtIds(events);
    expect(phantom).toBeDefined();
    expect(mustInstance(state, phantom!)).toMatchObject({ cardId: PHANTOM.id, ownerId: null, faceup: false });
    const seat = mustPlayer(state, P1);
    expect(seat.dealtEncounter).toContain(phantom);
    expect(phantomsIn(state, seat.hand)).toHaveLength(0);
    // A counted draw of hand-size cards, the phantom replaced: a full hand at the mulligan.
    expect(seat.hand.length).toBe(handSize(state, P1, deps));
    expect(state.pendingChoice?.prompt.kind).toBe("mulligan");
  });

  it("one drawn by the mulligan's draw is dealt the same way; replay deep-equal", () => {
    const created = create(QUIET);
    // Surgery before the session starts (the log replays from here): a phantom from the encounter deck on top of P1's
    // deck, unowned and facedown, while P1 decides the mulligan.
    const initial = created.state;
    const deckId = activeEncounterDeckId(initial);
    const piles = initial.encounterDecks[deckId]!;
    const [phantom] = piles.deck;
    const seat = mustPlayer(initial, P1);
    const surgered: GameState = {
      ...initial,
      encounterDecks: { ...initial.encounterDecks, [deckId]: { ...piles, deck: piles.deck.slice(1) } },
      players: initial.players.map((p) => (p.playerId === P1 ? { ...p, deck: [phantom!, ...seat.deck] } : p)),
      instances: { ...initial.instances, [phantom!]: { ...mustInstance(initial, phantom!), faceup: false } },
    };
    expect(mustInstance(surgered, phantom!).ownerId).toBeNull();
    // Mulligan one card, then take the defaults.
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "mulligan") return choice.options.slice(0, 1).map((o) => o.optionId);
      return defaultPick(state);
    };
    const { session, events } = driveSession(startSession(surgered), deps, [], pick);
    const after = mustPlayer(session.state, P1);
    expect(dealtIds(events)).toEqual([phantom]);
    expect(after.dealtEncounter).toContain(phantom);
    expect(phantomsIn(session.state, after.hand)).toHaveLength(0);
    expect(after.hand.length).toBe(handSize(session.state, P1, deps));
    expectReplays(session, deps);
  });
});
