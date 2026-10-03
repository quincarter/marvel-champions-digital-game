/**
 * docs/phase7-wave6.md §3.46: an identity's facedown separate deck with no discard pile that stays empty once emptied
 * (Storm's Weather deck), proven with a synthetic "Weatherwitch".
 *
 * Sources: the Storm Hero Pack insert, "The Weather Deck" ("shuffle all four of Storm's WEATHER support cards together
 * … place the WEATHER deck facedown next to your identity card"); RRG 1.8 "Search" (p. 39: "If any portion of a deck
 * is searched, upon completion of that game step, game function, or card ability, shuffle that entire deck");
 * docs/phase7-wave6.md §4.1 Q26 (a Weather card that would go to any discard pile, hand or deck goes back to the
 * Weather deck facedown; the deck never resets; its owner sees its contents only while a choice offers them).
 */

import type { AnyCard, CardId, HeroIdentityCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import { validateDeck } from "./deck.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer, separateDeckOf } from "./query.js";
import { resetEmptySeparateDecks } from "./resolve/separate-decks.js";
import { createGame } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands, runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubIdentity, stubSupport, stubTreachery } from "./testing/fixtures.js";
import {
  DEFAULT_CARDS,
  DEFAULT_DECK,
  defaultPick,
  giveCard,
  MAIN_SCHEME,
  settleUntil,
  VILLAIN,
} from "./testing/scenario.js";
import { faceVisible } from "./visibility.js";

const p1 = playerId("p1");
const WEATHER = "Weather";
const one = { kind: "const", value: 1 } as const;
const you = { kind: "controller" } as const;

const SUPPORTS: readonly AnyCard[] = ["clear", "storm", "fog", "wind"].map((name) => ({
  ...stubSupport({ id: `weather-${name}`, cost: 0 }),
  deckLimit: 0,
  separateDeck: WEATHER,
}));

/** "Setup: Choose a support from the WEATHER deck and put it into play." A search: the deck is shuffled after. */
const chooseWeather = (slot: string): readonly EffectSpec[] => [
  {
    kind: "chooseCards",
    slot,
    from: { kind: "separateDeck", player: you, name: WEATHER },
    chooser: you,
    min: 1,
    max: 1,
  },
  { kind: "putIntoPlay", card: { kind: "slot", slot }, controller: you },
  { kind: "shuffleDeck", player: you, separateDeck: WEATHER },
];
const SETUP = stubAbility("weatherwitch.setup", { trigger: { kind: "setup" }, effects: chooseWeather("weather") });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { ability, card: stubEvent({ id, cost: 0, abilities: [ability.ref] }) };
};
const weatherTop = { kind: "separateDeck", player: you, name: WEATHER, top: one } as const;
/** Discards every support in play: the Weather one tries to reach a discard pile. */
const DISCARD_SUPPORTS = event("discard-supports", [
  { kind: "discardFromPlay", target: { kind: "each", query: { categories: ["support"] } } },
]);
const TOP_TO_HAND = event("top-to-hand", [{ kind: "moveCards", cards: weatherTop, to: "hand" }]);
const TOP_TO_DISCARD = event("top-to-discard", [{ kind: "moveCards", cards: weatherTop, to: "discard" }]);
const TOP_TO_DECK = event("top-to-deck", [{ kind: "moveCards", cards: weatherTop, to: "deckShuffle" }]);
const TOP_TO_OWN_DISCARD = event("top-to-own-discard", [
  { kind: "moveCards", cards: weatherTop, to: "separateDiscard" },
]);
/** Puts one more Weather support into play (a search of the deck, as Setup's). */
const ANOTHER = event("another-weather", chooseWeather("another"));
const EVENTS = [DISCARD_SUPPORTS, TOP_TO_HAND, TOP_TO_DISCARD, TOP_TO_DECK, TOP_TO_OWN_DISCARD, ANOTHER];

const WEATHERWITCH: HeroIdentityCard = {
  ...stubIdentity({
    id: "weatherwitch",
    hp: 10,
    atk: 2,
    thw: 2,
    def: 1,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
    alterEgoAbilities: [SETUP.ref],
  }),
  separateDecks: [
    {
      name: WEATHER,
      cards: SUPPORTS.map((support) => ({ cardId: support.id, quantity: 1 })),
      topCardFaceup: false,
      discardPile: "none",
      whenEmpty: "stayEmpty",
    },
  ],
};

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const deps: EngineDeps = depsOf(SETUP, ...EVENTS.map((e) => e.ability));
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

function created() {
  const result = createGame(
    {
      seed: 23,
      cards: [...DEFAULT_CARDS, WEATHERWITCH, ...SUPPORTS, ...EVENTS.map((e) => e.card), BLANK],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: copies(BLANK.id, 12),
      players: [{ identityCardId: WEATHERWITCH.id, deck: [...DEFAULT_DECK, ...EVENTS.map((e) => e.card.id)] }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

const weather = (state: GameState) => separateDeckOf(state, p1, WEATHER);
const isWeather = (state: GameState, id: InstanceId) => SUPPORTS.some((s) => s.id === mustInstance(state, id).cardId);
const weatherInPlay = (state: GameState) => mustPlayer(state, p1).playArea.filter((id) => isWeather(state, id));
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const facedown = (state: GameState, ids: readonly InstanceId[]) => ids.every((id) => !mustInstance(state, id).faceup);
const shuffledWeather = (e: GameEvent) =>
  e.type === "deckShuffled" && e.zone.kind === "separateDeck" && e.zone.name === WEATHER;

/** p1's first turn, setup's choice answered with the first offered card. */
function game(): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  return runCommands(created().state, deps);
}

function play(state: GameState, card: AnyCard) {
  const given = giveCard(state, p1, card.id);
  const command: Command = {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  return runCommands(given.state, deps, command);
}

describe("§3.46 a facedown separate deck with no discard pile (the Weather deck)", () => {
  it("is built and seated: four cards, owned by the player, all facedown, shuffled at setup, outside the player deck", () => {
    const { state, events } = created();
    const ids = [...weather(state).deck, ...weatherInPlay(state)];
    expect(ids).toHaveLength(4);
    expect(new Set(ids.map((id) => mustInstance(state, id).cardId))).toEqual(new Set(SUPPORTS.map((s) => s.id)));
    for (const id of ids) {
      expect(mustInstance(state, id)).toMatchObject({ ownerId: p1, home: { kind: "separateDeck", name: WEATHER } });
      expect(mustPlayer(state, p1).deck).not.toContain(id);
    }
    expect(facedown(state, weather(state).deck)).toBe(true);
    expect(weather(state).discard).toEqual([]);
    expect(events.some(shuffledWeather)).toBe(true);
    // Deckbuilding no longer refuses the identity; its cards are still not listable in a player deck.
    const legal = validateDeck({ identityCardId: WEATHERWITCH.id, aspects: ["justice"], cards: [] }, [
      WEATHERWITCH,
      ...SUPPORTS,
    ]);
    expect(legal.ok ? [] : legal.problems.map((p) => p.code)).not.toContain("unsupported_identity");
    const listed = validateDeck(
      { identityCardId: WEATHERWITCH.id, aspects: ["justice"], cards: [{ cardId: SUPPORTS[0]!.id, quantity: 1 }] },
      [WEATHERWITCH, ...SUPPORTS],
    );
    expect(listed.ok).toBe(false);
  });

  it("Setup searches it: its owner sees the cards only while the choice offers them, and the deck is shuffled after", () => {
    const start = settleUntil(created().state, "chooseCards", deps);
    const pending = start.pendingChoice;
    expect(pending?.prompt.kind).toBe("chooseCards");
    const offered = weather(start).deck;
    expect(offered).toHaveLength(4);
    for (const id of offered) expect(faceVisible(start, id)).toBe(true);

    // Choose the last card in the deck.
    const wanted = offered[3] as InstanceId;
    const pick = (state: GameState) => {
      const choice = state.pendingChoice;
      const option = choice?.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === wanted);
      return choice?.prompt.kind === "chooseCards" && option ? [option.optionId] : defaultPick(state);
    };
    const { state, events } = runCommandsPicking(start, deps, pick);
    expect(weatherInPlay(state)).toEqual([wanted]);
    expect(mustInstance(state, wanted).faceup).toBe(true);
    expect(weather(state).deck).toHaveLength(3);
    expect(facedown(state, weather(state).deck)).toBe(true);
    for (const id of weather(state).deck) expect(faceVisible(state, id)).toBe(false);
    const entered = events.findIndex(
      (e) => e.type === "cardMoved" && e.instanceId === wanted && e.to.kind === "playArea",
    );
    expect(entered).toBeGreaterThanOrEqual(0);
    expect(events.findIndex((e, i) => i > entered && shuffledWeather(e))).toBeGreaterThan(entered);
  });

  it("a Weather card discarded from play goes back into the Weather deck facedown, logged as a redirect", () => {
    const { state: start } = game();
    const [inPlay] = weatherInPlay(start) as [InstanceId];
    const { state, events } = play(start, DISCARD_SUPPORTS.card);
    expect(weatherInPlay(state)).toEqual([]);
    expect(weather(state).deck).toHaveLength(4);
    expect(weather(state).deck).toContain(inPlay);
    expect(weather(state).discard).toEqual([]);
    expect(mustPlayer(state, p1).discard).not.toContain(inPlay);
    expect(facedown(state, weather(state).deck)).toBe(true);
    expect(mustInstance(state, inPlay)).toMatchObject({ exhausted: false, damage: 0, counters: {} });
    expect(ofType(events, "returnedToSeparateDeck")).toEqual([
      {
        type: "returnedToSeparateDeck",
        instanceId: inPlay,
        cardId: mustInstance(state, inPlay).cardId,
        playerId: p1,
        name: WEATHER,
        instead: "separateDiscard",
      },
    ]);
  });

  it.each([
    [TOP_TO_HAND, "hand"],
    // "discard" follows the card's home: its own deck's discard pile, which this deck does not have.
    [TOP_TO_DISCARD, "separateDiscard"],
    [TOP_TO_DECK, "deck"],
    [TOP_TO_OWN_DISCARD, "separateDiscard"],
  ] as const)("a Weather card sent to a hand, a discard pile or a deck (%#) stays in the Weather deck", (fx, kind) => {
    const { state: start } = game();
    const top = weather(start).deck[0] as InstanceId;
    const hand = mustPlayer(start, p1).hand.length;
    const { state, events } = play(start, fx.card);
    expect(weather(state).deck).toHaveLength(3);
    expect(weather(state).deck).toContain(top);
    expect(weather(state).discard).toEqual([]);
    expect(mustPlayer(state, p1).hand).not.toContain(top);
    expect(mustPlayer(state, p1).hand.length).toBeLessThanOrEqual(hand);
    expect(mustPlayer(state, p1).deck).not.toContain(top);
    expect(mustPlayer(state, p1).discard).not.toContain(top);
    expect(facedown(state, weather(state).deck)).toBe(true);
    expect(ofType(events, "returnedToSeparateDeck").map((e) => [e.instanceId, e.instead])).toEqual([[top, kind]]);
  });

  it("emptied, it stays empty: nothing refills it, not even a card that somehow reached its discard pile", () => {
    let { state } = game();
    const all: GameEvent[] = [];
    for (let i = 0; i < 3; i++) {
      const next = play(state, ANOTHER.card);
      state = next.state;
      all.push(...next.events);
    }
    expect(weatherInPlay(state)).toHaveLength(4);
    expect(weather(state)).toEqual({ deck: [], discard: [] });
    expect(ofType(all, "separateDeckReset")).toEqual([]);
    // A fifth search finds nothing.
    const fifth = play(state, ANOTHER.card);
    expect(weatherInPlay(fifth.state)).toHaveLength(4);
    expect(weather(fifth.state).deck).toEqual([]);

    // State surgery: a card in its (unused) discard pile is never shuffled back.
    const [moved] = weatherInPlay(state) as [InstanceId];
    const surgery: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === p1
          ? {
              ...p,
              playArea: p.playArea.filter((id) => id !== moved),
              separateDecks: { [WEATHER]: { deck: [], discard: [moved] } },
            }
          : p,
      ),
    };
    const ctx = { state: surgery, deps, events: [] as GameEvent[] };
    resetEmptySeparateDecks(ctx as Parameters<typeof resetEmptySeparateDecks>[0]);
    expect(ctx.state).toBe(surgery);
    expect(ctx.events).toEqual([]);
  });

  it("replay reproduces a game that searched, redirected and emptied the Weather deck", () => {
    const start = created().state;
    const given = giveCard(start, p1, DISCARD_SUPPORTS.card.id);
    const playIt = (id: InstanceId): Command => ({
      type: "playCard",
      playerId: p1,
      cardInstanceId: id,
      payment: [],
      attachToInstanceId: null,
    });
    const { session, events } = runCommands(given.state, deps, playIt(given.id), { type: "endTurn", playerId: p1 });
    expect(ofType(events, "returnedToSeparateDeck")).toHaveLength(1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
