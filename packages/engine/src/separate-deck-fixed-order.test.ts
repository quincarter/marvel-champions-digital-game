/**
 * docs/phase7-wave11.md §3.1: a separate deck in fixed order, open to its owner (`IdentitySeparateDeck.fixedOrder`,
 * `ownerMayLookThrough`), proven with a synthetic "Sightless" identity shaped like Daredevil, who also brings a
 * Weather-like deck without the flags as the control.
 *
 * Sources: MC60 rulebook p. 26 ("shuffle all five of Daredevil's Sense cards together … Place it faceup next to your
 * identity and you can look through it at any time, but you cannot change the order"); the Sense search cards' "(Do not
 * shuffle.)"; RRG 1.8 "Search" (p. 39: a searched deck is shuffled afterwards), which that card text overrides (The
 * Golden Rules, p. 4); RRG 1.8 Appendix II step 6 (p. 51: decks are shuffled at setup).
 */

import type { AnyCard, CardId, HeroIdentityCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { isFixedOrderDeck, mayLookThroughSeparateDeck, mustInstance, mustPlayer, separateDeckOf } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands, runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubIdentity, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, giveCard, MAIN_SCHEME, VILLAIN } from "./testing/scenario.js";

const p1 = playerId("p1");
const SENSE = "Sense";
const WEATHER = "Weather";
const you = { kind: "controller" } as const;

const deckCards = (deck: string, names: readonly string[]): readonly AnyCard[] =>
  names.map((name) => ({ ...stubSupport({ id: `${deck}-${name}`, cost: 0 }), deckLimit: 0, separateDeck: deck }));
const SENSES = deckCards(SENSE, ["a", "b", "c", "d", "e"]);
const WEATHERS = deckCards(WEATHER, ["clear", "storm", "fog", "wind"]);

/** "Choose any card from the deck and put it into play." then the search's shuffle (RRG 1.8 "Search", p. 39). */
const takeFrom = (name: string): readonly EffectSpec[] => [
  {
    kind: "chooseCards",
    slot: "taken",
    from: { kind: "separateDeck", player: you, name },
    chooser: you,
    min: 1,
    max: 1,
  },
  { kind: "putIntoPlay", card: { kind: "slot", slot: "taken" }, controller: you },
  { kind: "shuffleDeck", player: you, separateDeck: name },
];
const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { ability, card: stubEvent({ id, cost: 0, abilities: [ability.ref] }) };
};
const TAKE_SENSE = event("take-sense", takeFrom(SENSE));
const TAKE_WEATHER = event("take-weather", takeFrom(WEATHER));
/** "Find Sense-d and put it into play." A find searches the deck it is in (RRG 1.8 "Find", p. 19). */
const FIND_SENSE = event("find-sense", [
  { kind: "findCard", query: { name: SENSES[3]!.name }, owner: you, to: "play" },
]);
const EVENTS = [TAKE_SENSE, TAKE_WEATHER, FIND_SENSE];

const SIGHTLESS: HeroIdentityCard = {
  ...stubIdentity({ id: "sightless", hp: 10, atk: 2, thw: 2, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6 }),
  separateDecks: [
    {
      name: SENSE,
      cards: SENSES.map((card) => ({ cardId: card.id, quantity: 1 })),
      topCardFaceup: true,
      discardPile: "none",
      whenEmpty: "stayEmpty",
      fixedOrder: true,
      ownerMayLookThrough: true,
    },
    {
      name: WEATHER,
      cards: WEATHERS.map((card) => ({ cardId: card.id, quantity: 1 })),
      topCardFaceup: false,
      discardPile: "none",
      whenEmpty: "stayEmpty",
    },
  ],
};

const BLANK = stubTreachery({ id: "blank-fixed", boostIcons: 0 });
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));

function created(seed = 31) {
  const result = createGame(
    {
      seed,
      cards: [...DEFAULT_CARDS, SIGHTLESS, ...SENSES, ...WEATHERS, ...EVENTS.map((e) => e.card), BLANK],
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: Array.from({ length: 12 }, (): CardId => BLANK.id),
      players: [{ identityCardId: SIGHTLESS.id, deck: [...DEFAULT_DECK, ...EVENTS.map((e) => e.card.id)] }],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return result;
}

const sense = (state: GameState) => separateDeckOf(state, p1, SENSE).deck;
const weather = (state: GameState) => separateDeckOf(state, p1, WEATHER).deck;
const shuffled = (name: string) => (e: GameEvent) =>
  e.type === "deckShuffled" && e.zone.kind === "separateDeck" && e.zone.name === name;

/** Plays `fx` from p1's hand, choosing `wanted` when a card choice offers it. */
function play(start: GameState, fx: (typeof EVENTS)[number], wanted?: InstanceId) {
  const given = giveCard(start, p1, fx.card.id);
  const command: Command = {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  const pick = (state: GameState) => {
    const option = state.pendingChoice?.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === wanted);
    return state.pendingChoice?.prompt.kind === "chooseCards" && option ? [option.optionId] : defaultPick(state);
  };
  return runCommandsPicking(given.state, deps, pick, command);
}

describe("§3.1 a separate deck in fixed order, open to its owner (the Sense deck)", () => {
  it("copies both flags into the player's deck state, and only for the flagged deck", () => {
    const { state } = created();
    expect(separateDeckOf(state, p1, SENSE)).toMatchObject({ fixedOrder: true, ownerMayLookThrough: true });
    expect(separateDeckOf(state, p1, WEATHER)).not.toHaveProperty("fixedOrder");
    expect(separateDeckOf(state, p1, WEATHER)).not.toHaveProperty("ownerMayLookThrough");
    expect(isFixedOrderDeck(state, { kind: "separateDeck", playerId: p1, name: SENSE })).toBe(true);
    expect(isFixedOrderDeck(state, { kind: "separateDeck", playerId: p1, name: WEATHER })).toBe(false);
    expect(isFixedOrderDeck(state, { kind: "deck", playerId: p1 })).toBe(false);
  });

  it("is shuffled once at setup (MC60 p. 26, RRG 1.8 Appendix II step 6), a seeded shuffle, its top card faceup", () => {
    const { state, events } = created();
    const atSetup = events.filter(shuffled(SENSE));
    expect(atSetup).toHaveLength(1);
    expect(atSetup[0]).toMatchObject({ order: sense(state) });
    expect(sense(created().state)).toEqual(sense(state));
    expect(mustInstance(state, sense(state)[0]!).faceup).toBe(true);
  });

  it("a choice from it followed by a shuffle takes the third card and the other four keep their order", () => {
    const { state: start } = runCommands(created().state, deps);
    const before = sense(start);
    const third = before[2] as InstanceId;
    const { state, events } = play(start, TAKE_SENSE, third);
    expect(mustPlayer(state, p1).playArea).toContain(third);
    expect(sense(state)).toEqual(before.filter((id) => id !== third));
    expect(events.some(shuffled(SENSE))).toBe(false);
    expect(mustInstance(state, sense(state)[0]!).faceup).toBe(true);
  });

  it("a find that names a Sense card leaves the order, and its log line says the deck was not shuffled", () => {
    const { state: start } = runCommands(created().state, deps);
    const before = sense(start);
    const target = before.find((id) => mustInstance(start, id).cardId === SENSES[3]!.id) as InstanceId;
    const { state, events } = play(start, FIND_SENSE);
    expect(mustPlayer(state, p1).playArea).toContain(target);
    expect(sense(state)).toEqual(before.filter((id) => id !== target));
    expect(events.some(shuffled(SENSE))).toBe(false);
    expect(events.find((e) => e.type === "cardFound")).toMatchObject({ instanceId: target, deckShuffled: false });
  });

  it("the deck without the flag still shuffles after a search (RRG 1.8 'Search', p. 39)", () => {
    const { state: start } = runCommands(created().state, deps);
    const wanted = weather(start)[3] as InstanceId;
    const { state, events } = play(start, TAKE_WEATHER, wanted);
    expect(mustPlayer(state, p1).playArea).toContain(wanted);
    const after = events.filter(shuffled(WEATHER));
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ order: weather(state) });
  });

  it("only its owner may look through it: not another player, and not a deck without the flag", () => {
    const { state } = created();
    const p2 = playerId("p2");
    expect(mayLookThroughSeparateDeck(state, p1, p1, SENSE)).toBe(true);
    expect(mayLookThroughSeparateDeck(state, p2, p1, SENSE)).toBe(false);
    expect(mayLookThroughSeparateDeck(state, p1, p1, WEATHER)).toBe(false);
    expect(mayLookThroughSeparateDeck(state, p1, p1, "Nonexistent")).toBe(false);
  });
});
