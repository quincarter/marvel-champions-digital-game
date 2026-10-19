/**
 * `EventPattern.removalWillApply` (docs/phase7-wave11-scenarios.md §S7, E20): "When a character would remove threat"
 * hears only a pending removal that nothing will stop as it applies. A removal a crisis icon will stop removes no
 * threat (RRG 1.8 "Crisis Icon", p. 14; "'Cannot'", p. 11; "'Would'", p. 48). A `placeThreat` event the same pattern
 * hears is not read. Synthetic cards.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern } from "./abilities.js";
import { mainSchemeStates, mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard, TREACHERY } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const one = { kind: "const", value: 1 } as const;
const self: TargetRef = { kind: "self" };
const counter = (id: string, counterType: string, on: EventPattern) =>
  stubAbility(id, {
    trigger: { kind: "interrupt", forced: true, on } as AbilityDefinition["trigger"],
    effects: [{ kind: "addCounters", target: self, counterType, amount: one }],
  });

/** Counts every pending removal and placement that will happen. */
const HEARS = counter("hears.will", "heard", { on: ["removeThreat", "placeThreat"], removalWillApply: true });
const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: [HEARS.ref] });
const CRISIS = stubSideScheme({ id: "crisis", startingThreat: 3, icons: ["crisis"] });

const amount = (value: number) => ({ kind: "const", value }) as const;
const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const mainScheme: TargetRef = { kind: "mainScheme" };
const sideSchemes: TargetRef = { kind: "each", query: { categories: ["sideScheme"] } };
/** 3 from the main scheme (stopped under a crisis icon) and 1 from each side scheme. */
const CLEAR_MAIN_AND_CHIP = action("clear-main-and-chip", [
  { kind: "removeThreat", target: mainScheme, amount: amount(3) },
  { kind: "removeThreat", target: sideSchemes, amount: amount(1) },
]);
const PLACE_MAIN = action("place-main", [{ kind: "placeThreat", target: mainScheme, amount: amount(1) }]);
const ACTIONS = [CLEAR_MAIN_AND_CHIP, PLACE_MAIN];

const deps: EngineDeps = depsOf(HEARS, ...ACTIONS.map((a) => a.ability));

function start(): { readonly state: GameState; readonly watcher: string; readonly main: string } {
  const state = gameAtFirstTurn({
    cards: [WATCHER, CRISIS, ...ACTIONS.map((a) => a.card)],
    deps,
    encounter: [CRISIS.id, ...copiesOf(TREACHERY.id, 20)],
    deck: [WATCHER.id, ...ACTIONS.map((a) => a.card.id)],
  });
  const watcher = playerCardIntoPlay(state, WATCHER.id);
  const crisis = encounterCardInVillainArea(watcher.state, CRISIS.id, 3);
  const main = mainSchemeStates(crisis.state)[0]!.instanceId;
  const withThreat: GameState = {
    ...crisis.state,
    instances: { ...crisis.state.instances, [main]: { ...mustInstance(crisis.state, main), threat: 3 } },
  };
  return { state: withThreat, watcher: watcher.id, main };
}
function play(state: GameState, card: (typeof ACTIONS)[number]) {
  const given = giveCard(state, P1, card.card.id);
  return runCommandsPicking(given.state, deps, defaultPick, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}

describe("EventPattern.removalWillApply", () => {
  it("a removal a crisis icon will stop is not heard; the side scheme's removal is", () => {
    const s = start();
    const { state } = play(s.state, CLEAR_MAIN_AND_CHIP);
    expect(mustInstance(state, s.main as never).threat).toBe(3);
    expect(mustInstance(state, s.watcher as never).counters).toEqual({ heard: 1 });
  });

  it("a placement the same pattern hears is not read: it is heard", () => {
    const s = start();
    const { state } = play(s.state, PLACE_MAIN);
    expect(mustInstance(state, s.main as never).threat).toBe(4);
    expect(mustInstance(state, s.watcher as never).counters).toEqual({ heard: 1 });
  });
});
