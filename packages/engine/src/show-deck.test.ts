/**
 * docs/phase7-wave6.md §3.66: the show deck. A scenario deck built from the encounter deck by trait, card type and named
 * cards, with no discard pile, closed to player card effects, and reached through `CardDestination { scenarioDeck, at }`.
 * Synthetic cards shaped like Spiral's (`mojo` 39015–39019), scripted with stub abilities.
 *
 * Sources: the MojoMania insert, p. 11: "The other two SHOW environments are shuffled together with the Cornered!
 * treachery card during setup to form the show deck. The show deck has no discard pile and cannot be affected by player
 * card effects. Players can interact with this deck only through the side scheme The Search for Spiral." Across the
 * Mojoverse 1B (39015b): "Forced Interrupt: When a SHOW environment would be discarded, place it on the bottom of the show
 * deck instead." Cornered! (39017): "Reveal the top card of the show deck. Shuffle this card into the show deck."
 * Erratic Teleportation (39019): "look at the top card of the show deck and put it on the top or bottom of that deck."
 * RRG 1.8 "Deck" (p. 15), "Player Card" (p. 33), "Look, Looked-At" (p. 27), "Replacement Effect" (p. 37).
 */

import { flat, type AnyCard, type CardId, type ScenarioSeparateDeck, type Trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance } from "./query.js";
import { cardsInPlay } from "./select.js";
import { createGame } from "./setup.js";
import type { CardDestination, CardSelector, EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { faceVisible, zoneHidden } from "./visibility.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment, stubEvent, stubMainScheme, stubTreachery } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, giveCard, HERO, VILLAIN } from "./testing/scenario.js";
import { copiesOf, P1, playFree } from "./testing/wave3.js";

const SHOW = "show";
const SHOW_TRAIT = "SHOW" as Trait;
const SETTING = "SETTING" as Trait;
const one = { kind: "const", value: 1 } as const;
const topOfShow: CardSelector = { kind: "scenarioDeck", name: SHOW, top: one };
const slot = (name: string): TargetRef => ({ kind: "slot", slot: name });
const slotCards = (name: string): CardSelector => ({ kind: "ref", ref: slot(name) });
const into = (at: "top" | "bottom" | "shuffle"): CardDestination => ({ scenarioDeck: SHOW, at });
const showInPlay: TargetRef = { kind: "each", query: { categories: ["environment"], trait: SHOW_TRAIT } };

const abilities: StubAbility[] = [];
const ability = (id: string, definition: StubAbility["definition"]) => {
  const made = stubAbility(id, definition);
  abilities.push(made);
  return made;
};
const whenRevealed = (id: string, effects: readonly EffectSpec[]) =>
  ability(`${id}.when-revealed`, { trigger: { kind: "whenRevealed" }, effects }).ref;

// --- The scenario's cards -------------------------------------------------------------------------------------------

const show = (id: string) => stubEnvironment({ id, traits: [SETTING, SHOW_TRAIT] });
const SHOWS = [show("show-a"), show("show-b"), show("show-c")];
/** A SETTING environment that is not a SHOW: it must stay in the encounter deck. */
const BACKDROP = stubEnvironment({ id: "backdrop", traits: [SETTING] });
/** "Reveal the top card of the show deck. Shuffle this card into the show deck." */
const CORNERED = stubTreachery({
  id: "cornered",
  boostIcons: 0,
  abilities: [
    whenRevealed("cornered", [
      { kind: "selectCards", slot: "top", cards: topOfShow },
      { kind: "revealCard", cards: slot("top"), player: { kind: "controller" } },
      { kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: into("shuffle") },
    ]),
  ],
});
/** The Search for Spiral's "reveals the top card of the show deck", as an encounter card's effect. */
const SEARCH = stubTreachery({
  id: "search",
  boostIcons: 0,
  abilities: [
    whenRevealed("search", [
      { kind: "selectCards", slot: "top", cards: topOfShow },
      { kind: "revealCard", cards: slot("top"), player: { kind: "controller" } },
    ]),
  ],
});
const TOP = "Put it on top of the show deck";
const BOTTOM = "Put it on the bottom of the show deck";
/** Erratic Teleportation: "look at the top card of the show deck and put it on the top or bottom of that deck". */
const TELEPORT = stubTreachery({
  id: "teleport",
  boostIcons: 0,
  abilities: [
    whenRevealed("teleport", [
      { kind: "lookAt", cards: topOfShow, viewer: { kind: "controller" }, bind: "show.seen" },
      {
        kind: "if",
        condition: { kind: "compare", left: { kind: "var", name: "show.seen.count" }, op: "atLeast", right: one },
        then: [
          {
            kind: "chooseOne",
            chooser: { kind: "controller" },
            options: [
              { label: TOP, effects: [{ kind: "moveCards", cards: slotCards("show.seen"), to: into("top") }] },
              { label: BOTTOM, effects: [{ kind: "moveCards", cards: slotCards("show.seen"), to: into("bottom") }] },
            ],
          },
        ],
      },
    ]),
  ],
});
/** An encounter card that discards the SHOW environment in play. */
const CANCELLED = stubTreachery({
  id: "cancelled",
  boostIcons: 0,
  abilities: [whenRevealed("cancelled", [{ kind: "discardFromPlay", target: showInPlay }])],
});
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const SETUP = ability("mojoverse.setup", {
  trigger: { kind: "setup" },
  effects: [
    {
      kind: "selectCards",
      slot: "first",
      cards: { kind: "encounter", zones: ["deck"], filter: { trait: SHOW_TRAIT }, topmostOnly: true },
    },
    { kind: "putIntoPlay", card: slot("first"), controller: { kind: "firstPlayer" } },
    { kind: "buildScenarioDeck", name: SHOW },
  ],
});
/** 1B: "Forced Interrupt: When a SHOW environment would be discarded, place it on the bottom of the show deck instead." */
const TO_THE_BOTTOM = ability("mojoverse.forced-interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: {
      on: "cardLeavesPlay",
      targetIs: { categories: ["environment"], trait: SHOW_TRAIT },
      eventIs: { to: ["encounterDiscard", "scenarioDiscard"] },
    },
  },
  effects: [
    {
      kind: "replaceTriggeringEvent",
      with: [{ kind: "moveCards", cards: { kind: "ref", ref: { kind: "eventTarget" } }, to: into("bottom") }],
    },
  ],
});
const mainScheme = (id: string, withReplacement: boolean) =>
  stubMainScheme({
    id,
    stages: [
      {
        startingThreat: flat(0),
        targetThreat: flat(99),
        acceleration: flat(0),
        aSideAbilities: [SETUP.ref],
        abilities: withReplacement ? [TO_THE_BOTTOM.ref] : [],
      },
    ],
  });
const MOJOVERSE = mainScheme("mojoverse", true);
/** The same scenario without 1B's replacement, to show what the deck's own rule does. */
const BARE = mainScheme("bare", false);

// --- Player cards ---------------------------------------------------------------------------------------------------

const event = (id: string, effects: readonly EffectSpec[]) =>
  stubEvent({ id, cost: 0, abilities: [ability(`${id}.action`, { trigger: { kind: "action" }, effects }).ref] });
/** "Reveal [an encounter card]": the player card only starts the reveal; what follows is the encounter card's effect. */
const call = (card: CardId) =>
  event(`call-${card}`, [
    { kind: "selectCards", slot: "c", cards: { kind: "atMost", count: one, of: encounter({ name: card }) } },
    { kind: "revealCard", cards: slot("c"), player: { kind: "controller" } },
  ]);
const encounter = (filter: { readonly name: string }): CardSelector => ({ kind: "encounter", zones: ["deck"], filter });
const CALL_SEARCH = call(SEARCH.id);
const CALL_TELEPORT = call(TELEPORT.id);
const CALL_CANCELLED = call(CANCELLED.id);
/** Jessica Drew's "Look at the top card of any deck", aimed at the show deck. */
const PEEK = event("peek", [{ kind: "lookAt", cards: topOfShow, viewer: { kind: "controller" }, bind: "seen" }]);
const STEAL = event("steal", [
  { kind: "moveCards", cards: { kind: "scenarioDeck", name: SHOW }, to: "removedFromGame" },
]);
const PLANT = event("plant", [
  { kind: "moveCards", cards: { kind: "atMost", count: one, of: encounter({ name: FILLER.id }) }, to: into("top") },
]);
/** A player card that sends the SHOW environment in play straight to the show deck, shuffled. */
const RESHUFFLE = event("reshuffle", [
  { kind: "moveCards", cards: { kind: "ref", ref: showInPlay }, to: into("shuffle") },
]);
/** A player card that discards the SHOW environment in play: the environment is fair game, the deck is not. */
const HECKLE = event("heckle", [{ kind: "discardFromPlay", target: showInPlay }]);
const EVENTS = [CALL_SEARCH, CALL_TELEPORT, CALL_CANCELLED, PEEK, STEAL, PLANT, RESHUFFLE, HECKLE];

const deps: EngineDeps = depsOf(...abilities);
const DECK: ScenarioSeparateDeck = {
  name: SHOW,
  contents: { cardType: "environment", trait: SHOW_TRAIT, cardIds: [CORNERED.id] },
  discardPile: "none",
  whenEmpty: "remainsEmpty",
  closedToPlayerCards: true,
};

function start(scheme = MOJOVERSE, seed = 11): GameState {
  const result = createGame(
    {
      seed,
      cards: [
        ...DEFAULT_CARDS,
        MOJOVERSE,
        BARE,
        ...SHOWS,
        BACKDROP,
        CORNERED,
        SEARCH,
        TELEPORT,
        CANCELLED,
        FILLER,
        ...EVENTS,
      ] as readonly AnyCard[],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: scheme.id,
      encounterDeck: [
        ...SHOWS.map((card) => card.id),
        BACKDROP.id,
        CORNERED.id,
        ...copiesOf(SEARCH.id, 3),
        ...copiesOf(TELEPORT.id, 2),
        ...copiesOf(CANCELLED.id, 2),
        ...copiesOf(FILLER.id, 10),
      ],
      scenarioDecks: [DECK],
      includeIdentitySets: false,
      players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, ...EVENTS.flatMap((e) => copiesOf(e.id, 2))] }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}

const name = (state: GameState, id: InstanceId): string => mustInstance(state, id).cardId;
const named = (state: GameState, ids: readonly InstanceId[]): string[] => ids.map((id) => name(state, id));
const showDeck = (state: GameState): string[] => named(state, state.scenarioDecks[SHOW]!.deck);
const inPlay = (state: GameState): string[] =>
  named(state, cardsInPlay(state)).filter((id) => id.startsWith("show-") || id === BACKDROP.id);
const everywhereElse = (state: GameState): string[] => {
  const piles = activeEncounterDeck(state);
  return named(state, [...piles.deck, ...piles.discard, ...state.removedFromGame, ...state.encounterSetAside]);
};
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
/** Answers a `chooseOne`'s prompt with the option labelled `label`; everything else as `defaultPick`. */
const picking =
  (label: string) =>
  (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind !== "chooseOption") return defaultPick(state);
    const option = choice.options.find((o) => o.label === label);
    if (!option) throw new Error(`no option ${label}`);
    return [option.optionId];
  };
/** Puts the show deck in a known order (test surgery), so a test does not depend on the shuffle. */
function ordered(state: GameState, order: readonly string[]): GameState {
  const piles = state.scenarioDecks[SHOW]!;
  const deck = order.map((card) => {
    const id = piles.deck.find((candidate) => name(state, candidate) === card);
    if (!id) throw new Error(`no ${card} in the show deck`);
    return id;
  });
  if (deck.length !== piles.deck.length) throw new Error("order must list the whole show deck");
  return { ...state, scenarioDecks: { ...state.scenarioDecks, [SHOW]: { ...piles, deck } } };
}
/** The game with the show deck stacked `others..., cornered` behind whichever SHOW the setup left in the deck first. */
function stacked(scheme = MOJOVERSE): { state: GameState; first: string; deck: readonly string[] } {
  const state = start(scheme);
  const [first] = inPlay(state);
  const others = SHOWS.map((card) => card.id as string).filter((id) => id !== first);
  const deck = [...others, CORNERED.id as string];
  return { state: ordered(state, deck), first: first!, deck };
}

describe("§3.66 the show deck is built from the encounter deck", () => {
  it("one SHOW environment enters play; the other two and Cornered! form the deck, facedown and homed to it", () => {
    const state = start();
    expect(inPlay(state)).toHaveLength(1);
    const [first] = inPlay(state);
    expect(showDeck(state).sort()).toEqual(
      [...SHOWS.map((card) => card.id as string).filter((id) => id !== first), "cornered"].sort(),
    );
    // The SETTING environment that is not a SHOW stays in the encounter deck, with every other card.
    expect(everywhereElse(state).filter((id) => id === BACKDROP.id)).toHaveLength(1);
    expect(everywhereElse(state).some((id) => id.startsWith("show-") || id === "cornered")).toBe(false);
    const piles = state.scenarioDecks[SHOW]!;
    expect(piles.discard).toEqual([]);
    expect(piles.discardPile).toBe("none");
    expect(piles.closedToPlayerCards).toBe(true);
    for (const id of piles.deck) {
      expect(mustInstance(state, id).home).toEqual({ kind: "scenarioDeck", name: SHOW });
      expect(mustInstance(state, id).faceup).toBe(false);
    }
  });

  it("a deck named only by card ids takes those cards and nothing else", () => {
    const result = createGame(
      {
        seed: 3,
        cards: [...DEFAULT_CARDS, MOJOVERSE, ...SHOWS, CORNERED, FILLER] as readonly AnyCard[],
        villainCardId: VILLAIN.id,
        mainSchemeCardId: MOJOVERSE.id,
        encounterDeck: [...SHOWS.map((card) => card.id), CORNERED.id, ...copiesOf(FILLER.id, 10)],
        scenarioDecks: [{ ...DECK, contents: { cardIds: [CORNERED.id] } }],
        includeIdentitySets: false,
        players: [{ identityCardId: HERO.id, deck: DEFAULT_DECK }],
      },
      deps,
    );
    if (!result.ok) throw new Error(result.error.message);
    const state = driveSession(startSession(result.state), deps).session.state;
    expect(showDeck(state)).toEqual(["cornered"]);
    expect(everywhereElse(state).filter((id) => id.startsWith("show-"))).toHaveLength(2);
  });

  it("setup refuses a card id the game does not have, and a deck with no discard pile that would reshuffle one", () => {
    const config = {
      seed: 3,
      cards: [...DEFAULT_CARDS, MOJOVERSE, ...SHOWS, CORNERED, FILLER] as readonly AnyCard[],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MOJOVERSE.id,
      encounterDeck: [...SHOWS.map((card) => card.id), CORNERED.id, ...copiesOf(FILLER.id, 10)],
      includeIdentitySets: false,
      players: [{ identityCardId: HERO.id, deck: DEFAULT_DECK }],
    };
    const unknown = createGame(
      { ...config, scenarioDecks: [{ ...DECK, contents: { cardIds: ["nobody" as CardId] } }] },
      deps,
    );
    expect(unknown.ok ? null : unknown.error.message).toBe("scenario deck show names unknown card nobody");
    const reshuffling = createGame(
      { ...config, scenarioDecks: [{ ...DECK, whenEmpty: "reshuffleDiscardWithoutPenalty" }] },
      deps,
    );
    expect(reshuffling.ok ? null : reshuffling.error.message).toBe(
      "scenario deck show has no discard pile to reshuffle",
    );
  });
});

describe("§3.66 the show deck has no discard pile", () => {
  it("1B's replacement puts a discarded SHOW environment on the bottom of the show deck, and makes the deck its home", () => {
    const { state, first, deck } = stacked();
    const { state: after, events, session } = playFree(state, deps, CALL_CANCELLED.id);
    expect(inPlay(after)).toEqual([]);
    expect(showDeck(after)).toEqual([...deck, first]);
    const moved = after.scenarioDecks[SHOW]!.deck.at(-1)!;
    expect(mustInstance(after, moved).home).toEqual({ kind: "scenarioDeck", name: SHOW });
    expect(mustInstance(after, moved).faceup).toBe(false);
    expect(after.scenarioDecks[SHOW]!.discard).toEqual([]);
    expect(everywhereElse(after)).not.toContain(first);
    // The replacement did it: the deck's own rule had nothing left to redirect, and the card never reached a discard pile.
    expect(ofType(events, "returnedToScenarioDeck")).toEqual([]);
    expect(
      ofType(events, "cardMoved")
        .filter((e) => e.instanceId === moved)
        .map((e) => e.to.kind),
    ).toEqual(["scenarioDeck"]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a player card may discard the SHOW environment in play; 1B still places it on the bottom", () => {
    const { state, first, deck } = stacked();
    const { state: after, events } = playFree(state, deps, HECKLE.id);
    expect(inPlay(after)).toEqual([]);
    expect(showDeck(after)).toEqual([...deck, first]);
    expect(ofType(events, "scenarioDeckClosed")).toEqual([]);
  });

  it("without a replacement, a card of the deck that is discarded goes back to the bottom, facedown, and is logged", () => {
    const { state, first, deck } = stacked(BARE);
    // The environment the setup put into play was never in the show deck: the encounter discard pile takes it.
    const cleared = playFree(state, deps, CALL_CANCELLED.id);
    expect(named(cleared.state, activeEncounterDeck(cleared.state).discard)).toContain(first);
    expect(showDeck(cleared.state)).toEqual(deck);
    expect(ofType(cleared.events, "returnedToScenarioDeck")).toEqual([]);
    // The top card of the show deck is revealed into play, then discarded.
    const revealed = playFree(cleared.state, deps, CALL_SEARCH.id).state;
    expect(inPlay(revealed)).toEqual([deck[0]]);
    expect(showDeck(revealed)).toEqual(deck.slice(1));
    const { state: after, events } = playFree(revealed, deps, CALL_CANCELLED.id);
    expect(inPlay(after)).toEqual([]);
    expect(showDeck(after)).toEqual([...deck.slice(1), deck[0]]);
    const back = after.scenarioDecks[SHOW]!.deck.at(-1)!;
    expect(mustInstance(after, back).faceup).toBe(false);
    expect(after.scenarioDecks[SHOW]!.discard).toEqual([]);
    expect(named(after, activeEncounterDeck(after).discard)).not.toContain(deck[0]);
    expect(ofType(events, "returnedToScenarioDeck")).toEqual([
      { type: "returnedToScenarioDeck", instanceId: back, cardId: deck[0], name: SHOW, instead: "encounterDiscard" },
    ]);
  });
});

describe("§3.66 Cornered! and the cards revealed from the show deck", () => {
  it("revealing the top card puts a SHOW environment into play and leaves the rest in order", () => {
    const { state, first, deck } = stacked();
    const { state: after } = playFree(state, deps, CALL_SEARCH.id);
    expect(inPlay(after).sort()).toEqual([first, deck[0]].sort());
    expect(showDeck(after)).toEqual(deck.slice(1));
  });

  it("Cornered! reveals the next card, then is shuffled back into the show deck and never discarded", () => {
    const { state, first, deck } = stacked();
    const stackedOnTop = ordered(state, [CORNERED.id, ...deck.slice(0, 2)]);
    const { state: after, events, session } = playFree(stackedOnTop, deps, CALL_SEARCH.id);
    // Cornered! left the deck to resolve, so "the top card of the show deck" is the SHOW environment under it.
    expect(inPlay(after).sort()).toEqual([first, deck[0]].sort());
    expect(showDeck(after).sort()).toEqual([CORNERED.id as string, deck[1]].sort());
    const cornered = after.scenarioDecks[SHOW]!.deck.find((id) => name(after, id) === CORNERED.id)!;
    expect(mustInstance(after, cornered).faceup).toBe(false);
    expect(mustInstance(after, cornered).home).toEqual({ kind: "scenarioDeck", name: SHOW });
    expect(named(after, activeEncounterDeck(after).discard)).not.toContain(CORNERED.id);
    expect(after.scenarioDecks[SHOW]!.discard).toEqual([]);
    // Its own text put it back, not the deck's no-discard-pile rule; and the deck was shuffled once it was in.
    expect(ofType(events, "returnedToScenarioDeck")).toEqual([]);
    const moves = ofType(events, "cardMoved").filter((e) => e.instanceId === cornered);
    expect(moves.at(-1)!.to).toEqual({ kind: "scenarioDeck", name: SHOW });
    expect(moves.map((e) => e.to.kind)).not.toContain("encounterDiscard");
    const shuffles = ofType(events, "deckShuffled").filter(
      (e) => e.zone.kind === "scenarioDeck" && e.zone.name === SHOW,
    );
    expect(shuffles).toHaveLength(1);
    expect(events.indexOf(shuffles[0]!)).toBeGreaterThan(events.indexOf(moves.at(-1)!));
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});

/** Plays the Erratic Teleportation caller for free and answers its top-or-bottom choice with `label`. */
function teleport(state: GameState, label: string) {
  const given = giveCard(state, P1, CALL_TELEPORT.id);
  const { session, events } = driveSession(
    startSession(given.state),
    deps,
    [{ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
    picking(label),
  );
  return { session, state: session.state, events };
}

describe("§3.66 look at the top card of the show deck and put it on the top or bottom", () => {
  it("an encounter card's look shows the top card; 'bottom' moves it under the others", () => {
    const { state, deck } = stacked();
    const top = state.scenarioDecks[SHOW]!.deck[0]!;
    const { state: after, events } = teleport(state, BOTTOM);
    expect(ofType(events, "cardsLookedAt")).toEqual([{ type: "cardsLookedAt", playerId: P1, instanceIds: [top] }]);
    expect(showDeck(after)).toEqual([...deck.slice(1), deck[0]]);
    expect(after.scenarioDecks[SHOW]!.deck.at(-1)).toBe(top);
    expect(mustInstance(after, top).faceup).toBe(false);
    expect(ofType(events, "scenarioDeckClosed")).toEqual([]);
    expect(ofType(events, "deckShuffled").filter((e) => e.zone.kind === "scenarioDeck")).toEqual([]);
  });

  it("the looked-at card is visible only while the look is open; a card of the deck is otherwise hidden", () => {
    const { state } = stacked();
    const [top, next] = state.scenarioDecks[SHOW]!.deck as [InstanceId, InstanceId];
    expect(faceVisible(state, top)).toBe(false);
    expect(zoneHidden(state, top)).toBe(true);
    const given = giveCard(state, P1, CALL_TELEPORT.id);
    const looking = sessionApply(
      startSession(given.state),
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      deps,
    );
    if (!looking.ok) throw new Error(looking.error.message);
    expect(looking.session.state.pendingChoice?.prompt.kind).toBe("lookAt");
    expect(faceVisible(looking.session.state, top)).toBe(true);
    expect(faceVisible(looking.session.state, next)).toBe(false);
  });

  it("an empty deck shows nothing and asks nothing", () => {
    const { state } = stacked();
    const piles = state.scenarioDecks[SHOW]!;
    const emptied: GameState = {
      ...state,
      scenarioDecks: { ...state.scenarioDecks, [SHOW]: { ...piles, deck: [] } },
      removedFromGame: [...state.removedFromGame, ...piles.deck],
    };
    const { state: after, events } = teleport(emptied, BOTTOM);
    expect(ofType(events, "cardsLookedAt")).toEqual([]);
    expect(ofType(events, "choiceRequested").filter((e) => e.choice.prompt.kind === "chooseOption")).toEqual([]);
    expect(showDeck(after)).toEqual([]);
  });

  it("'top' leaves the deck in the same order", () => {
    const { state, deck } = stacked();
    const { state: after, events, session } = teleport(state, TOP);
    expect(ofType(events, "cardsLookedAt")).toHaveLength(1);
    expect(showDeck(after)).toEqual(deck);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});

describe("§3.66 the show deck cannot be affected by player card effects", () => {
  it("a player card's look at its top card sees nothing: no prompt, no cards looked at, and the refusal is logged", () => {
    const { state, deck } = stacked();
    const { state: after, events } = playFree(state, deps, PEEK.id);
    expect(ofType(events, "cardsLookedAt")).toEqual([]);
    expect(ofType(events, "choiceRequested").filter((e) => e.choice.prompt.kind === "lookAt")).toEqual([]);
    expect(ofType(events, "scenarioDeckClosed")).toEqual([
      { type: "scenarioDeckClosed", name: SHOW, sourceCardId: PEEK.id, instanceIds: [] },
    ]);
    expect(showDeck(after)).toEqual(deck);
  });

  it("a player card cannot move its cards out", () => {
    const { state, deck } = stacked();
    const { state: after, events } = playFree(state, deps, STEAL.id);
    expect(showDeck(after)).toEqual(deck);
    expect(after.removedFromGame).toEqual(state.removedFromGame);
    expect(ofType(events, "scenarioDeckClosed").map((e) => e.sourceCardId)).toEqual([STEAL.id]);
  });

  it("a player card cannot put a card into it, on top or shuffled", () => {
    const { state, first, deck } = stacked();
    const planted = playFree(state, deps, PLANT.id);
    expect(showDeck(planted.state)).toEqual(deck);
    const [refusal] = ofType(planted.events, "scenarioDeckClosed");
    expect(refusal).toMatchObject({ name: SHOW, sourceCardId: PLANT.id });
    expect(named(planted.state, refusal!.instanceIds)).toEqual([FILLER.id]);
    expect(ofType(planted.events, "scenarioDeckClosed")).toHaveLength(1);

    const reshuffled = playFree(state, deps, RESHUFFLE.id);
    expect(inPlay(reshuffled.state)).toEqual([first]);
    expect(showDeck(reshuffled.state)).toEqual(deck);
    expect(ofType(reshuffled.events, "deckShuffled").filter((e) => e.zone.kind === "scenarioDeck")).toEqual([]);
    expect(ofType(reshuffled.events, "scenarioDeckClosed")).toHaveLength(1);
  });

  it("the same effects reach a deck that is not closed", () => {
    const open = start();
    const piles = open.scenarioDecks[SHOW]!;
    const { closedToPlayerCards: _closed, ...rest } = piles;
    const state = { ...open, scenarioDecks: { ...open.scenarioDecks, [SHOW]: rest } };
    const top = state.scenarioDecks[SHOW]!.deck[0]!;
    const peeked = playFree(state, deps, PEEK.id);
    expect(ofType(peeked.events, "cardsLookedAt")).toEqual([
      { type: "cardsLookedAt", playerId: P1, instanceIds: [top] },
    ]);
    const planted = playFree(state, deps, PLANT.id);
    expect(showDeck(planted.state)).toEqual([FILLER.id, ...showDeck(state)]);
    expect(ofType(planted.events, "scenarioDeckClosed")).toEqual([]);
    const stolen = playFree(state, deps, STEAL.id);
    expect(showDeck(stolen.state)).toEqual([]);
  });
});
