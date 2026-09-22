/**
 * docs/phase7-wave3.md §3.14: a scenario out-of-play area (`ZoneId scenarioArea`, `createScenarioArea`) and the
 * discard-from-play redirect (`RuleSpec discardFromPlayDestination`). Synthetic cards shaped like Infiltrate the Museum:
 * The Grand Collection 1A ("Create 'The Collection' game area"), 1B ("discard 1 card from The Collection (to its owner's
 * discard pile)"; "If there are at least 5 cards in The Collection … the players lose the game"), and Collector I–III
 * ("Forced Interrupt: When a card (player or encounter) would be placed into a discard pile from play, put it faceup into
 * The Collection instead", III adding "then place 1 threat on the main scheme").
 *
 * Sources: MC16 p. 10 ("The Collection"); MC16 FAQ p. 21 (which cards the redirect catches); RRG 1.8 FAQ "Rocket
 * Raccoon (#29A)" (p. 61); ruling Feb 28, 2026 (8).
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, locateCard, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubSupport, stubVillain } from "./testing/fixtures.js";
import { ALLY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const AREA = "The Collection";
const mainScheme: TargetRef = { kind: "mainScheme" };

const COLLECTOR_RULE = stubAbility("collector.constant", {
  trigger: { kind: "constant", rules: [{ kind: "discardFromPlayDestination", cards: {}, area: AREA }] },
  effects: [],
});
const COLLECTOR = stubVillain({
  id: "collector",
  stages: [{ hp: flat(40), atk: 1, sch: 1, abilities: [COLLECTOR_RULE.ref] }],
});
/** Collector III's "…, then place 1 threat on the main scheme", as a response to the redirect. */
const CURATOR_RESPONSE = stubAbility("curator.response", {
  trigger: { kind: "response", forced: true, on: { on: "discardRedirected" } },
  effects: [{ kind: "placeThreat", target: mainScheme, amount: n(1) }],
});
const CURATOR = stubSupport({ id: "curator", cost: 0, abilities: [CURATOR_RESPONSE.ref] });
const GRUNT = stubMinion({ id: "grunt", atk: 1, sch: 1, hp: 2 });
const BOUNTY = stubMinion({ id: "bounty", atk: 1, sch: 1, hp: 2, keywords: [{ name: "victory", value: 1 }] });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const CREATE = actionEvent("create", [{ kind: "createScenarioArea", name: AREA }]);
const SMASH = actionEvent("smash", [
  { kind: "dealDamage", target: { kind: "each", query: { categories: ["minion"] } }, amount: n(5) },
]);
const DISMISS = actionEvent("dismiss", [
  { kind: "discardFromPlay", target: { kind: "each", query: { categories: ["ally"] } } },
]);
/** "Discard 1 card from The Collection (to its owner's discard pile)." */
const RECLAIM = actionEvent("reclaim", [
  {
    kind: "chooseCards",
    slot: "back",
    from: { kind: "scenarioArea", name: AREA },
    chooser: { kind: "controller" },
    min: 1,
    max: 1,
  },
  { kind: "moveCards", cards: { kind: "ref", ref: { kind: "slot", slot: "back" } }, to: "discard" },
]);
/** Records the count of cards in The Collection on the curator. */
const COUNT = actionEvent("count", [
  {
    kind: "addCounters",
    target: { kind: "each", query: { categories: ["support"], name: "curator" } },
    counterType: "collected",
    amount: { kind: "scenarioAreaCount", name: AREA },
  },
]);
/** "Put the top card of your deck faceup into The Collection." — a card entering the area from out of play. */
const TOP_CARD = actionEvent("top-card", [
  {
    kind: "moveCards",
    cards: { kind: "zone", zone: "deck", player: { kind: "controller" }, top: n(1) },
    to: { scenarioArea: AREA },
  },
]);
const EVENTS = [CREATE, SMASH, DISMISS, RECLAIM, COUNT, TOP_CARD];

const deps: EngineDeps = depsOf(COLLECTOR_RULE, CURATOR_RESPONSE, ...EVENTS.map((e) => e.ability));
const CARDS = [COLLECTOR, CURATOR, GRUNT, BOUNTY, ...EVENTS.map((e) => e.card)];
const ENCOUNTER: readonly CardId[] = [GRUNT.id, BOUNTY.id, ...copiesOf(GRUNT.id, 10)];

function start(): { state: GameState; curator: InstanceId } {
  const base = gameAtFirstTurn({
    cards: CARDS,
    deps,
    villain: COLLECTOR,
    encounter: ENCOUNTER,
    deck: [CURATOR.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
  });
  const created = playFree(base, deps, CREATE.card.id).state;
  const placed = playerCardIntoPlay(created, CURATOR.id);
  return { state: placed.state, curator: placed.id };
}
const collection = (state: GameState): readonly InstanceId[] => state.scenarioAreas?.[AREA] ?? [];
const mainThreat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;

describe("§3.14 The Collection: a scenario out-of-play area", () => {
  it("is created empty, and a card put into it lies faceup, out of play", () => {
    const { state } = start();
    expect(collection(state)).toEqual([]);
    const after = playFree(state, deps, TOP_CARD.card.id).state;
    const [card] = collection(after);
    expect(card).toBeDefined();
    expect(locateCard(after, card!)).toEqual({ kind: "scenarioArea", name: AREA });
    expect(mustInstance(after, card!).faceup).toBe(true);
  });

  it("a card discarded from play goes into it instead, and the redirect is announced", () => {
    const { state } = start();
    const grunt = minionEngagedWith(state, GRUNT.id);
    const threatBefore = mainThreat(grunt.state);
    const { state: after, events } = playFree(grunt.state, deps, SMASH.card.id);
    expect(collection(after)).toContain(grunt.id);
    expect(activeEncounterDeck(after).discard).not.toContain(grunt.id);
    expect(events).toContainEqual(expect.objectContaining({ type: "cardDiscardedFromPlay", instanceId: grunt.id }));
    // Collector III's "then place 1 threat on the main scheme".
    expect(mainThreat(after)).toBe(threatBefore + 1);
  });

  it("a player card discarded from play goes there too", () => {
    const { state } = start();
    const ally = playerCardIntoPlay(state, ALLY.id);
    const after = playFree(ally.state, deps, DISMISS.card.id).state;
    expect(collection(after)).toContain(ally.id);
  });

  it("a defeated Victory X card goes to the victory display, which is not a discard pile", () => {
    const { state } = start();
    const bounty = minionEngagedWith(state, BOUNTY.id);
    const after = playFree(bounty.state, deps, SMASH.card.id).state;
    expect(after.victoryDisplay).toContain(bounty.id);
    expect(collection(after)).not.toContain(bounty.id);
  });

  it("a card is taken back out to its owner's discard pile, and the area can be counted", () => {
    const { state, curator } = start();
    const ally = playerCardIntoPlay(state, ALLY.id);
    const collected = playFree(ally.state, deps, DISMISS.card.id).state;
    const counted = playFree(collected, deps, COUNT.card.id).state;
    expect(mustInstance(counted, curator).counters["collected"]).toBe(1);
    const { state: reclaimed, session } = playFree(counted, deps, RECLAIM.card.id);
    expect(collection(reclaimed)).toEqual([]);
    expect(mustPlayer(reclaimed, P1).discard).toContain(ally.id);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
