/**
 * docs/phase7-wave9.md §3.24: `EffectSpec rotateEngagement`, "Each player engages each minion engaged with the player
 * clockwise from them" (The Coming Storm, Rumbling Thunder, Parcours du Combattant, `aos` 50135, 50136, 50164), with
 * synthetic cards shaped like the set those cards sit beside: Batroc 50161 ("Forced Interrupt: When Batroc engages you,
 * discard 1 card from your hand") and Coup de Foudre 50162 ("Forced Interrupt: When a minion engages a player, that
 * player discards the top X cards of their deck, where X is the number of boost icons on that minion. Place 1 threat
 * here for each printed [energy] resource discarded this way").
 *
 * Sources: RRG 1.8 "Engage" (p. 18): "An engaged minion remains engaged with the same player until it is defeated,
 * removed from play, or a card ability causes it to engage another player"; "If a card ability instructs a player to
 * engage a minion, that minion is also considered to have engaged that player"; "While a minion is engaged with a
 * player, card abilities cannot cause the minion to engage with the same player again". "Quickstrike" (p. 36): "After a
 * minion with the quickstrike keyword engages a player whose identity is in hero form, that minion attacks that
 * player". "In Player Order" (p. 24); "Player Elimination" (p. 34).
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { playerId } from "./ids.js";
import { minionsEngagedWith, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import {
  stubEnvironment,
  stubEvent,
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubUpgrade,
} from "./testing/fixtures.js";
import { giveCard, TREACHERY } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  P2,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const P3: PlayerId = playerId("p3");
const self: TargetRef = { kind: "self" };
const slot = (name: string): TargetRef => ({ kind: "slot", slot: name });
const n = (value: number): ValueSpec => ({ kind: "const", value });
const eventPlayer = { kind: "eventPlayer" } as const;
const eventTarget: TargetRef = { kind: "eventTarget" };

const SCHEME = stubMainScheme({
  id: "calm",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const minion = (id: string, more: Partial<Parameters<typeof stubMinion>[0]> = {}) =>
  stubMinion({ id, atk: 1, sch: 1, hp: 5, boostIcons: 0, ...more });
const A = minion("minion-a");
const B = minion("minion-b");
const C = minion("minion-c");
/** "Toughness. Quickstrike." ATK 2. */
const STRIKER = minion("striker", { atk: 2, keywords: [{ name: "toughness" }, { name: "quickstrike" }] });
/** Four boost icons. */
const HEAVY = minion("heavy", { boostIcons: 4 });

const BATROC_ENGAGES = stubAbility("batroc.engages", {
  trigger: { kind: "interrupt", forced: true, on: { on: "minionEngaged", selfIs: "target" } },
  effects: [{ kind: "discardFromHand", player: eventPlayer, amount: n(1) }],
});
const BATROC = minion("batroc", { abilities: [BATROC_ENGAGES.ref] });

const COUP_DE_FOUDRE = stubAbility("coup-de-foudre.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "minionEngaged" } },
  effects: [
    {
      kind: "moveCards",
      cards: { kind: "zone", zone: "deck", player: eventPlayer, top: { kind: "boostIcons", of: eventTarget } },
      to: "discard",
      bind: "discarded",
    },
    {
      kind: "placeThreat",
      target: self,
      amount: { kind: "totalPrintedResources", cards: slot("discarded"), types: ["energy"] },
    },
  ],
});
const COUP = stubSideScheme({ id: "coup-de-foudre", startingThreat: 0, abilities: [COUP_DE_FOUDRE.ref] });

/** "Response: After a minion engages you, place 1 counter here." One per player who controls a copy. */
const LOOKOUT_RESPONSE = stubAbility("lookout.response", {
  trigger: { kind: "response", forced: true, on: { on: "minionEngaged", playerIs: "controller" } },
  effects: [{ kind: "addCounters", target: self, counterType: "seen", amount: n(1) }],
});
const LOOKOUT = stubSupport({ id: "lookout", cost: 0, abilities: [LOOKOUT_RESPONSE.ref] });
const SNARE = { ...stubUpgrade({ id: "snare", cost: 0 }), attachesTo: { kind: "minion" as const } };
const ENERGY = stubEvent({ id: "energy", cost: 0, resourceIcons: { energy: 1 } });
const MENTAL = stubEvent({ id: "mental", cost: 0, resourceIcons: { mental: 1 } });
const HOLDER = stubEnvironment({ id: "holder", name: "Holder" });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const ROTATE = event("rotate", [{ kind: "rotateEngagement", from: "nextPlayer" }]);
const HOLD_A = event("hold-a", [
  { kind: "attach", card: { kind: "named", name: A.name }, to: { kind: "named", name: "Holder" }, as: "heldMinion" },
]);
/** Get Over Here!: "engage that enemy". */
const PULL = event("pull", [
  { kind: "engage", minion: { kind: "named", name: STRIKER.name }, player: { kind: "controller" } },
]);
const EVENTS = [ROTATE, HOLD_A, PULL];

const deps: EngineDeps = depsOf(BATROC_ENGAGES, COUP_DE_FOUDRE, LOOKOUT_RESPONSE, ...EVENTS.map((e) => e.ability));
const ENCOUNTER_CARDS = [A, B, C, STRIKER, HEAVY, BATROC, COUP, HOLDER];

function game(players: 1 | 2 | 3): GameState {
  return gameAtFirstTurn({
    cards: [...ENCOUNTER_CARDS, SCHEME, LOOKOUT, SNARE, ENERGY, MENTAL, ...EVENTS.map((e) => e.card)],
    deps,
    players,
    mainScheme: SCHEME,
    encounter: [...ENCOUNTER_CARDS.map((card) => card.id), ...copiesOf(TREACHERY.id, 20)],
    deck: [LOOKOUT.id, SNARE.id, ...copiesOf(ENERGY.id, 8), ...copiesOf(MENTAL.id, 8), ...EVENTS.map((e) => e.card.id)],
  });
}
/** Engages `card` with `player` (surgery) and returns the state with the ids so far. */
const engaged = (
  state: GameState,
  ids: Record<string, InstanceId>,
  card: { readonly id: CardId },
  player: PlayerId,
): GameState => {
  const placed = minionEngagedWith(state, card.id, player);
  ids[card.id] = placed.id;
  return placed.state;
};
const rotate = (state: GameState, player: PlayerId = P1) => playFree(state, deps, ROTATE.card.id, player);
const rotations = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "engagementRotated" ? [e.moves] : []));
const engagementsAnnounced = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "minionEngaged"
      ? [{ minion: e.event.minionInstanceId, player: e.event.playerId }]
      : [],
  );
const entersPlay = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "triggerEvent" && e.event.kind === "cardEntersPlay");
const expectReplays = (session: GameSession): void => {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
};
/** Puts copies of these cards from `player`'s deck on top of it, first on top (surgery). */
function onTopOfDeck(state: GameState, player: PlayerId, cards: readonly CardId[]): GameState {
  const seat = mustPlayer(state, player);
  const rest = [...seat.deck];
  const top = cards.map((card) => {
    const at = rest.findIndex((id) => mustInstance(state, id).cardId === card);
    if (at < 0) throw new Error(`no ${card} in the deck`);
    return rest.splice(at, 1)[0]!;
  });
  return {
    ...state,
    players: state.players.map((p) => (p.playerId === player ? { ...p, deck: [...top, ...rest] } : p)),
  };
}

describe("§3.24 rotateEngagement: every engaged minion moves at once", () => {
  it("three players: player 1 takes B and C from player 2, player 2 none from player 3, player 3 takes A", () => {
    const ids: Record<string, InstanceId> = {};
    let state = game(3);
    state = engaged(state, ids, A, P1);
    state = engaged(state, ids, B, P2);
    state = engaged(state, ids, C, P2);
    const [a, b, c] = [ids[A.id]!, ids[B.id]!, ids[C.id]!];
    const { state: after, events, session } = rotate(state);
    expect(minionsEngagedWith(after, P1)).toEqual([b, c]);
    expect(minionsEngagedWith(after, P2)).toEqual([]);
    expect(minionsEngagedWith(after, P3)).toEqual([a]);
    expect([a, b, c].map((id) => mustInstance(after, id).engagedWith)).toEqual([P3, P1, P1]);
    // One log event for the whole change, the first player's new minions first.
    expect(rotations(events)).toEqual([
      [
        { instanceId: b, from: P2, to: P1 },
        { instanceId: c, from: P2, to: P1 },
        { instanceId: a, from: P1, to: P3 },
      ],
    ]);
    // No minion entered play, and with nothing listening nothing is announced.
    expect(entersPlay(events)).toEqual([]);
    expect(engagementsAnnounced(events)).toEqual([]);
    expectReplays(session);
  });

  it("two players swap their minions, which keep everything on them", () => {
    const ids: Record<string, InstanceId> = {};
    let state = game(2);
    state = engaged(state, ids, A, P1);
    state = engaged(state, ids, B, P2);
    const [a, b] = [ids[A.id]!, ids[B.id]!];
    const given = giveCard(state, P1, SNARE.id);
    state = runCommands(given.state, deps, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: a,
    }).state;
    state = {
      ...state,
      instances: {
        ...state.instances,
        [a]: { ...mustInstance(state, a), damage: 3, statuses: { ...mustInstance(state, a).statuses, stunned: 1 } },
      },
    };
    const { state: after, events } = rotate(state);
    expect(minionsEngagedWith(after, P1)).toEqual([b]);
    expect(minionsEngagedWith(after, P2)).toEqual([a]);
    expect(mustInstance(after, a)).toMatchObject({ damage: 3, attachments: [given.id], engagedWith: P2 });
    expect(mustInstance(after, a).statuses.stunned).toBe(1);
    expect(rotations(events)).toHaveLength(1);
  });

  it("one player: nothing moves, nothing is logged or announced", () => {
    const ids: Record<string, InstanceId> = {};
    let state = engaged(game(1), ids, BATROC, P1);
    state = playerCardIntoPlay(state, LOOKOUT.id, P1).state;
    const hand = mustPlayer(state, P1).hand.length;
    const { state: after, events } = rotate(state);
    expect(minionsEngagedWith(after, P1)).toEqual([ids[BATROC.id]]);
    expect(rotations(events)).toEqual([]);
    expect(engagementsAnnounced(events)).toEqual([]);
    expect(mustPlayer(after, P1).hand.length).toBe(hand);
  });

  it("an eliminated player is not in player order: the two players left swap", () => {
    const ids: Record<string, InstanceId> = {};
    let state = game(3);
    state = engaged(state, ids, A, P1);
    state = engaged(state, ids, B, P3);
    state = { ...state, players: state.players.map((p) => (p.playerId === P2 ? { ...p, eliminated: true } : p)) };
    const after = rotate(state).state;
    expect(minionsEngagedWith(after, P1)).toEqual([ids[B.id]]);
    expect(minionsEngagedWith(after, P3)).toEqual([ids[A.id]]);
  });

  it("a minion an environment holds is engaged with nobody and stays (§3.21)", () => {
    const ids: Record<string, InstanceId> = {};
    let state = game(2);
    const holder = encounterCardInVillainArea(state, HOLDER.id);
    state = engaged(holder.state, ids, A, P1);
    state = engaged(state, ids, B, P1);
    state = playFree(state, deps, HOLD_A.card.id).state;
    const { state: after, events } = rotate(state);
    expect(mustInstance(after, ids[A.id]!)).toMatchObject({
      attachedTo: holder.id,
      engagedWith: null,
      heldMinion: true,
    });
    expect(minionsEngagedWith(after, P2)).toEqual([ids[B.id]]);
    expect(rotations(events)).toEqual([[{ instanceId: ids[B.id], from: P1, to: P2 }]]);
  });
});

describe("§3.24 each minion that moved engaged its new player (RRG 1.8 'Engage', p. 18)", () => {
  it("Batroc moving to a new player: 'When Batroc engages you, discard 1 card from your hand'", () => {
    const ids: Record<string, InstanceId> = {};
    const state = engaged(game(2), ids, BATROC, P1);
    const hands = [P1, P2].map((p) => mustPlayer(state, p).hand.length);
    const { state: after, events, session } = rotate(state);
    expect(mustInstance(after, ids[BATROC.id]!).engagedWith).toBe(P2);
    expect([P1, P2].map((p) => mustPlayer(after, p).hand.length)).toEqual([hands[0], hands[1]! - 1]);
    expect(engagementsAnnounced(events)).toEqual([{ minion: ids[BATROC.id], player: P2 }]);
    expectReplays(session);
  });

  it("Coup de Foudre: a minion with 4 boost icons moves, its new player discards 4 cards, 1 threat per [energy]", () => {
    const ids: Record<string, InstanceId> = {};
    let state = game(2);
    const coup = encounterCardInVillainArea(state, COUP.id);
    state = engaged(coup.state, ids, HEAVY, P1);
    state = onTopOfDeck(state, P2, [ENERGY.id, MENTAL.id, ENERGY.id, ENERGY.id, MENTAL.id]);
    const before = { deck: mustPlayer(state, P2).deck.length, discard: mustPlayer(state, P2).discard.length };
    const mine = { deck: mustPlayer(state, P1).deck.length };
    const after = rotate(state).state;
    expect(mustPlayer(after, P2).deck.length).toBe(before.deck - 4);
    expect(mustPlayer(after, P2).discard.length).toBe(before.discard + 4);
    // Player 1 discards nothing: the one card gone from their deck is the event the test took from it.
    expect(mustPlayer(after, P1).deck.length).toBe(mine.deck - 1);
    expect(mustInstance(after, coup.id).threat).toBe(3);
  });

  it("the engagements resolve in player order of the new player, with every minion already moved", () => {
    const ids: Record<string, InstanceId> = {};
    let state = game(3);
    for (const player of [P1, P2, P3]) state = playerCardIntoPlay(state, LOOKOUT.id, player).state;
    state = engaged(state, ids, A, P1);
    state = engaged(state, ids, B, P2);
    state = engaged(state, ids, C, P3);
    const { state: after, events } = rotate(state);
    expect(engagementsAnnounced(events)).toEqual([
      { minion: ids[B.id], player: P1 },
      { minion: ids[C.id], player: P2 },
      { minion: ids[A.id], player: P3 },
    ]);
    // "After a minion engages you": once for each player.
    const seen = Object.values(after.instances)
      .filter((i) => i.cardId === LOOKOUT.id && i.controllerId !== null && (i.counters.seen ?? 0) > 0)
      .map((i) => [i.controllerId, i.counters.seen]);
    expect(seen).toEqual([
      [P1, 1],
      [P2, 1],
      [P3, 1],
    ]);
  });

  it("quickstrike (RRG 1.8 p. 36): the minion attacks a new player in hero form, not one in alter-ego form", () => {
    const ids: Record<string, InstanceId> = {};
    const state = engaged(game(2), ids, STRIKER, P2);
    const striker = ids[STRIKER.id]!;
    const identity = mustPlayer(state, P1).identity.instanceId;
    // Alter-ego: it engages player 1 and does not attack.
    const calm = rotate(state);
    expect(mustInstance(calm.state, striker).engagedWith).toBe(P1);
    expect(mustInstance(calm.state, identity).damage).toBe(0);
    expect(calm.events.some((e) => e.type === "enemyActivated")).toBe(false);
    // Hero form: it attacks for 2. It did not enter play, so toughness gives it no status card.
    const hero = runCommands(state, deps, { type: "changeForm", playerId: P1 }).state;
    const struck = rotate(hero);
    expect(mustInstance(struck.state, identity).damage).toBe(2);
    expect(mustInstance(struck.state, striker).statuses.tough).toBe(0);
    expect(entersPlay(struck.events)).toEqual([]);
    expectReplays(struck.session);
  });

  it("`engage` of a minion already in play is the same engagement: quickstrike attacks the hero-form player", () => {
    const ids: Record<string, InstanceId> = {};
    const state = engaged(game(2), ids, STRIKER, P2);
    const identity = mustPlayer(state, P1).identity.instanceId;
    const hero = runCommands(state, deps, { type: "changeForm", playerId: P1 }).state;
    const pulled = playFree(hero, deps, PULL.card.id, P1);
    expect(mustInstance(pulled.state, ids[STRIKER.id]!).engagedWith).toBe(P1);
    expect(mustInstance(pulled.state, identity).damage).toBe(2);
    expect(entersPlay(pulled.events)).toEqual([]);
    const calm = playFree(state, deps, PULL.card.id, P1);
    expect(mustInstance(calm.state, identity).damage).toBe(0);
  });
});
