/**
 * docs/phase7-wave9.md §3.17: a scenario deck whose top card is in play (`ScenarioSeparateDeck.topCardInPlay`), with
 * synthetic cards shaped like M.O.D.O.K.'s Holding Cell deck (`aos` 50105a/b–50108a/b), scripted with stub abilities.
 *
 * Sources. MC50 p. 13: "shuffle together the four double-sided Holding Cell cards, each with an Inhuman ally on the
 * reverse. Place this deck near the main scheme with its Holding Cell side faceup. The top card of this deck is in
 * play. When a Holding Cell enters play, either during setup or when the last lock counter is removed from the previous
 * top card of the Holding Cell deck, the text on the Holding Cell places 2[per_hero] lock counters on that card."
 * MC50 p. 22: "The Inhuman ally that leaves play flips over and becomes the only card in the Holding Cell deck. Resolve
 * the 'enters play' text on its Holding Cell side by placing lock counters on it." Holding Cell (50105a): "Enters play
 * with 2[per_hero] lock counters on it. Forced Interrupt: When the last lock counter is removed from here, flip this
 * card and put Flying Inhuman into play under any player's control." Strong Inhuman (50108b): "Forced Response: After
 * this card leaves play, flip it and place it on the bottom of the Holding Cell deck." RRG 1.8 "Flip" (p. 20), "When
 * Revealed Abilities" (p. 48), "In Play and Out of Play" (p. 23), "Double-Sided Card" (p. 17).
 */

import { flat, type AnyCard, type CardId, type ScenarioSeparateDeck, type Trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { locateCard, mustInstance } from "./query.js";
import { scenarioDeckCards, scenarioDeckWithTop } from "./resolve/scenario-deck-top.js";
import { cardsInPlay } from "./select.js";
import { createGame } from "./setup.js";
import type { CardDestination, EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { faceVisible, zoneHidden } from "./visibility.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEnvironment, stubEvent, stubMainScheme, stubTreachery } from "./testing/fixtures.js";
import {
  DEFAULT_CARDS,
  DEFAULT_DECK,
  defaultPick,
  giveCard,
  HERO,
  seatIdentities,
  VILLAIN,
} from "./testing/scenario.js";
import { copiesOf, P1, P2 } from "./testing/wave3.js";

const HOLDING = "Holding Cell";
const CELL = "CELL" as Trait;
const INHUMAN = "INHUMAN" as Trait;
const self: TargetRef = { kind: "self" };
const one = { kind: "const", value: 1 } as const;
const toBottom: CardDestination = { scenarioDeck: HOLDING, at: "bottom" };

const abilities: StubAbility[] = [];
const ability = (id: string, definition: StubAbility["definition"]) => {
  const made = stubAbility(id, definition);
  abilities.push(made);
  return made;
};

// --- The Holding Cell deck ------------------------------------------------------------------------------------------

/** "Enters play with 2[per_hero] lock counters on it." */
const ENTERS = ability("cell.constant", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", selfIs: "target" } },
  effects: [
    { kind: "addCounters", target: self, counterType: "lock", amount: { kind: "perPlayer", base: 0, perPlayer: 2 } },
  ],
});
/** "Forced Interrupt: When the last lock counter is removed from here, flip this card and put [the ally] into play under any player's control." */
const FREED = ability("cell.forced-interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "countersRemoved", selfIs: "target", eventIs: { counterType: "lock" }, eventAtMost: { remaining: 0 } },
  },
  effects: [
    { kind: "choosePlayer", slot: "freer", chooser: { kind: "firstPlayer" } },
    { kind: "flipCard", target: self, controller: { kind: "slot", slot: "freer" } },
  ],
});
/** "Hero Action: … → remove 1 lock counter from here." (The resource cost is the script's; none here.) */
const UNLOCK = ability("cell.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "removeCounters", target: self, counterType: "lock", amount: one }],
});
/** A lever: "Forced Response: After a player plays a card, place 1 heard counter here." Only a card in play hears. */
const HEARS = ability("cell.hears", {
  trigger: { kind: "response", forced: true, on: { on: "cardPlayed" } },
  effects: [{ kind: "addCounters", target: self, counterType: "heard", amount: one }],
});
/** A When Revealed no Holding Cell prints: it must never resolve, since the top card is put into play, not revealed. */
const REVEALED = ability("cell.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "addCounters", target: self, counterType: "revealed", amount: one }],
});
/** "Forced Response: After this card leaves play, flip it and place it on the bottom of the Holding Cell deck." */
const RETURNS = ability("inhuman.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [{ kind: "moveCards", cards: { kind: "ref", ref: self }, to: toBottom }],
});

const NUMBERS = [1, 2, 3, 4] as const;
const cellId = (n: number) => `cell-${n}` as CardId;
const allyId = (n: number) => `inhuman-${n}` as CardId;
const CELLS: AnyCard[] = NUMBERS.map((n) => ({
  ...stubEnvironment({
    id: cellId(n),
    traits: [CELL],
    abilities: [ENTERS.ref, FREED.ref, UNLOCK.ref, REVEALED.ref, HEARS.ref],
  }),
  definedCounterTypes: ["lock"],
  otherFaceId: allyId(n),
}));
const ALLIES: AnyCard[] = NUMBERS.map((n) => ({
  ...stubAlly({ id: allyId(n), cost: 0, atk: 1, thw: 1, hp: 3, traits: [INHUMAN], abilities: [RETURNS.ref] }),
  otherFaceId: cellId(n),
}));
const DECK: ScenarioSeparateDeck = {
  name: HOLDING,
  contents: { cardIds: NUMBERS.map(cellId) },
  discardPile: "none",
  whenEmpty: "remainsEmpty",
  topCardInPlay: true,
};

/** "After the Holding Cell deck runs out", counted on the main scheme. */
const RAN_OUT = ability("scheme.ran-out", {
  trigger: { kind: "response", forced: true, on: { on: "deckRanOut", eventIs: { deck: "scenario", name: HOLDING } } },
  effects: [{ kind: "addCounters", target: self, counterType: "ranOut", amount: one }],
});
const SETUP = ability("scheme.setup", {
  trigger: { kind: "setup" },
  effects: [{ kind: "buildScenarioDeck", name: HOLDING }],
});
const SCHEME = stubMainScheme({
  id: "upgrading",
  stages: [
    {
      startingThreat: flat(0),
      targetThreat: flat(99),
      acceleration: flat(0),
      aSideAbilities: [SETUP.ref],
      abilities: [RAN_OUT.ref],
    },
  ],
});
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

// --- Player cards (test levers) -------------------------------------------------------------------------------------

const event = (id: string, effects: readonly EffectSpec[]) =>
  stubEvent({ id, cost: 0, abilities: [ability(`${id}.action`, { trigger: { kind: "action" }, effects }).ref] });
const eachInhuman: TargetRef = { kind: "each", query: { categories: ["ally"], trait: INHUMAN } };
const cellInPlay: TargetRef = { kind: "each", query: { categories: ["environment"], trait: CELL } };
/** Defeats every Inhuman ally in play. */
const SMITE = event("smite", [{ kind: "defeat", target: eachInhuman }]);
/** An effect that discards the Holding Cell in play. */
const RAZE = event("raze", [{ kind: "discardFromPlay", target: cellInPlay }]);
/** "Place 1 lock counter on the top card of the Holding Cell deck", named through the deck. */
const BOLT = event("bolt", [
  { kind: "selectCards", slot: "top", cards: { kind: "scenarioDeck", name: HOLDING, top: one } },
  { kind: "addCounters", target: { kind: "slot", slot: "top" }, counterType: "lock", amount: one },
]);
const EVENTS = [SMITE, RAZE, BOLT];

const deps: EngineDeps = depsOf(...abilities);

function start(seed = 5): GameState {
  const identities = seatIdentities(HERO, 2);
  const result = createGame(
    {
      seed,
      cards: [...DEFAULT_CARDS, ...identities.slice(1), SCHEME, ...CELLS, ...ALLIES, FILLER, ...EVENTS],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: SCHEME.id,
      encounterDeck: [...NUMBERS.map(cellId), ...copiesOf(FILLER.id, 20)],
      scenarioDecks: [DECK],
      includeIdentitySets: false,
      players: identities.map((identity) => ({
        identityCardId: identity.id,
        deck: [...DEFAULT_DECK, ...EVENTS.flatMap((card) => copiesOf(card.id, 3))],
      })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}

type Run = { readonly state: GameState; readonly events: readonly GameEvent[]; readonly session: GameSession };
/** Answers "choose a player" with `player`; everything else as `defaultPick`. */
const choosing =
  (player: PlayerId) =>
  (state: GameState): readonly string[] => {
    const option = state.pendingChoice?.options.find((o) => o.ref.kind === "player" && o.ref.playerId === player);
    return option ? [option.optionId] : defaultPick(state);
  };
function drive(state: GameState, commands: readonly Command[], freer: PlayerId = P1): Run {
  const { session, events } = driveSession(startSession(state), deps, commands, choosing(freer));
  return { state: session.state, events, session };
}
const piles = (state: GameState) => state.scenarioDecks[HOLDING]!;
const top = (state: GameState): InstanceId => {
  const id = piles(state).inPlayTopId;
  if (id === undefined) throw new Error("the Holding Cell deck has no card in play");
  return id;
};
const cardOf = (state: GameState, id: InstanceId): string => mustInstance(state, id).cardId;
const locks = (state: GameState, id: InstanceId): number => mustInstance(state, id).counters.lock ?? 0;
const cellsInPlay = (state: GameState): InstanceId[] =>
  cardsInPlay(state).filter((id) => cardOf(state, id).startsWith("cell-"));
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const unlock = (state: GameState, id: InstanceId = top(state)): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: id,
  abilityId: UNLOCK.ref.id,
  payment: [],
});
/** Uses the top cell's action until it flips: four uses with two players. Returns the freed ally's instance. */
function free(state: GameState, freer: PlayerId = P1): Run & { readonly freed: InstanceId } {
  const freed = top(state);
  let run: Run = { state, events: [], session: startSession(state) };
  const events: GameEvent[] = [];
  for (let used = 0; used < 4; used++) {
    run = drive(run.state, [unlock(run.state, freed)], freer);
    events.push(...run.events);
  }
  return { ...run, events, freed };
}
function play(state: GameState, card: CardId, player: PlayerId = P1): Run {
  const given = giveCard(state, player, card);
  return drive(given.state, [
    { type: "playCard", playerId: player, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
  ]);
}
const replays = (session: GameSession): void => {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
};
/** Frees all four allies, two under each player's control (four under one would be over the ally limit). */
function allFreed(): GameState {
  let state = start();
  for (let n = 0; n < 4; n++) state = free(state, n % 2 === 0 ? P1 : P2).state;
  return state;
}

describe("§3.17 setup: the top card of the Holding Cell deck is in play", () => {
  it("one cell is in play with 2 per player lock counters; the three under it are in the deck, out of play", () => {
    const state = start();
    expect(cellsInPlay(state)).toEqual([top(state)]);
    expect(locateCard(state, top(state))).toEqual({ kind: "villainArea" });
    expect(mustInstance(state, top(state))).toMatchObject({ faceup: true, controllerId: null, engagedWith: null });
    expect(locks(state, top(state))).toBe(4);
    expect(piles(state).deck).toHaveLength(3);
    expect(scenarioDeckCards(state, HOLDING)).toEqual([top(state), ...piles(state).deck]);
    expect(scenarioDeckWithTop(state, top(state))).toBe(HOLDING);
    for (const id of piles(state).deck) {
      expect(cardOf(state, id).startsWith("cell-")).toBe(true);
      expect(mustInstance(state, id).counters).toEqual({});
      expect(mustInstance(state, id).home).toEqual({ kind: "scenarioDeck", name: HOLDING });
      expect(scenarioDeckWithTop(state, id)).toBeNull();
    }
    // Every card of the deck came out of the encounter deck; no ally face is a card of its own anywhere.
    expect(Object.values(state.instances).filter((i) => i.cardId.startsWith("inhuman-"))).toEqual([]);
  });

  it("the top card is put into play, not revealed: no When Revealed resolves (RRG 1.8 p. 48)", () => {
    const state = start();
    expect(mustInstance(state, top(state)).counters).toEqual({ lock: 4 });
  });

  it("the cards under the top card are hidden from every viewer; the top card is seen", () => {
    const state = start();
    expect(faceVisible(state, top(state))).toBe(true);
    expect(zoneHidden(state, top(state))).toBe(false);
    for (const id of piles(state).deck) {
      expect(mustInstance(state, id).faceup).toBe(false);
      for (const view of [undefined, { deps }, { viewer: P1, deps }, { viewer: P2, deps }]) {
        expect(faceVisible(state, id, view)).toBe(false);
        expect(zoneHidden(state, id, view)).toBe(true);
      }
    }
  });

  it("only the top card's abilities are active: the action of a cell under it cannot be used", () => {
    const state = start();
    const [under] = piles(state).deck;
    expect(applyCommand(state, unlock(state, under!), deps).ok).toBe(false);
    const used = drive(state, [unlock(state)]);
    expect(locks(used.state, top(used.state))).toBe(3);
    expect(top(used.state)).toBe(top(state));
    for (const id of piles(used.state).deck) expect(mustInstance(used.state, id).counters).toEqual({});
    // A response printed on every cell: the one in play answers a card being played, the three under it do not.
    const played = play(state, BOLT.id);
    expect(mustInstance(played.state, top(played.state)).counters).toEqual({ lock: 5, heard: 1 });
    for (const id of piles(played.state).deck) expect(mustInstance(played.state, id).counters).toEqual({});
  });

  it("a deck that does not say so keeps every card in the deck, out of play", () => {
    const { topCardInPlay: _omitted, ...plain } = DECK;
    const identities = seatIdentities(HERO, 2);
    const result = createGame(
      {
        seed: 5,
        cards: [...DEFAULT_CARDS, ...identities.slice(1), SCHEME, ...CELLS, ...ALLIES, FILLER],
        villainCardId: VILLAIN.id,
        mainSchemeCardId: SCHEME.id,
        encounterDeck: [...NUMBERS.map(cellId), ...copiesOf(FILLER.id, 20)],
        scenarioDecks: [plain],
        includeIdentitySets: false,
        players: identities.map((identity) => ({ identityCardId: identity.id, deck: DEFAULT_DECK })),
      },
      deps,
    );
    if (!result.ok) throw new Error(result.error.message);
    const state = driveSession(startSession(result.state), deps).session.state;
    expect(piles(state).deck).toHaveLength(4);
    expect(piles(state).inPlayTopId).toBeUndefined();
    expect(cellsInPlay(state)).toEqual([]);
  });
});

describe("§3.17 the top card leaves the top: the next card enters play", () => {
  it("four uses of its action: the cell flips to its ally, ready under the chosen player, and the next cell has 4", () => {
    const state = start();
    const [next] = piles(state).deck;
    const { state: after, events, freed, session } = free(state, P2);
    // The same card, now the ally, in the chosen player's play area: it never left play (RRG 1.8 "Flip", p. 20).
    expect(cardOf(after, freed)).toBe(cardOf(state, freed).replace("cell-", "inhuman-"));
    expect(locateCard(after, freed)).toEqual({ kind: "playArea", playerId: P2 });
    expect(mustInstance(after, freed)).toMatchObject({ controllerId: P2, exhausted: false, counters: {}, damage: 0 });
    expect(ofType(events, "cardMoved").filter((e) => e.instanceId === freed && e.to.kind !== "playArea")).toEqual([]);
    // The next cell is the top card, in play, with its own 2 per player lock counters; two cards are under it.
    expect(top(after)).toBe(next);
    expect(cellsInPlay(after)).toEqual([next]);
    expect(locks(after, next!)).toBe(4);
    expect(mustInstance(after, next!).counters).toEqual({ lock: 4 });
    expect(piles(after).deck).toHaveLength(2);
    expect(ofType(events, "scenarioDeckTopLeft")).toEqual([
      { type: "scenarioDeckTopLeft", name: HOLDING, instanceId: freed },
    ]);
    expect(ofType(events, "scenarioDeckTopEnteredPlay")).toEqual([
      { type: "scenarioDeckTopEnteredPlay", name: HOLDING, instanceId: next },
    ]);
    // The deck has not run out: it has a top card.
    expect(mustInstance(after, after.mainScheme.instanceId).counters.ranOut ?? 0).toBe(0);
    replays(session);
  });

  it("three uses leave the cell in play with 1 lock counter; the first player is the default choice", () => {
    const state = start();
    const cell = top(state);
    let run = drive(state, [unlock(state)]);
    run = drive(run.state, [unlock(run.state)]);
    run = drive(run.state, [unlock(run.state)]);
    expect(top(run.state)).toBe(cell);
    expect(locks(run.state, cell)).toBe(1);
    expect(piles(run.state).deck).toHaveLength(3);
    const freed = drive(run.state, [unlock(run.state)]);
    expect(locateCard(freed.state, cell)).toEqual({ kind: "playArea", playerId: P1 });
    expect(mustInstance(freed.state, cell).controllerId).toBe(P1);
  });

  it("the top cell is discarded from play: the next cell enters play with 4 lock counters", () => {
    const state = start();
    const cell = top(state);
    const [next] = piles(state).deck;
    const { state: after, events, session } = play(state, RAZE.id);
    expect(cardsInPlay(after)).not.toContain(cell);
    // RRG 1.8 "Double-Sided Card" (p. 17): a double-sided card discarded from play is removed from the game.
    expect(locateCard(after, cell)).toEqual({ kind: "removedFromGame" });
    expect(top(after)).toBe(next);
    // In play by the time the card that discarded the first cell has been played, it answers that as any card in play.
    expect(mustInstance(after, next!).counters).toEqual({ lock: 4, heard: 1 });
    expect(piles(after).deck).toHaveLength(2);
    expect(ofType(events, "scenarioDeckTopEnteredPlay")).toHaveLength(1);
    replays(session);
  });

  it("'the top card of the Holding Cell deck', named through the deck, is the card in play", () => {
    const state = start();
    const { state: after } = play(state, BOLT.id);
    expect(locks(after, top(after))).toBe(5);
    for (const id of piles(after).deck) expect(mustInstance(after, id).counters).toEqual({});
  });
});

describe("§3.17 an ally that leaves play goes to the bottom of the deck, Holding Cell side up", () => {
  it("with cards in the deck it is the bottom card, out of play, in no discard pile; the top card is unchanged", () => {
    const freed = free(start());
    const cell = top(freed.state);
    const under = piles(freed.state).deck;
    const { state: after, events, session } = play(freed.state, SMITE.id);
    expect(cardsInPlay(after)).not.toContain(freed.freed);
    expect(piles(after).deck).toEqual([...under, freed.freed]);
    expect(locateCard(after, freed.freed)).toEqual({ kind: "scenarioDeck", name: HOLDING });
    // Flipped: it is a Holding Cell again, facedown to every viewer, with nothing on it and no controller.
    expect(cardOf(after, freed.freed).startsWith("cell-")).toBe(true);
    expect(mustInstance(after, freed.freed)).toMatchObject({ faceup: false, controllerId: null, counters: {} });
    expect(faceVisible(after, freed.freed, { viewer: P1, deps })).toBe(false);
    expect(ofType(events, "cardFlippedToOtherFace").map((e) => [e.instanceId, e.to, e.typeChanged])).toEqual([
      [freed.freed, cardOf(after, freed.freed), true],
    ]);
    expect(after.removedFromGame).not.toContain(freed.freed);
    expect(piles(after).discard).toEqual([]);
    for (const player of after.players) expect(player.discard).not.toContain(freed.freed);
    for (const deck of Object.values(after.encounterDecks)) expect(deck.discard).not.toContain(freed.freed);
    // The cell in play stays the top card with its counters; nothing else entered play.
    expect(top(after)).toBe(cell);
    expect(locks(after, cell)).toBe(4);
    expect(cellsInPlay(after)).toEqual([cell]);
    expect(ofType(events, "scenarioDeckTopEnteredPlay")).toEqual([]);
    replays(session);
  });
});

describe("§3.17 the deck exhausted, and a card placed under an empty deck", () => {
  it("all four freed: no Holding Cell is in play, the deck is empty and has run out once", () => {
    const state = allFreed();
    expect(cellsInPlay(state)).toEqual([]);
    expect(piles(state).deck).toEqual([]);
    expect(piles(state).inPlayTopId).toBeUndefined();
    expect(scenarioDeckCards(state, HOLDING)).toEqual([]);
    const allies = cardsInPlay(state).filter((id) => cardOf(state, id).startsWith("inhuman-"));
    expect(allies).toHaveLength(4);
    expect(allies.map((id) => mustInstance(state, id).controllerId).sort()).toEqual([P1, P1, P2, P2]);
    // It ran out when the last cell flipped, not when that cell came up into play as the deck's last card.
    expect(mustInstance(state, state.mainScheme.instanceId).counters.ranOut).toBe(1);
  });

  it("an ally then defeated is the deck's only card: in play at once with 4 lock counters", () => {
    const state = allFreed();
    const allies = cardsInPlay(state).filter((id) => cardOf(state, id).startsWith("inhuman-"));
    // One ally only: the other three are set aside from the smite by taking them out of the trait query's reach.
    const [victim, ...others] = allies;
    const spared: GameState = {
      ...state,
      instances: {
        ...state.instances,
        ...Object.fromEntries(others.map((id) => [id, { ...mustInstance(state, id), damage: 0 }])),
      },
    };
    const only = play(
      {
        ...spared,
        players: spared.players.map((p) => ({ ...p, playArea: p.playArea.filter((id) => !others.includes(id)) })),
        removedFromGame: [...spared.removedFromGame, ...others],
      },
      SMITE.id,
    );
    const after = only.state;
    expect(top(after)).toBe(victim);
    expect(cardOf(after, victim!).startsWith("cell-")).toBe(true);
    expect(cellsInPlay(after)).toEqual([victim]);
    expect(locateCard(after, victim!)).toEqual({ kind: "villainArea" });
    expect(mustInstance(after, victim!)).toMatchObject({ faceup: true, controllerId: null, counters: { lock: 4 } });
    expect(piles(after).deck).toEqual([]);
    expect(scenarioDeckCards(after, HOLDING)).toEqual([victim]);
    expect(ofType(only.events, "scenarioDeckTopEnteredPlay")).toEqual([
      { type: "scenarioDeckTopEnteredPlay", name: HOLDING, instanceId: victim },
    ]);
    replays(only.session);
  });

  it("two allies defeated at once under an empty deck: one is the top card in play, the other waits under it", () => {
    const state = allFreed();
    const { state: after, session } = play(state, SMITE.id);
    expect(cellsInPlay(after)).toEqual([top(after)]);
    expect(locks(after, top(after))).toBe(4);
    expect(piles(after).deck).toHaveLength(3);
    for (const id of piles(after).deck) {
      expect(cardOf(after, id).startsWith("cell-")).toBe(true);
      expect(mustInstance(after, id)).toMatchObject({ faceup: false, counters: {} });
    }
    expect(cardsInPlay(after).filter((id) => cardOf(after, id).startsWith("inhuman-"))).toEqual([]);
    replays(session);
  });

  it("the freed cell can be freed again: its ally comes back under the chosen player", () => {
    const state = play(allFreed(), SMITE.id).state;
    const cell = top(state);
    const again = free(state, P2);
    expect(cardOf(again.state, cell).startsWith("inhuman-")).toBe(true);
    expect(mustInstance(again.state, cell).controllerId).toBe(P2);
    expect(piles(again.state).deck).toHaveLength(2);
    expect(locks(again.state, top(again.state))).toBe(4);
  });
});
