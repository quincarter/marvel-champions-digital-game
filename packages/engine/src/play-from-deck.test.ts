/**
 * docs/phase7-wave6.md §3.70: playing a card searched from your deck (`EffectSpec playFromHand { from: "deck" }`).
 * Synthetic cards shaped like Fetch Quest (39045, erratum RRG 1.8 p. 69: "When Defeated: In player order, each player
 * may search their deck for a card and play that card, ignoring its resource cost. (Shuffle.)").
 *
 * Sources: RRG 1.8 "Search" (p. 39): the whole deck is searched and shuffled "upon completion of that game step";
 * "Requirement (Resources)" (p. 37): never played ignoring its cost; "Action" (p. 6): only during a player's turn.
 */

import { cardId, flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const fetch: EffectSpec = {
  kind: "forEachPlayer",
  players: { kind: "each" },
  effects: [{ kind: "playFromHand", player: { kind: "scoped" }, from: "deck", ignoreCost: true, optional: true }],
};
const FETCH_ACTION = stubAbility("fetch.action", { trigger: { kind: "action" }, effects: [fetch] });
const FETCH = stubEvent({ id: "fetch", cost: 0, abilities: [FETCH_ACTION.ref] });
const FETCH_REVEALED = stubAbility("fetch-quest.revealed", { trigger: { kind: "whenRevealed" }, effects: [fetch] });
const FETCH_QUEST = stubTreachery({ id: "fetch-quest", abilities: [FETCH_REVEALED.ref] });

const ZAP_ACTION = stubAbility("zap.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 2 } }],
});
const ZAP = stubEvent({ id: "zap", cost: 3, abilities: [ZAP_ACTION.ref] });
const BIG_ALLY = stubAlly({ id: "big-ally", cost: 5, atk: 1, thw: 1, hp: 3 });
const REQUIRES = stubSupport({
  id: "requires",
  cost: 1,
  keywords: [{ name: "requirement", resources: { mental: 1 } } as never],
});
const VILLAIN = stubVillain({ id: "fetch-villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });

const deps: EngineDeps = depsOf(FETCH_ACTION, FETCH_REVEALED, ZAP_ACTION);
const CARDS = [FETCH, FETCH_QUEST, ZAP, BIG_ALLY, REQUIRES, VILLAIN];
const DECK = [
  ...copiesOf(FETCH.id, 1),
  ...copiesOf(ZAP.id, 1),
  ...copiesOf(BIG_ALLY.id, 1),
  ...copiesOf(REQUIRES.id, 1),
];

function start(players: 1 | 2 = 1, encounter?: readonly string[]): GameState {
  const state = gameAtFirstTurn({
    cards: CARDS,
    deps,
    villain: VILLAIN,
    deck: DECK,
    players,
    ...(encounter ? { encounter: encounter.map((id) => cardId(id)) } : {}),
  });
  // Test surgery: the searched cards start in the deck, not the opening hand.
  const searched = new Set<string>([ZAP.id, BIG_ALLY.id, REQUIRES.id]);
  const isSearched = (id: string) => searched.has(String(state.instances[id as never]?.cardId));
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      identity: { ...p.identity, form: "hero" },
      hand: p.hand.filter((id) => !isSearched(id)),
      deck: [...p.deck, ...p.hand.filter((id) => isSearched(id))],
    })),
  };
}

/** Answers each deck-play prompt with `want` (a card id, or null to decline), recording what was offered. */
function picker(want: (state: GameState) => string | null) {
  const offered: { player: string; cards: string[] }[] = [];
  const pick = (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind !== "chooseCards" || choice.prompt.slot !== "playFromHand") return defaultPick(state);
    const cards = choice.options.map((o) => String(state.instances[o.optionId as never]?.cardId));
    offered.push({ player: String(choice.playerId), cards });
    const wanted = want(state);
    const option = choice.options.find((o) => String(state.instances[o.optionId as never]?.cardId) === wanted);
    return option ? [option.optionId] : [];
  };
  return { offered, pick };
}

function playFetch(state: GameState, want: (state: GameState) => string | null) {
  const given = giveCard(state, P1, FETCH.id);
  const { offered, pick } = picker(want);
  const { session, events } = driveSession(
    startSession(given.state),
    deps,
    [{ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
    pick,
  );
  return { session, state: session.state, events, offered };
}

const cardsIn = (state: GameState, ids: readonly string[]) =>
  ids.map((id) => String(state.instances[id as never]?.cardId));
const shuffles = (events: readonly GameEvent[], player = P1) =>
  events.filter((e) => e.type === "deckShuffled" && e.zone.kind === "deck" && e.zone.playerId === player);

describe("§3.70 playing a card searched from your deck", () => {
  it("offers only cards that could be played now, plays one ignoring its cost; replay deep-equal", () => {
    const { state, session, offered } = playFetch(start(), () => BIG_ALLY.id);
    expect(offered).toHaveLength(1);
    expect(offered[0]!.cards).toContain(BIG_ALLY.id);
    expect(offered[0]!.cards).toContain(ZAP.id);
    // RRG 1.8 "Requirement (Resources)" (p. 37): never played ignoring its cost.
    expect(offered[0]!.cards).not.toContain(REQUIRES.id);
    expect(cardsIn(state, mustPlayer(state, P1).playArea)).toContain(BIG_ALLY.id);
    expect(cardsIn(state, mustPlayer(state, P1).deck)).not.toContain(BIG_ALLY.id);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("shuffles the deck once the played card has resolved", () => {
    const { events } = playFetch(start(), () => ZAP.id);
    const damage = events.findIndex((e) => e.type === "damageDealt");
    const shuffled = events.indexOf(shuffles(events)[0]!);
    expect(damage).toBeGreaterThanOrEqual(0);
    expect(shuffles(events)).toHaveLength(1);
    expect(shuffled).toBeGreaterThan(damage);
  });

  it("may be declined: nothing is played and the deck is still shuffled", () => {
    const before = start();
    const deckSize = mustPlayer(giveCard(before, P1, FETCH.id).state, P1).deck.length;
    const { state, events } = playFetch(before, () => null);
    expect(events.filter((e) => e.type === "cardPlayed")).toHaveLength(1); // the fetch event itself
    expect(mustPlayer(state, P1).deck).toHaveLength(deckSize);
    expect(shuffles(events)).toHaveLength(1);
  });

  it("each player, in player order, searches their own deck", () => {
    const { state, offered, events } = playFetch(start(2), () => BIG_ALLY.id);
    expect(offered.map((o) => o.player)).toEqual([String(P1), String(P2)]);
    expect(cardsIn(state, mustPlayer(state, P2).playArea)).toContain(BIG_ALLY.id);
    expect(shuffles(events, P2)).toHaveLength(1);
  });

  it("outside a player's turn, an Action event is not offered", () => {
    const { offered, pick } = picker(() => BIG_ALLY.id);
    const state = start(1, copiesOf(FETCH_QUEST.id, 5) as unknown as string[]);
    const { session } = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }], pick);
    expect(offered.length).toBeGreaterThan(0);
    expect(offered[0]!.cards).toContain(BIG_ALLY.id);
    expect(offered[0]!.cards).not.toContain(ZAP.id);
    expect(cardsIn(session.state, mustPlayer(session.state, P1).playArea)).toContain(BIG_ALLY.id);
  });
});
