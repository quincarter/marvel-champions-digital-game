/**
 * `EventPattern.anyOf`: one triggered ability answering either of two whole patterns ("Forced Response: After [the
 * villain] is defeated or the last threat is removed from this scheme, …"). RRG 1.8 "Triggering Condition" (p. 45):
 * the triggering condition is "the element of the ability that references [a specific] occurrence", and here one
 * ability names two occurrences, each with its own conditions. The window opens only when a whole alternative
 * matches: a removal that leaves threat, a removal from another scheme and damage that does not defeat are not heard
 * at all. Synthetic cards.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubSideScheme, stubSupport, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCard, TREACHERY } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const one = { kind: "const", value: 1 } as const;
const self: TargetRef = { kind: "self" };
const counter = (id: string, counterType: string, trigger: AbilityDefinition["trigger"]) =>
  stubAbility(id, { trigger, effects: [{ kind: "addCounters", target: self, counterType, amount: one }] });

const VILLAIN_DEFEATED: EventPattern = { on: "characterDefeated", targetIs: { categories: ["villain"] } };
const EMPTIED: EventPattern = { on: "removeThreat", selfIs: "target", requireResults: { lastThreatRemoved: 1 } };
const EITHER: EventPattern = { on: ["characterDefeated", "removeThreat"], anyOf: [VILLAIN_DEFEATED, EMPTIED] };

/** "Forced Response: After the villain is defeated or the last threat is removed from this scheme, …" */
const HOLD_EITHER = counter("hold.either", "answered", { kind: "response", forced: true, on: EITHER });
const HOLD = stubSideScheme({
  id: "hold",
  startingThreat: 4,
  keywords: [{ name: "permanent" }],
  abilities: [HOLD_EITHER.ref],
});
const OTHER = stubSideScheme({ id: "other", startingThreat: 1, keywords: [{ name: "permanent" }] });

/**
 * A player's support with the optional form, so an opened window shows as an offer: "Response: After you defeat stage
 * II of the villain or the last threat is removed from a scheme, …". `playerIs` beside `anyOf` is common to both.
 */
const WATCH_EITHER = counter("watch.either", "watched", {
  kind: "response",
  forced: false,
  on: {
    on: ["characterDefeated", "removeThreat"],
    playerIs: "controller",
    anyOf: [
      { ...VILLAIN_DEFEATED, eventAtLeast: { villainStageNumber: 2 }, eventAtMost: { villainStageNumber: 2 } },
      { on: "removeThreat", requireResults: { lastThreatRemoved: 1 } },
    ],
  },
});
/** An alternative that hears a kind the outer `on` does not list is never reached. */
const WATCH_UNLISTED = counter("watch.unlisted", "unlisted", {
  kind: "response",
  forced: true,
  on: { on: "characterDefeated", anyOf: [VILLAIN_DEFEATED, { on: "removeThreat" }] },
});
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: [WATCH_EITHER.ref, WATCH_UNLISTED.ref] });

const FOE = stubVillain({
  id: "foe",
  stages: [
    { hp: { base: 5, perPlayer: 0 }, atk: 1, sch: 1 },
    { hp: { base: 7, perPlayer: 0 }, atk: 1, sch: 1 },
    { hp: { base: 9, perPlayer: 0 }, atk: 1, sch: 1 },
  ],
});

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const amount = (value: number) => ({ kind: "const", value }) as const;
const theVillain: TargetRef = { kind: "villain" };
const sideSchemes: TargetRef = { kind: "each", query: { categories: ["sideScheme"] } };
const HIT_3 = action("hit-3", [{ kind: "dealDamage", target: theVillain, amount: amount(3) }]);
const HIT_7 = action("hit-7", [{ kind: "dealDamage", target: theVillain, amount: amount(7) }]);
const CHIP = action("chip", [{ kind: "removeThreat", target: sideSchemes, amount: amount(1) }]);
const EMPTY = action("empty", [{ kind: "removeThreat", target: sideSchemes, amount: amount(20) }]);
const ACTIONS = [HIT_3, HIT_7, CHIP, EMPTY];

const deps: EngineDeps = depsOf(HOLD_EITHER, WATCH_EITHER, WATCH_UNLISTED, ...ACTIONS.map((a) => a.ability));

function start(): GameState {
  return gameAtFirstTurn({
    cards: [HOLD, OTHER, FOE, WATCH, ...ACTIONS.map((a) => a.card)],
    deps,
    villain: FOE,
    encounter: [HOLD.id, OTHER.id, ...copiesOf(TREACHERY.id, 20)],
    deck: [WATCH.id, ...ACTIONS.map((a) => a.card.id)],
  });
}
/** Accepts every optional trigger offered; otherwise the default pick. */
const accept = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
  return defaultPick(state);
};
function play(state: GameState, card: CardId) {
  const given = giveCard(state, P1, card);
  return runCommandsPicking(given.state, deps, accept, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}
const counters = (state: GameState, id: InstanceId) => mustInstance(state, id).counters;
const offers = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "choiceRequested" && e.choice.prompt.kind === "chooseTriggers").length;
/** How many times the engine logged this ability resolving. */
const triggered = (events: readonly GameEvent[], abilityId: string) =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === abilityId).length;

describe("EventPattern.anyOf: one ability, two triggering conditions", () => {
  it("the first alternative: the villain's stage is defeated, answered once", () => {
    const hold = encounterCardInVillainArea(start(), HOLD.id, 4);
    const { state, events } = play(play(hold.state, HIT_3.card.id).state, HIT_3.card.id);
    expect(activeVillain(state).stageIndex).toBe(1);
    expect(mustInstance(state, hold.id).threat).toBe(4);
    expect(counters(state, hold.id)).toEqual({ answered: 1 });
    expect(triggered(events, HOLD_EITHER.ref.id)).toBe(1);
  });

  it("the second alternative: the last threat is removed from this scheme, answered once", () => {
    const hold = encounterCardInVillainArea(start(), HOLD.id, 4);
    const { state, events } = play(hold.state, EMPTY.card.id);
    expect(mustInstance(state, hold.id).threat).toBe(0);
    expect(counters(state, hold.id)).toEqual({ answered: 1 });
    expect(triggered(events, HOLD_EITHER.ref.id)).toBe(1);
  });

  it("a removal that leaves threat on the scheme is not heard: 4 threat to 3, nothing triggered", () => {
    const hold = encounterCardInVillainArea(start(), HOLD.id, 4);
    const { state, events } = play(hold.state, CHIP.card.id);
    expect(mustInstance(state, hold.id).threat).toBe(3);
    expect(counters(state, hold.id)).toEqual({});
    expect(triggered(events, HOLD_EITHER.ref.id)).toBe(0);
  });

  it("the last threat removed from another scheme is not heard: each alternative keeps its own conditions", () => {
    const hold = encounterCardInVillainArea(start(), HOLD.id, 4);
    const other = encounterCardInVillainArea(hold.state, OTHER.id, 1);
    const { state, events } = play(other.state, CHIP.card.id);
    expect(mustInstance(state, other.id).threat).toBe(0);
    expect(mustInstance(state, hold.id).threat).toBe(3);
    expect(counters(state, hold.id)).toEqual({});
    expect(triggered(events, HOLD_EITHER.ref.id)).toBe(0);
  });

  it("damage that does not defeat the villain is not heard: 3 of 5 hit points", () => {
    const hold = encounterCardInVillainArea(start(), HOLD.id, 4);
    const { state, events } = play(hold.state, HIT_3.card.id);
    expect(mustInstance(state, activeVillain(state).instanceId).damage).toBe(3);
    expect(counters(state, hold.id)).toEqual({});
    expect(triggered(events, HOLD_EITHER.ref.id)).toBe(0);
  });

  it("each occurrence is answered separately: emptied, then the villain defeated, 2 in all", () => {
    const hold = encounterCardInVillainArea(start(), HOLD.id, 4);
    const emptied = play(hold.state, EMPTY.card.id).state;
    const { state } = play(emptied, HIT_7.card.id);
    expect(counters(state, hold.id)).toEqual({ answered: 2 });
  });

  it("an optional one is offered only when a whole alternative matches, with the outer fields common to both", () => {
    const hold = encounterCardInVillainArea(start(), HOLD.id, 4);
    const watch = playerCardIntoPlay(hold.state, WATCH.id);
    // A removal that leaves threat: no offer. Stage I defeated (the alternative asks for stage II): no offer.
    const chipped = play(watch.state, CHIP.card.id);
    expect(offers(chipped.events)).toBe(0);
    const stageOne = play(chipped.state, HIT_7.card.id);
    expect(activeVillain(stageOne.state).stageIndex).toBe(1);
    expect(offers(stageOne.events)).toBe(0);
    expect(counters(stageOne.state, watch.id)).toEqual({ unlisted: 1 });
    // The last threat removed: offered once. Stage II defeated: offered once.
    const emptied = play(stageOne.state, EMPTY.card.id);
    expect(offers(emptied.events)).toBe(1);
    expect(counters(emptied.state, watch.id)).toEqual({ unlisted: 1, watched: 1 });
    const stageTwo = play(emptied.state, HIT_7.card.id);
    expect(activeVillain(stageTwo.state).stageIndex).toBe(2);
    expect(offers(stageTwo.events)).toBe(1);
    expect(counters(stageTwo.state, watch.id)).toEqual({ unlisted: 2, watched: 2 });
  });

  it("an alternative whose kind the outer `on` does not list is never reached: the outer pattern still gates", () => {
    const hold = encounterCardInVillainArea(start(), HOLD.id, 4);
    const watch = playerCardIntoPlay(hold.state, WATCH.id);
    const { state } = play(watch.state, EMPTY.card.id);
    expect(counters(state, watch.id)).toEqual({ watched: 1 });
  });

  it("replays to the same state", () => {
    const hold = encounterCardInVillainArea(start(), HOLD.id, 4);
    const { session } = play(hold.state, EMPTY.card.id);
    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });
});
