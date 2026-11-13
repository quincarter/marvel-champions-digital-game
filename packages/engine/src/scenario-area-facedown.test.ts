/**
 * A facedown, owner-keeping scenario out-of-play area, shaped like the community pack `mephisto-nep`'s Damnation
 * ("an out of play area shared by all players … Cards in Damnation follow the standard rules for out-of-play cards and
 * cannot be looked at except by cards from the encounter deck"), built from the Collection's `scenarioArea` plus:
 *
 * - `EffectSpec moveCards.facedown`: "Put 1[per_hero] card from the top of your deck facedown into Damnation";
 * - `CardSelector scenarioArea.random`: "look at 1 card in Damnation → shuffle it back into its owner's deck" (the
 *   cards are facedown, so the pick is blind: the seeded RNG);
 * - `RuleSpec setAsideDestination`: "When a card is set aside from a player's deck, put it facedown into Damnation
 *   instead" (Gateway to Corruption);
 * - `EffectSpec putIntoPlayFacedown.from: "discard"`: "put the top card of your discard pile facedown engaged with you as
 *   a Mystic minion" (Lilith).
 *
 * Synthetic cards only.
 */

import { flat, trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import { replay, type GameSession } from "./engine.js";
import type { CardId } from "@mc/content";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMainScheme, stubSupport } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const you = { kind: "controller" } as const;
const AREA = "Damnation";
const MYSTIC = { kind: "minion", traits: [trait("MYSTIC")] } as const;

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Create the Damnation game area. Put 2 cards from the top of your deck facedown into Damnation." */
const DAMN = actionEvent("damn", [
  { kind: "createScenarioArea", name: AREA },
  {
    kind: "moveCards",
    cards: { kind: "zone", zone: "deck", player: you, top: n(2) },
    to: { scenarioArea: AREA },
    facedown: true,
  },
]);
/** The same, faceup (the Collection's way): `facedown` absent. */
const SHOW = actionEvent("show", [
  { kind: "createScenarioArea", name: AREA },
  { kind: "moveCards", cards: { kind: "zone", zone: "deck", player: you, top: n(1) }, to: { scenarioArea: AREA } },
]);
/** "Look at 1 card in Damnation → shuffle it back into its owner's deck." */
const REDEEM = actionEvent("redeem", [
  { kind: "moveCards", cards: { kind: "scenarioArea", name: AREA, random: n(1) }, to: "deckShuffle" },
]);
/** "Set aside the top card of your deck" / "… a card from your hand" (Corruptive Offers' "set-aside … facedown"). */
const ASIDE = actionEvent("aside", [
  { kind: "moveCards", cards: { kind: "zone", zone: "deck", player: you, top: n(1) }, to: "setAside" },
]);
const ASIDE_HAND = actionEvent("aside-hand", [
  {
    kind: "moveCards",
    cards: { kind: "zone", zone: "hand", player: you, filter: { name: "trinket" } },
    to: "setAside",
  },
]);
/** "Put the top card of your discard pile facedown engaged with you as a Mystic minion" (×1, ×5). */
const SPAWN = actionEvent("spawn", [{ kind: "putIntoPlayFacedown", player: you, as: MYSTIC, from: "discard" }]);
const SPAWN_FIVE = actionEvent("spawn-five", [
  { kind: "putIntoPlayFacedown", player: you, as: MYSTIC, from: "discard", count: n(5) },
]);

const gatewayRule = (rule: Extract<RuleSpec, { kind: "setAsideDestination" }>) => {
  const definition: AbilityDefinition = { trigger: { kind: "constant", rules: [rule] }, effects: [] };
  return stubAbility(`gateway-${rule.from?.join("-") ?? "deck"}.constant`, definition);
};
/** "When a card is set aside from a player's deck, put it facedown into Damnation instead." */
const GATEWAY_RULE = gatewayRule({ kind: "setAsideDestination", area: AREA, facedown: true });
const GATEWAY = stubSupport({ id: "gateway", cost: 0, abilities: [GATEWAY_RULE.ref] });
const TRINKET = stubSupport({ id: "trinket", cost: 0 });
/**
 * "Each facedown Mystic minion engaged with a player has a base SCH of 1, a base ATK of 1, and a base hit points of 1"
 * (Call of the Demoness): without it a facedown card has no hit points and is defeated as it enters play.
 */
const FACEDOWN_MYSTICS = { categories: ["minion"], trait: trait("MYSTIC"), facedown: true } as const;
const CALL_RULE = stubAbility("call.constant", {
  trigger: {
    kind: "constant",
    modifiers: (["sch", "atk", "hp"] as const).map((stat) => ({
      stat,
      amount: 1,
      target: FACEDOWN_MYSTICS,
      setBase: true,
    })),
  },
  effects: [],
});
const CALL = stubSupport({ id: "call", cost: 0, abilities: [CALL_RULE.ref] });

/**
 * "Hidden Clause - Special: Put 1[per_hero] card from the top of your deck facedown into Damnation", a tagged ability
 * printed on the main scheme stage, resolved by other cards ("resolve the 'Hidden Clause' ability on the main scheme"):
 * `resolveSpecials` with `of` the main scheme, the tag, and the resolving player as "you".
 */
const HIDDEN_CLAUSE = stubAbility("bargain-scheme.hidden-clause", {
  trigger: { kind: "special", tag: "hiddenClause" },
  effects: [
    {
      kind: "moveCards",
      cards: { kind: "zone", zone: "deck", player: you, top: { kind: "perPlayer", base: 0, perPlayer: 1 } },
      to: { scenarioArea: AREA },
      facedown: true,
    },
  ],
});
const BARGAIN_SCHEME = stubMainScheme({
  id: "bargain-scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(20), acceleration: flat(1), abilities: [HIDDEN_CLAUSE.ref] }],
});
/** "Each player resolves the 'Hidden Clause' ability on the main scheme" (Dark Compulsions), for one player. */
const COMPULSION = actionEvent("compulsion", [
  { kind: "resolveSpecials", of: { kind: "mainScheme" }, tag: "hiddenClause", player: you },
]);

/**
 * "Forced Interrupt: When a card is put into Damnation from a player's deck, put 1 additional card into Damnation from
 * that player's deck." (Exposing Intentions.) The additional card is announced too; `sourceIs: not self` stops the
 * loop at one extra card per card.
 */
const EXPOSING_RULE = stubAbility("exposing.forced", {
  trigger: {
    kind: "response",
    forced: true,
    on: {
      on: "cardPutIntoScenarioArea",
      eventIs: { area: AREA, from: "deck" },
      sourceIs: { not: { self: true } },
    },
  },
  effects: [
    {
      kind: "moveCards",
      cards: { kind: "zone", zone: "deck", player: { kind: "eventPlayer" }, top: n(1) },
      to: { scenarioArea: AREA },
      facedown: true,
    },
  ],
});
const EXPOSING = stubSupport({ id: "exposing", cost: 0, abilities: [EXPOSING_RULE.ref] });

/** "Put a trinket from your hand facedown into Damnation." */
const HAND_DAMN = actionEvent("hand-damn", [
  {
    kind: "moveCards",
    cards: { kind: "zone", zone: "hand", player: you, filter: { name: "trinket" } },
    to: { scenarioArea: AREA },
    facedown: true,
  },
]);

const EVENTS = [DAMN, SHOW, REDEEM, ASIDE, ASIDE_HAND, SPAWN, SPAWN_FIVE, COMPULSION, HAND_DAMN];
const deps: EngineDeps = depsOf(GATEWAY_RULE, CALL_RULE, HIDDEN_CLAUSE, EXPOSING_RULE, ...EVENTS.map((e) => e.ability));

function start(players: 1 | 2 = 1, mainScheme?: typeof BARGAIN_SCHEME): GameState {
  return gameAtFirstTurn({
    cards: [GATEWAY, TRINKET, CALL, EXPOSING, ...EVENTS.map((e) => e.card)],
    deps,
    ...(mainScheme ? { mainScheme } : {}),
    deck: [
      ...copiesOf(GATEWAY.id, 1),
      ...copiesOf(CALL.id, 1),
      ...copiesOf(EXPOSING.id, 1),
      ...copiesOf(TRINKET.id, 2),
      ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
    ],
    players,
  });
}
const damnation = (state: GameState): readonly InstanceId[] => state.scenarioAreas?.[AREA] ?? [];
function expectReplays(session: GameSession) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}
/** `player`'s deck as it is once `playFree` has handed them a copy of `card` (the first copy in the deck, if any). */
function deckAfterGiving(state: GameState, card: CardId, player: PlayerId = P1): readonly InstanceId[] {
  const seat = mustPlayer(state, player);
  const isCopy = (id: InstanceId) => state.instances[id]?.cardId === card;
  if (seat.hand.some(isCopy)) return seat.deck;
  const given = seat.deck.find(isCopy);
  return seat.deck.filter((id) => id !== given);
}
/** Test surgery: the trinkets in `player`'s deck go to their discard pile (the first on top). */
function trinketsToDiscard(state: GameState, player: PlayerId = P1): GameState {
  const seat = mustPlayer(state, player);
  const moved = seat.deck.filter((id) => state.instances[id]?.cardId === TRINKET.id);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player
        ? { ...p, deck: p.deck.filter((id) => !moved.includes(id)), discard: [...moved, ...p.discard] }
        : p,
    ),
    instances: {
      ...state.instances,
      ...Object.fromEntries(moved.map((id) => [id, { ...mustInstance(state, id), faceup: true }])),
    },
  };
}

describe("a facedown scenario area (moveCards.facedown)", () => {
  it("the top 2 cards of your deck go facedown into the area, keeping their owner", () => {
    const before = start();
    const top = deckAfterGiving(before, DAMN.card.id).slice(0, 2);
    const { state, session } = playFree(before, deps, DAMN.card.id);
    expect(damnation(state)).toEqual(top);
    for (const id of top) {
      expect(mustInstance(state, id).faceup).toBe(false);
      expect(mustInstance(state, id).ownerId).toBe(P1);
    }
    expect(mustPlayer(state, P1).deck).not.toContain(top[0]);
    expectReplays(session);
  });

  it("without the flag, cards go in faceup, as The Collection's do", () => {
    const { state } = playFree(start(), deps, SHOW.card.id);
    expect(damnation(state)).toHaveLength(1);
    expect(mustInstance(state, damnation(state)[0]!).faceup).toBe(true);
  });
});

describe("a random pick from a scenario area (scenarioArea.random)", () => {
  it("1 card at random goes back into its owner's deck, shuffled; the replay is identical", () => {
    const damned = playFree(start(), deps, DAMN.card.id).state;
    const deckBefore = deckAfterGiving(damned, REDEEM.card.id).length;
    const { state, session } = playFree(damned, deps, REDEEM.card.id);
    expect(damnation(state)).toHaveLength(1);
    const back = damnation(damned).find((id) => !damnation(state).includes(id))!;
    expect(mustPlayer(state, P1).deck).toContain(back);
    expect(mustPlayer(state, P1).deck).toHaveLength(deckBefore + 1);
    expectReplays(session);
  });

  it("each card goes to its own owner's deck in a two-player game", () => {
    let state = playFree(start(2), deps, DAMN.card.id).state;
    state = playFree(state, deps, DAMN.card.id, P2).state;
    const p2Cards = damnation(state).filter((id) => mustInstance(state, id).ownerId === P2);
    expect(p2Cards).toHaveLength(2);
    // Drain the area: every card ends in its owner's deck.
    for (let i = 0; i < 4; i++) state = playFree(state, deps, REDEEM.card.id).state;
    expect(damnation(state)).toEqual([]);
    for (const id of p2Cards) expect(mustPlayer(state, P2).deck).toContain(id);
  });

  it("an empty area picks nothing and draws nothing from the RNG", () => {
    const created = playFree(start(), deps, SHOW.card.id).state;
    const emptied = playFree(created, deps, REDEEM.card.id).state;
    const { state } = playFree(emptied, deps, REDEEM.card.id);
    expect(damnation(state)).toEqual([]);
  });
});

describe("a set-aside redirect (RuleSpec setAsideDestination)", () => {
  it("without the rule, a card set aside from the deck goes to its owner's set-aside area", () => {
    const before = start();
    const top = deckAfterGiving(before, ASIDE.card.id)[0]!;
    const { state } = playFree(before, deps, ASIDE.card.id);
    expect(mustPlayer(state, P1).setAside).toContain(top);
  });

  it("with the rule in play, it goes facedown into the area instead, logged as setAsideRedirected", () => {
    const placed = playerCardIntoPlay(playFree(start(), deps, SHOW.card.id).state, GATEWAY.id);
    const top = deckAfterGiving(placed.state, ASIDE.card.id)[0]!;
    const { state, events, session } = playFree(placed.state, deps, ASIDE.card.id);
    expect(damnation(state)).toContain(top);
    expect(mustInstance(state, top).faceup).toBe(false);
    expect(mustPlayer(state, P1).setAside).not.toContain(top);
    expect(events).toContainEqual({
      type: "setAsideRedirected",
      instanceId: top,
      area: AREA,
      sourceInstanceId: placed.id,
    });
    expectReplays(session);
  });

  it("a card set aside from a zone the rule does not name (the hand) is set aside as normal", () => {
    const placed = playerCardIntoPlay(playFree(start(), deps, SHOW.card.id).state, GATEWAY.id);
    const inHand = giveCard(placed.state, P1, TRINKET.id);
    const { state } = playFree(inHand.state, deps, ASIDE_HAND.card.id);
    expect(mustPlayer(state, P1).setAside).toContain(inHand.id);
    expect(damnation(state)).not.toContain(inHand.id);
  });
});

describe("a facedown minion from the discard pile (putIntoPlayFacedown.from)", () => {
  it("the top card of your discard pile enters play facedown, engaged with you, as a Mystic minion", () => {
    const before = trinketsToDiscard(playerCardIntoPlay(start(), CALL.id).state);
    const top = mustPlayer(before, P1).discard[0]!;
    const { state, events, session } = playFree(before, deps, SPAWN.card.id);
    expect(mustPlayer(state, P1).playArea).toContain(top);
    const minion = mustInstance(state, top);
    expect(minion).toMatchObject({ faceup: false, engagedWith: P1, controllerId: null, facedownAs: MYSTIC });
    expect(mustPlayer(state, P1).discard).not.toContain(top);
    expect(events).toContainEqual({
      type: "cardPutIntoPlayFacedown",
      instanceId: top,
      playerId: P1,
      as: "minion",
      from: "discard",
    });
    expectReplays(session);
  });

  it("a count above the pile size stops when it is empty; the deck is not touched", () => {
    const before = trinketsToDiscard(playerCardIntoPlay(start(), CALL.id).state);
    const deck = deckAfterGiving(before, SPAWN_FIVE.card.id);
    const { state } = playFree(before, deps, SPAWN_FIVE.card.id);
    const spawned = mustPlayer(state, P1).playArea.filter((id) => mustInstance(state, id).facedownAs !== null);
    expect(spawned).toHaveLength(mustPlayer(before, P1).discard.length);
    // Only the event itself, discarded once it resolved, is left there.
    expect(mustPlayer(state, P1).discard.map((id) => mustInstance(state, id).cardId)).toEqual([SPAWN_FIVE.card.id]);
    expect(mustPlayer(state, P1).deck).toEqual(deck);
  });

  it("an empty discard pile puts nothing into play and resets nothing", () => {
    const before = playerCardIntoPlay(start(), CALL.id).state;
    const deck = deckAfterGiving(before, SPAWN.card.id);
    const { state, events } = playFree(before, deps, SPAWN.card.id);
    expect(events.some((e) => e.type === "cardPutIntoPlayFacedown")).toBe(false);
    expect(mustPlayer(state, P1).deck).toEqual(deck);
  });
});

describe("a tagged main scheme ability resolved by another card ('Hidden Clause')", () => {
  it("resolves the stage's tagged Special with the resolving player as 'you': 1 per hero card into the area", () => {
    const before = start(2, BARGAIN_SCHEME);
    const top = deckAfterGiving(before, COMPULSION.card.id).slice(0, 2);
    const { state, session } = playFree(before, deps, COMPULSION.card.id);
    expect(damnation(state)).toEqual(top);
    for (const id of top) expect(mustInstance(state, id)).toMatchObject({ ownerId: P1, faceup: false });
    expectReplays(session);
  });
});

describe("a card put into a scenario area is announced (TriggerEvent cardPutIntoScenarioArea)", () => {
  const announced = (events: readonly { readonly type: string }[]) =>
    JSON.stringify(events).includes("cardPutIntoScenarioArea");

  it("nothing listening: the move announces nothing", () => {
    const { events } = playFree(start(), deps, DAMN.card.id);
    expect(announced(events)).toBe(false);
  });

  it("'put 1 additional card from that player's deck' for each card: 2 become 4, and the extra ones do not loop", () => {
    const placed = playerCardIntoPlay(start(), EXPOSING.id);
    const top = deckAfterGiving(placed.state, DAMN.card.id).slice(0, 4);
    const { state, session } = playFree(placed.state, deps, DAMN.card.id);
    expect([...damnation(state)].sort()).toEqual([...top].sort());
    for (const id of top) expect(mustInstance(state, id)).toMatchObject({ ownerId: P1, faceup: false });
    expectReplays(session);
  });

  it("a set-aside redirect is a card put into the area from the deck too", () => {
    const placed = playerCardIntoPlay(start(), EXPOSING.id);
    const withGateway = playerCardIntoPlay(placed.state, GATEWAY.id);
    const { state } = playFree(withGateway.state, deps, ASIDE.card.id);
    expect(damnation(state)).toHaveLength(2);
  });

  it("a card from another zone does not match 'from a player's deck'", () => {
    const placed = playerCardIntoPlay(start(), EXPOSING.id);
    const inHand = giveCard(placed.state, P1, TRINKET.id);
    const { state } = playFree(inHand.state, deps, HAND_DAMN.card.id);
    expect(damnation(state)).toEqual([inHand.id]);
  });
});
