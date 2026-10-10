/**
 * `TriggerEvent characterDefeated.asDefeated` (`DefeatedSnapshot`, docs/phase7-wave9.md §3.32): a pattern's `targetIs`
 * reads what the defeated character was while still in play. Synthetic cards shaped like an environment that reads
 * "Each facedown Controlled minion … has a base hit points of 1. Forced Response: After a Controlled minion is
 * defeated, … place 1 threat on the main scheme", with further listeners that each leave a counter on it, so a test
 * can read exactly which patterns answered a defeat.
 *
 * Sources: RRG 1.8 "Response" (p. 37): a response resolves "immediately after its triggering condition has fully
 * resolved"; "Card Types" (p. 12): a card whose type an ability changes "loses all other card types it might possess";
 * "Defeat" (p. 15): a minion is defeated at zero remaining hit points and discarded. A discard by a card effect is not
 * a defeat (`EffectSpec discardFromPlay`).
 */

import { trait, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetQuery, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment, stubEvent, stubMinion } from "./testing/fixtures.js";
import { ALLY, giveCard, UPGRADE } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const CONTROLLED = trait("CONTROLLED");
const ROBOT = trait("ROBOT");
const n = (value: number): ValueSpec => ({ kind: "const", value });
const each = (query: TargetQuery) => ({ kind: "each", query }) as const;
const asControlled = { kind: "minion", traits: [CONTROLLED] } as const;
const FACEDOWN_CONTROLLED: TargetQuery = { categories: ["minion"], facedown: true, trait: CONTROLLED };

/** A forced response (or interrupt) on the environment that answers a defeat matching `targetIs` with `effects`. */
const listener = (
  id: string,
  targetIs: TargetQuery,
  effects: readonly EffectSpec[],
  kind: "response" | "interrupt" = "response",
) => {
  const on: EventPattern = { on: "characterDefeated", targetIs };
  const definition: AbilityDefinition = { trigger: { kind, forced: true, on }, effects };
  return stubAbility(`watch.${id}`, definition);
};
/** Leaves 1 counter named `name` on the environment, so the test can read which listeners answered. */
const tally = (name: string, targetIs: TargetQuery, kind: "response" | "interrupt" = "response") =>
  listener(name, targetIs, [{ kind: "addCounters", target: { kind: "self" }, counterType: name, amount: n(1) }], kind);

const stats = stubAbility("watch.constant", {
  trigger: { kind: "constant", modifiers: [{ stat: "hp", amount: 1, setBase: true, target: FACEDOWN_CONTROLLED }] },
  effects: [],
});
/** "Forced Response: After a Controlled minion is defeated, … place 1 threat on the main scheme." */
const threat = listener("threat", { categories: ["minion"], trait: CONTROLLED }, [
  { kind: "placeThreat", target: { kind: "mainScheme" }, amount: n(1) },
]);
const LISTENERS = [
  threat,
  tally("when", { categories: ["minion"], trait: CONTROLLED }, "interrupt"),
  tally("ally", { categories: ["ally"] }),
  tally("upgrade", { categories: ["upgrade"] }),
  tally("facedown", { categories: ["minion"], facedown: true }),
  tally("faceup", { categories: ["minion"], facedown: false }),
  tally("uncontrolled", { categories: ["minion"], withoutTrait: CONTROLLED }),
  tally("either", { categories: ["enemy"], anyTrait: [CONTROLLED, ROBOT] }),
];
const WATCH = stubEnvironment({ id: "watch", abilities: [stats.ref, ...LISTENERS.map((l) => l.ref)] });

const THUG = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 1 });
const HANDLER = stubMinion({ id: "handler", atk: 1, sch: 1, hp: 1, traits: [CONTROLLED] });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Put the top card of your deck into play facedown, engaged with you as a Controlled minion." */
const CONSCRIPT = actionEvent("conscript", [
  { kind: "putIntoPlayFacedown", player: { kind: "controller" }, as: asControlled },
]);
/** "Deal 1 damage to each minion." */
const ZAP = actionEvent("zap", [{ kind: "dealDamage", target: each({ categories: ["minion"] }), amount: n(1) }]);
/** "Deal 5 damage to each ally." */
const PURGE = actionEvent("purge", [{ kind: "dealDamage", target: each({ categories: ["ally"] }), amount: n(5) }]);
/** "Discard each Controlled minion." A discard, not a defeat. */
const DISMISS = actionEvent("dismiss", [
  { kind: "discardFromPlay", target: each({ categories: ["minion"], trait: CONTROLLED }) },
]);
const EVENTS = [CONSCRIPT, ZAP, PURGE, DISMISS];

const deps: EngineDeps = depsOf(stats, ...LISTENERS, ...EVENTS.map((e) => e.ability));

function start(): { state: GameState; watch: InstanceId } {
  const state = gameAtFirstTurn({
    cards: [...EVENTS.map((e) => e.card), WATCH, THUG, HANDLER],
    deps,
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 3)),
    encounter: [WATCH.id, ...copiesOf(THUG.id, 5), ...copiesOf(HANDLER.id, 5)],
  });
  const placed = encounterCardInVillainArea(state, WATCH.id);
  return { state: placed.state, watch: placed.id };
}

/** Puts a copy of `card` on top of p1's deck (surgery), so it is the next card put into play facedown. */
function onTopOfDeck(state: GameState, card: CardId): { state: GameState; id: InstanceId } {
  const seat = mustPlayer(state, P1);
  const id = seat.deck.find((candidate) => state.instances[candidate]?.cardId === card);
  if (!id) throw new Error(`no ${card} in the deck`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: [id, ...seat.deck.filter((other) => other !== id)] } : p,
      ),
    },
  };
}

/** Plays a copy of each event in order, each for 0, through one session. */
function playAll(state: GameState, ...events: readonly (typeof EVENTS)[number][]) {
  let current = state;
  const commands: Command[] = [];
  const held: InstanceId[] = [];
  for (const event of events) {
    const given = giveCard(current, P1, event.card.id, held);
    current = given.state;
    held.push(given.id);
    commands.push({
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });
  }
  const { session, events: log } = driveSession(startSession(current), deps, commands);
  return { session, state: session.state, events: log };
}

const mainThreat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const tallies = (state: GameState, watch: InstanceId) => mustInstance(state, watch).counters;
const defeats = (events: readonly { readonly type: string }[]): number =>
  events.filter((e) => e.type === "characterDefeated").length;

describe("characterDefeated.asDefeated: a defeat is matched against what the character was in play (§3.32)", () => {
  it("a player's ally card facedown as a Controlled minion, defeated: 1 threat, and it is read as a facedown minion", () => {
    const { state, watch } = start();
    const top = onTopOfDeck(state, ALLY.id);
    const result = playAll(top.state, CONSCRIPT, ZAP);
    expect(defeats(result.events)).toBe(1);
    expect(mainThreat(result.state)).toBe(1);
    // The interrupt, while it was still in play, and each response that names a (facedown, Controlled) minion.
    expect(tallies(result.state, watch)).toEqual({ when: 1, facedown: 1, either: 1 });
    // The defeated card is its owner's again: in their discard pile, faceup, an ally card once more.
    expect(mustPlayer(result.state, P1).discard).toContain(top.id);
    expect(activeEncounterDeck(result.state).discard).not.toContain(top.id);
    expect(mustInstance(result.state, top.id)).toMatchObject({ facedownAs: null, faceup: true });
  });

  it("an upgrade card facedown as a Controlled minion is not 'an upgrade' that was defeated either", () => {
    const { state, watch } = start();
    const top = onTopOfDeck(state, UPGRADE.id);
    const result = playAll(top.state, CONSCRIPT, ZAP);
    expect(mainThreat(result.state)).toBe(1);
    expect(tallies(result.state, watch)).toEqual({ when: 1, facedown: 1, either: 1 });
    expect(mustPlayer(result.state, P1).discard).toContain(top.id);
  });

  it("two facedown Controlled minions defeated by the same damage: 1 threat each, 2 in all", () => {
    const { state, watch } = start();
    const result = playAll(state, CONSCRIPT, CONSCRIPT, ZAP);
    expect(defeats(result.events)).toBe(2);
    expect(mainThreat(result.state)).toBe(2);
    expect(tallies(result.state, watch)).toEqual({ when: 2, facedown: 2, either: 2 });
  });

  it("a discard is not a defeat: two Controlled minions discarded place no threat and answer no listener", () => {
    const { state, watch } = start();
    const top = onTopOfDeck(state, ALLY.id);
    const result = playAll(top.state, CONSCRIPT, CONSCRIPT, DISMISS);
    expect(defeats(result.events)).toBe(0);
    expect(mainThreat(result.state)).toBe(0);
    expect(tallies(result.state, watch)).toEqual({});
    expect(mustPlayer(result.state, P1).discard).toContain(top.id);
    expect(mustPlayer(result.state, P1).playArea.filter((id) => mustInstance(result.state, id).facedownAs)).toEqual([]);
  });

  it("a minion without the trait, defeated: no threat; it was a faceup minion without the trait", () => {
    const { state, watch } = start();
    const thug = minionEngagedWith(state, THUG.id);
    const result = playAll(thug.state, ZAP);
    expect(defeats(result.events)).toBe(1);
    expect(mainThreat(result.state)).toBe(0);
    expect(tallies(result.state, watch)).toEqual({ faceup: 1, uncontrolled: 1 });
    expect(activeEncounterDeck(result.state).discard).toContain(thug.id);
  });

  it("a faceup minion that prints the trait, defeated: 1 threat (the card says 'a Controlled minion')", () => {
    const { state, watch } = start();
    const handler = minionEngagedWith(state, HANDLER.id);
    const result = playAll(handler.state, ZAP);
    expect(mainThreat(result.state)).toBe(1);
    expect(tallies(result.state, watch)).toEqual({ when: 1, faceup: 1, either: 1 });
  });

  it("one of each at once: a facedown Controlled minion and a plain minion, 1 threat", () => {
    const { state, watch } = start();
    const thug = minionEngagedWith(state, THUG.id);
    const result = playAll(thug.state, CONSCRIPT, ZAP);
    expect(defeats(result.events)).toBe(2);
    expect(mainThreat(result.state)).toBe(1);
    expect(tallies(result.state, watch)).toEqual({ when: 1, facedown: 1, either: 1, faceup: 1, uncontrolled: 1 });
  });

  it("a real ally, defeated, is still an ally and no minion: no threat", () => {
    const { state, watch } = start();
    const ally = playerCardIntoPlay(state, ALLY.id);
    const result = playAll(ally.state, PURGE);
    expect(defeats(result.events)).toBe(1);
    expect(mainThreat(result.state)).toBe(0);
    expect(tallies(result.state, watch)).toEqual({ ally: 1 });
  });

  it("replays to the same state", () => {
    const { state } = start();
    const result = playAll(state, CONSCRIPT, CONSCRIPT, ZAP);
    const replayed = replay(result.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(result.state);
  });
});
