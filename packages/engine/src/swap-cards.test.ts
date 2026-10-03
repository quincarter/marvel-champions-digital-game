/**
 * docs/phase7-wave6.md §3.47: swapping an in-play card with an out-of-play card (`EffectSpec swapCards`), proven with a
 * synthetic "Weatherwitch" shaped like Storm (`storm` 36001a, Weather Control: "Swap your WEATHER support in play with a
 * support of your choice from the WEATHER deck").
 *
 * Sources: RRG 1.8 "'Swap'" (p. 42): the two exchange locations; "A swap cannot be completed if there is not a component
 * in both locations"; "Swapped cards maintain the orientation … of the original card"; different titles: "the in-play
 * card is considered to leave play and the out-of-play card is considered to enter play. Tokens, attached cards, tucked
 * cards, and status cards on the previously in-play card are not transferred … and the other card enters play ready";
 * the same title: "neither card is considered to enter or leave play", everything transfers. RRG 1.8 "Permanent"
 * (p. 32): only an ability of a card in the permanent card's own set may remove it from play. RRG 1.8 "Search" (p. 39):
 * the searched deck is shuffled after.
 */

import { trait, type AnyCard, type HeroIdentityCard, type SupportCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { createCtx } from "./ctx.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer, separateDeckOf } from "./query.js";
import { swapCards } from "./resolve/swap-cards.js";
import { createGame } from "./setup.js";
import type { EffectSpec, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands, runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubIdentity, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, defaultPick, giveCard, MAIN_SCHEME, VILLAIN } from "./testing/scenario.js";

const p1 = playerId("p1");
const WEATHER = "Weather";
const WEATHER_TRAIT = trait("WEATHER");
const you = { kind: "controller" } as const;
const HERO_SET = "hero:weatherwitch" as SupportCard["aspect"];

const weatherSupport = (id: string, name = id, extra: Partial<SupportCard> = {}): SupportCard => ({
  ...stubSupport({ id, cost: 0, traits: [WEATHER_TRAIT], keywords: [{ name: "permanent" }] }),
  name,
  aspect: HERO_SET,
  deckLimit: 0,
  separateDeck: WEATHER,
  ...extra,
});
const CLEAR = weatherSupport("clear");
const FOG = weatherSupport("fog");
/** Enters play with 2 charge counters (uses): its `cardEntersPlay` resolved. */
const WIND = weatherSupport("wind", "wind", {
  keywords: [{ name: "permanent" }, { name: "uses", count: 2, counterType: "charge" }],
});
/** A second copy of Clear's title, for the same-title swap. */
const CLEAR_TOO = weatherSupport("clear-too", "clear");
const SUPPORTS: readonly SupportCard[] = [CLEAR, FOG, WIND, CLEAR_TOO];

const YOUR_WEATHER: TargetQuery = { categories: ["support"], trait: WEATHER_TRAIT, controller: "you" };
/** "Choose a support from the WEATHER deck": a search, shuffled after. */
const chooseWeather = (slot: string): EffectSpec => ({
  kind: "chooseCards",
  slot,
  from: { kind: "separateDeck", player: you, name: WEATHER },
  chooser: you,
  min: 1,
  max: 1,
});
const shuffleWeather: EffectSpec = { kind: "shuffleDeck", player: you, separateDeck: WEATHER };
const SWAP_EFFECTS: readonly EffectSpec[] = [
  chooseWeather("next"),
  { kind: "swapCards", a: { kind: "each", query: YOUR_WEATHER }, b: { kind: "slot", slot: "next" } },
  shuffleWeather,
  { kind: "then", effects: [{ kind: "draw", player: you, amount: { kind: "const", value: 1 } }] },
];

const SETUP = stubAbility("weatherwitch.setup", {
  trigger: { kind: "setup" },
  effects: [chooseWeather("first"), { kind: "putIntoPlay", card: { kind: "slot", slot: "first" }, controller: you }],
});
const SWAP_DEFINITION: AbilityDefinition = {
  trigger: { kind: "action" },
  limit: { count: 1, period: "round" },
  effects: SWAP_EFFECTS,
};
const SWAP = stubAbility("weatherwitch.swap", SWAP_DEFINITION);
/** The same text on a basic event: not of the supports' set, so Permanent stops it (RRG 1.8 p. 32). */
const OUTSIDER_ACTION = stubAbility("outsider.action", { trigger: { kind: "action" }, effects: SWAP_EFFECTS });
const OUTSIDER = stubEvent({ id: "outsider", cost: 0, abilities: [OUTSIDER_ACTION.ref] });

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
    alterEgoAbilities: [SETUP.ref, SWAP.ref],
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
const deps: EngineDeps = depsOf(SETUP, SWAP, OUTSIDER_ACTION);

const count = (query: TargetQuery) => ({ kind: "count", query }) as const;
const identityRef = { kind: "each", query: { categories: ["identity"] } } as const;
const mark = (counterType: string, query: TargetQuery): EffectSpec => ({
  kind: "addCounters",
  target: identityRef,
  counterType,
  amount: count(query),
});
/** "Forced Interrupt: When a WEATHER support leaves play": sees Clear still in play and Fog not yet. */
const LEAVING_INTERRUPT = stubAbility("listener.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", targetIs: YOUR_WEATHER } },
  effects: [mark("clearAtInterrupt", { name: "clear" }), mark("fogAtInterrupt", { name: "fog" })],
});
/** "Forced Response: After a WEATHER support leaves play": sees the swap done. */
const LEFT_RESPONSE = stubAbility("listener.response", {
  trigger: { kind: "response", forced: true, on: { on: "cardLeavesPlay", targetIs: { trait: WEATHER_TRAIT } } },
  effects: [mark("clearAtResponse", { name: "clear" }), mark("fogAtResponse", { name: "fog" })],
});
const listeningDeps: EngineDeps = depsOf(SETUP, SWAP, OUTSIDER_ACTION, LEAVING_INTERRUPT, LEFT_RESPONSE);
/** The same identity carrying the two listeners (its own id, so its abilities stay of the supports' set). */
const LISTENING: HeroIdentityCard = {
  ...WEATHERWITCH,
  alterEgo: {
    ...WEATHERWITCH.alterEgo,
    abilities: [...WEATHERWITCH.alterEgo.abilities, LEAVING_INTERRUPT.ref, LEFT_RESPONSE.ref],
  },
};

const cardsWith = (identity: HeroIdentityCard): readonly AnyCard[] => [
  ...DEFAULT_CARDS,
  identity,
  ...SUPPORTS,
  OUTSIDER,
  BLANK,
];

/** Picks, for each choice from the Weather deck, the first card whose id is next in `wanted`. */
const picking = (...ids: readonly string[]) => {
  const wanted = [...ids];
  return (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseCards") {
      const id = wanted.shift();
      const option = choice.options.find(
        (o) => o.ref.kind === "card" && mustInstance(state, o.ref.instanceId).cardId === id,
      );
      if (option) return [option.optionId];
    }
    return defaultPick(state);
  };
};

/** p1's first turn, with Clear put into play by Setup. */
function game(useDeps: EngineDeps = deps, identity: HeroIdentityCard = WEATHERWITCH) {
  const created = createGame(
    {
      seed: 47,
      cards: cardsWith(identity),
      villainCardId: VILLAIN.id,
      mainSchemeCardId: MAIN_SCHEME.id,
      encounterDeck: Array.from({ length: 12 }, () => BLANK.id),
      players: [{ identityCardId: WEATHERWITCH.id, deck: [...DEFAULT_DECK, OUTSIDER.id] }],
    },
    useDeps,
  );
  if (!created.ok) throw new Error(created.error.message);
  return runCommandsPicking(created.state, useDeps, picking("clear"));
}

const weather = (state: GameState) => separateDeckOf(state, p1, WEATHER);
const weatherInPlay = (state: GameState) =>
  mustPlayer(state, p1).playArea.filter((id) => SUPPORTS.some((s) => s.id === mustInstance(state, id).cardId));
const instanceOf = (state: GameState, card: AnyCard): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === card.id)!.instanceId;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const useSwap = (state: GameState): Command => ({
  type: "useAbility",
  playerId: p1,
  cardInstanceId: mustPlayer(state, p1).identity.instanceId,
  abilityId: SWAP.ref.id,
  payment: [],
});

describe("§3.47 swapping an in-play card with an out-of-play card", () => {
  it("different titles: the in-play card leaves into the chosen card's place facedown, the chosen one enters ready", () => {
    const { state: start } = game();
    const clear = instanceOf(start, CLEAR);
    const wind = instanceOf(start, WIND);
    expect(weatherInPlay(start)).toEqual([clear]);
    // Exhausted, with a counter: neither transfers.
    const worn: GameState = {
      ...start,
      instances: {
        ...start.instances,
        [clear]: { ...mustInstance(start, clear), exhausted: true, counters: { gust: 2 } },
      },
    };
    const hand = mustPlayer(worn, p1).hand.length;
    const { state, events } = runCommandsPicking(worn, deps, picking("wind"), useSwap(worn));

    expect(weatherInPlay(state)).toEqual([wind]);
    expect(mustInstance(state, wind)).toMatchObject({
      faceup: true,
      exhausted: false,
      controllerId: p1,
      engagedWith: null,
      attachedTo: null,
      // Its uses counters: its `cardEntersPlay` resolved, so it entered play.
      counters: { charge: 2 },
    });
    expect(weather(state).deck).toHaveLength(3);
    expect(weather(state).deck).toContain(clear);
    expect(weather(state).deck).not.toContain(wind);
    expect(mustInstance(state, clear)).toMatchObject({ faceup: false, exhausted: false, counters: {}, damage: 0 });
    expect(ofType(events, "cardsSwapped")).toEqual([
      { type: "cardsSwapped", how: "leftAndEntered", outgoing: clear, incoming: wind, cardIds: [CLEAR.id, WIND.id] },
    ]);
    expect(ofType(events, "swapRefused")).toEqual([]);
    expect(ofType(events, "returnedToSeparateDeck")).toEqual([]);
    // The outgoing card moves first, into the Weather deck; the incoming one into play; the search's shuffle after.
    const moves = ofType(events, "cardMoved").filter((e) => e.instanceId === clear || e.instanceId === wind);
    expect(moves.map((e) => [e.instanceId, e.from.kind, e.to.kind])).toEqual([
      [clear, "playArea", "separateDeck"],
      [wind, "separateDeck", "playArea"],
    ]);
    const swapped = events.findIndex((e) => e.type === "cardsSwapped");
    const shuffled = events.findIndex(
      (e) => e.type === "deckShuffled" && e.zone.kind === "separateDeck" && e.zone.name === WEATHER,
    );
    expect(shuffled).toBeGreaterThan(swapped);
    // Fully resolved: the "then" drew a card.
    expect(ofType(events, "thenSkipped")).toEqual([]);
    expect(mustPlayer(state, p1).hand).toHaveLength(hand + 1);
  });

  it("Permanent: a card of another set cannot swap it; nothing moves and the text after a 'then' is skipped", () => {
    const { state: start } = game();
    const clear = instanceOf(start, CLEAR);
    const given = giveCard(start, p1, OUTSIDER.id);
    const deck = weather(given.state).deck;
    const hand = mustPlayer(given.state, p1).hand.length;
    const play: Command = {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    };
    const { state, events } = runCommandsPicking(given.state, deps, picking("fog"), play);
    expect(weatherInPlay(state)).toEqual([clear]);
    expect(weather(state).deck).toHaveLength(deck.length);
    expect(ofType(events, "cardsSwapped")).toEqual([]);
    expect(ofType(events, "swapRefused")).toEqual([
      { type: "swapRefused", reason: "cannotLeavePlay", instanceIds: [clear] },
    ]);
    expect(ofType(events, "preThenUnresolved")).toEqual([{ type: "preThenUnresolved", cause: "swapNotCompleted" }]);
    expect(ofType(events, "thenSkipped")).toHaveLength(1);
    // The event left the hand and drew nothing.
    expect(mustPlayer(state, p1).hand).toHaveLength(hand - 1);
  });

  it("the same title: neither card enters or leaves play; the in-play card keeps its state and takes the other card", () => {
    const { state: start } = game();
    const clear = instanceOf(start, CLEAR);
    const clearToo = instanceOf(start, CLEAR_TOO);
    const worn: GameState = {
      ...start,
      instances: {
        ...start.instances,
        [clear]: { ...mustInstance(start, clear), exhausted: true, counters: { gust: 2 } },
      },
    };
    const { state, events } = runCommandsPicking(worn, deps, picking("clear-too"), useSwap(worn));
    // The in-play instance stays, with everything on it, and is now the other card.
    expect(weatherInPlay(state)).toEqual([clear]);
    expect(mustInstance(state, clear)).toMatchObject({
      cardId: CLEAR_TOO.id,
      exhausted: true,
      counters: { gust: 2 },
      faceup: true,
    });
    expect(weather(state).deck).toContain(clearToo);
    expect(mustInstance(state, clearToo)).toMatchObject({ cardId: CLEAR.id, faceup: false, counters: {} });
    expect(ofType(events, "cardsSwapped")).toEqual([
      {
        type: "cardsSwapped",
        how: "sameTitle",
        outgoing: clear,
        incoming: clearToo,
        cardIds: [CLEAR.id, CLEAR_TOO.id],
      },
    ]);
    expect(ofType(events, "cardMoved").filter((e) => e.instanceId === clear || e.instanceId === clearToo)).toEqual([]);
  });

  it("cannot be completed without a card in both places: an empty Weather deck leaves the support in play", () => {
    const { state: start } = game();
    const clear = instanceOf(start, CLEAR);
    const emptied: GameState = {
      ...start,
      players: start.players.map((p) =>
        p.playerId === p1 ? { ...p, separateDecks: { [WEATHER]: { deck: [], discard: [] } } } : p,
      ),
    };
    const ctx = createCtx(emptied, deps);
    expect(swapCards(ctx, clear, undefined)).toBe("refused");
    expect(ctx.state).toBe(emptied);
    expect(ctx.events).toEqual([{ type: "swapRefused", reason: "missingCard", instanceIds: [clear] }]);
    // A ref naming two cards is no single component either.
    const fog = instanceOf(start, FOG);
    const wind = instanceOf(start, WIND);
    const two = createCtx(start, deps);
    const result = two.state;
    swapCards(two, clear, clear);
    expect(two.state).toBe(result);
    expect(ofType(two.events, "swapRefused")).toEqual([
      { type: "swapRefused", reason: "missingCard", instanceIds: [clear, clear] },
    ]);
    // An identity has its own swap (`swapIdentity`).
    const both = createCtx(start, deps);
    expect(swapCards(both, clear, mustPlayer(start, p1).identity.instanceId)).toBe("refused");
    expect(ofType(both.events, "swapRefused")[0]?.reason).toBe("unsupported");
    expect([fog, wind].every((id) => weather(start).deck.includes(id))).toBe(true);
  });

  it("two out-of-play cards exchange places and orientations; neither enters play", () => {
    const { state: start } = game();
    const top = mustPlayer(start, p1).deck[0]!;
    const inHand = mustPlayer(start, p1).hand[2]!;
    const topFaceup = mustInstance(start, top).faceup;
    const handFaceup = mustInstance(start, inHand).faceup;
    const ctx = createCtx(start, deps);
    expect(swapCards(ctx, inHand, top)).toBe("swapped");
    expect(mustPlayer(ctx.state, p1).deck[0]).toBe(inHand);
    expect(mustPlayer(ctx.state, p1).hand[2]).toBe(top);
    expect(mustPlayer(ctx.state, p1).deck).toHaveLength(mustPlayer(start, p1).deck.length);
    expect(mustPlayer(ctx.state, p1).hand).toHaveLength(mustPlayer(start, p1).hand.length);
    expect(mustInstance(ctx.state, inHand).faceup).toBe(topFaceup);
    expect(mustInstance(ctx.state, top).faceup).toBe(handFaceup);
    expect(ofType(ctx.events, "cardsSwapped")).toEqual([
      {
        type: "cardsSwapped",
        how: "outOfPlay",
        outgoing: inHand,
        incoming: top,
        cardIds: [mustInstance(start, inHand).cardId, mustInstance(start, top).cardId],
      },
    ]);
    // Within one zone: the two swap positions.
    const deck = mustPlayer(start, p1).deck;
    const same = createCtx(start, deps);
    swapCards(same, deck[1]!, deck[4]!);
    const after = [...deck];
    after[1] = deck[4]!;
    after[4] = deck[1]!;
    expect(mustPlayer(same.state, p1).deck).toEqual(after);
  });

  it("'when it leaves play' interrupts resolve before the swap, with the outgoing card in play and the other not", () => {
    const { state: start } = game(listeningDeps, LISTENING);
    const fog = instanceOf(start, FOG);
    const { state, events } = runCommandsPicking(start, listeningDeps, picking("fog"), useSwap(start));
    expect(weatherInPlay(state)).toEqual([fog]);
    const identity = mustInstance(state, mustPlayer(state, p1).identity.instanceId);
    // Placing 0 counters places none: the interrupt saw Clear in play and no Fog; the response, Fog and no Clear.
    expect(identity.counters).toEqual({ clearAtInterrupt: 1, fogAtResponse: 1 });
    expect(ofType(events, "cardsSwapped")).toHaveLength(1);
    expect(ofType(events, "thenSkipped")).toEqual([]);
  });

  it("is limited once per round by its ability, and replays deep-equal", () => {
    const { state: start } = game();
    const first = runCommandsPicking(start, deps, picking("fog"), useSwap(start));
    expect(() => runCommands(first.state, deps, useSwap(first.state))).toThrow(/limit/);
    const swapped = runCommandsPicking(start, deps, picking("wind"), useSwap(start), { type: "endTurn", playerId: p1 });
    expect(ofType(swapped.events, "cardsSwapped")).toHaveLength(1);
    const replayed = replay(swapped.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(swapped.session.state);
  });
});
