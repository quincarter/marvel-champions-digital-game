/**
 * `EventPattern.removesLastThreat` (docs/phase7-wave11.md §3.4): "Interrupt: When you ... remove the last threat from
 * attached scheme, ...". RRG 1.8 "Interrupt" (p. 25): an interrupt resolves immediately before its triggering
 * condition, so it resolves while the threat is still on the scheme and before a side scheme's defeat; the scheme's
 * When Defeated comes after it (August 3, 2026 R1; August 13, 2026 R2). The pattern reads the pending removal as the
 * window opens: its amount must reach the scheme's threat, the threat must be above 0, and nothing may stop it.
 * Synthetic cards.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mainSchemeStates, mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard, TREACHERY } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const one = { kind: "const", value: 1 } as const;
const self: TargetRef = { kind: "self" };
const counter = (id: string, counterType: string, trigger: AbilityDefinition["trigger"]) =>
  stubAbility(id, { trigger, effects: [{ kind: "addCounters", target: self, counterType, amount: one }] });

const LAST: EventPattern = { on: "removeThreat", removesLastThreat: true, playerIn: { kind: "controller" } };

/** "Interrupt: When you remove the last threat from a scheme, ..." */
const SENSE_LAST = counter("sense.last", "sensed", { kind: "interrupt", forced: false, on: LAST });
/** The same pattern on a response: the threat is gone by then, so it never matches. */
const LATE_LAST = counter("late.last", "late", { kind: "response", forced: true, on: LAST });
const SENSE = stubSupport({ id: "sense", cost: 0, abilities: [SENSE_LAST.ref, LATE_LAST.ref] });

/** "When Defeated: ..." on the side scheme, to show it follows the interrupt. */
const LAIR_DEFEATED = stubAbility("lair.defeated", { trigger: { kind: "whenDefeated" }, effects: [] });
const LAIR = stubSideScheme({ id: "lair", startingThreat: 2, abilities: [LAIR_DEFEATED.ref] });
/** "Threat cannot be removed from this scheme": a removal that will be stopped removes no last threat. */
const SEALED_RULE = stubAbility("sealed.rule", {
  trigger: { kind: "constant", rules: [{ kind: "threatCannotBeRemoved", target: { self: true } }] },
  effects: [],
});
const SEALED = stubSideScheme({ id: "sealed", startingThreat: 2, abilities: [SEALED_RULE.ref] });
const PLAIN = stubSideScheme({ id: "plain", startingThreat: 0 });
/** A crisis icon: player cards cannot remove threat from the main scheme while it is in play (RRG 1.8 p. 14). */
const CRISIS = stubSideScheme({ id: "crisis", startingThreat: 3, icons: ["crisis"] });
/**
 * "Forced Response: After threat is removed from the main scheme, remove 2 threat from this scheme": an encounter
 * card's forced removal, which no player makes (`removeThreat.playerId` null).
 */
const ROBBER_SELF_CLEAR = stubAbility("robber.clear", {
  trigger: { kind: "response", forced: true, on: { on: "removeThreat", targetIs: { categories: ["mainScheme"] } } },
  effects: [{ kind: "removeThreat", target: { kind: "self" }, amount: { kind: "const", value: 2 } }],
});
const ROBBER = stubSideScheme({ id: "robber", startingThreat: 2, abilities: [ROBBER_SELF_CLEAR.ref] });

const amount = (value: number) => ({ kind: "const", value }) as const;
const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const sideSchemes: TargetRef = { kind: "each", query: { categories: ["sideScheme"] } };
const mainScheme: TargetRef = { kind: "mainScheme" };
const REMOVE_1 = action("remove-1", [{ kind: "removeThreat", target: sideSchemes, amount: amount(1) }]);
const REMOVE_2 = action("remove-2", [{ kind: "removeThreat", target: sideSchemes, amount: amount(2) }]);
const REMOVE_5 = action("remove-5", [{ kind: "removeThreat", target: sideSchemes, amount: amount(5) }]);
const CLEAR_MAIN = action("clear-main", [{ kind: "removeThreat", target: mainScheme, amount: amount(3) }]);
/** The main scheme's 3 and a side scheme's 1, so the event has a valid target while a crisis icon stops the first. */
const CLEAR_MAIN_AND_CHIP = action("clear-main-and-chip", [
  { kind: "removeThreat", target: mainScheme, amount: amount(3) },
  { kind: "removeThreat", target: sideSchemes, amount: amount(1) },
]);
/** "…, ignoring any crisis icons in play" (Cable Arrow). */
const CLEAR_MAIN_IGNORING_CRISIS = action("clear-main-ignoring-crisis", [
  { kind: "removeThreat", target: mainScheme, amount: amount(3), ignoreCrisis: true },
]);
/** A removal the card names another player as making (`EffectSpec removeThreat.by`). */
const REMOVE_2_BY_P2 = action("remove-2-by-p2", [
  { kind: "removeThreat", target: sideSchemes, amount: amount(2), by: { kind: "id", playerId: P2 } },
]);
const ACTIONS = [
  REMOVE_1,
  REMOVE_2,
  REMOVE_5,
  CLEAR_MAIN,
  CLEAR_MAIN_AND_CHIP,
  CLEAR_MAIN_IGNORING_CRISIS,
  REMOVE_2_BY_P2,
];

const deps: EngineDeps = depsOf(
  SENSE_LAST,
  LATE_LAST,
  LAIR_DEFEATED,
  SEALED_RULE,
  ROBBER_SELF_CLEAR,
  ...ACTIONS.map((a) => a.ability),
);

function start(players: 1 | 2 = 1): { readonly state: GameState; readonly sense: InstanceId } {
  const state = gameAtFirstTurn({
    cards: [SENSE, LAIR, SEALED, PLAIN, CRISIS, ROBBER, ...ACTIONS.map((a) => a.card)],
    deps,
    players,
    encounter: [LAIR.id, SEALED.id, PLAIN.id, CRISIS.id, ROBBER.id, ...copiesOf(TREACHERY.id, 20)],
    deck: [SENSE.id, ...ACTIONS.map((a) => a.card.id)],
  });
  const sense = playerCardIntoPlay(state, SENSE.id);
  return { state: sense.state, sense: sense.id };
}
/** Accepts every optional trigger offered; otherwise the default pick. */
const accept = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
  return defaultPick(state);
};
function play(state: GameState, card: (typeof ACTIONS)[number]) {
  const given = giveCard(state, P1, card.card.id);
  return runCommandsPicking(given.state, deps, accept, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}
const resolvedAt = (events: readonly GameEvent[], abilityId: string) =>
  events.findIndex((e) => e.type === "abilityResolved" && e.abilityId === abilityId);
const indexOf = (events: readonly GameEvent[], type: GameEvent["type"]) => events.findIndex((e) => e.type === type);

describe("EventPattern.removesLastThreat: an interrupt to the removal of a scheme's last threat", () => {
  it("you remove the last 2 of 2: the interrupt resolves before the threat goes and before the defeat", () => {
    const { state: started, sense } = start();
    const lair = encounterCardInVillainArea(started, LAIR.id, 2);
    const { state, events } = play(lair.state, REMOVE_2);
    expect(mustInstance(state, sense).counters).toEqual({ sensed: 1 });
    const interrupt = resolvedAt(events, SENSE_LAST.ref.id);
    expect(interrupt).toBeGreaterThanOrEqual(0);
    expect(interrupt).toBeLessThan(indexOf(events, "threatRemoved"));
    expect(interrupt).toBeLessThan(indexOf(events, "schemeDefeated"));
    // The scheme's When Defeated follows every interrupt (August 13, 2026 R2).
    expect(resolvedAt(events, LAIR_DEFEATED.ref.id)).toBeGreaterThan(interrupt);
    expect(state.villainArea).not.toContain(lair.id);
  });

  it("a removal larger than the threat left (5 of 2) is heard too: it removes the last threat", () => {
    const { state: started, sense } = start();
    const lair = encounterCardInVillainArea(started, LAIR.id, 2);
    const { state } = play(lair.state, REMOVE_5);
    expect(mustInstance(state, sense).counters).toEqual({ sensed: 1 });
  });

  it("the main scheme: the interrupt fires and nothing is defeated", () => {
    const { state: started, sense } = start();
    const mainId = mainSchemeStates(started)[0]!.instanceId;
    const withThreat: GameState = {
      ...started,
      instances: { ...started.instances, [mainId]: { ...mustInstance(started, mainId), threat: 3 } },
    };
    const { state, events } = play(withThreat, CLEAR_MAIN);
    expect(mustInstance(state, mainId).threat).toBe(0);
    expect(mustInstance(state, sense).counters).toEqual({ sensed: 1 });
    expect(indexOf(events, "schemeDefeated")).toBe(-1);
  });

  it("control: removing 1 from a 2-threat scheme opens no window for it", () => {
    const { state: started, sense } = start();
    const lair = encounterCardInVillainArea(started, LAIR.id, 2);
    const { state, events } = play(lair.state, REMOVE_1);
    expect(mustInstance(state, lair.id).threat).toBe(1);
    expect(mustInstance(state, sense).counters).toEqual({});
    expect(resolvedAt(events, SENSE_LAST.ref.id)).toBe(-1);
  });

  it("control: a scheme with no threat has no last threat to remove (the removal also hits a 5-threat scheme)", () => {
    const { state: started, sense } = start();
    const lair = encounterCardInVillainArea(started, LAIR.id, 5);
    const plain = encounterCardInVillainArea(lair.state, PLAIN.id, 0);
    const { state } = play(plain.state, REMOVE_2);
    expect(mustInstance(state, lair.id).threat).toBe(3);
    expect(mustInstance(state, sense).counters).toEqual({});
  });

  it("control: a removal a rule will stop is not heard (threat cannot be removed from this scheme)", () => {
    const { state: started, sense } = start();
    // A 5-threat scheme beside it is a valid target, so the event can be played; it loses 2 and keeps 3.
    const lair = encounterCardInVillainArea(started, LAIR.id, 5);
    const sealed = encounterCardInVillainArea(lair.state, SEALED.id, 2);
    const { state } = play(sealed.state, REMOVE_2);
    expect(mustInstance(state, sealed.id).threat).toBe(2);
    expect(mustInstance(state, lair.id).threat).toBe(3);
    expect(mustInstance(state, sense).counters).toEqual({});
  });

  it("control: the same pattern on a response never matches, the threat being gone by then", () => {
    const { state: started, sense } = start();
    const lair = encounterCardInVillainArea(started, LAIR.id, 2);
    const { state, events } = play(lair.state, REMOVE_2);
    expect(mustInstance(state, sense).counters).not.toHaveProperty("late");
    expect(resolvedAt(events, LATE_LAST.ref.id)).toBe(-1);
  });

  it("control (byYou): another player's removal of the last threat is not yours", () => {
    const { state: started, sense } = start(2);
    const lair = encounterCardInVillainArea(started, LAIR.id, 2);
    const { state } = play(lair.state, REMOVE_2_BY_P2);
    expect(state.villainArea).not.toContain(lair.id);
    expect(mustInstance(state, sense).counters).toEqual({});
  });

  it("control (byYou): an encounter card's forced removal of its own last threat is no player's", () => {
    const { state: started, sense } = start();
    const robber = encounterCardInVillainArea(started, ROBBER.id, 2);
    const mainId = mainSchemeStates(started)[0]!.instanceId;
    const withThreat: GameState = {
      ...robber.state,
      instances: { ...robber.state.instances, [mainId]: { ...mustInstance(robber.state, mainId), threat: 5 } },
    };
    // 3 of the main scheme's 5 (not the last), then the forced response removes the robber's last 2.
    const { state, events } = play(withThreat, CLEAR_MAIN);
    expect(resolvedAt(events, ROBBER_SELF_CLEAR.ref.id)).toBeGreaterThanOrEqual(0);
    expect(state.villainArea).not.toContain(robber.id);
    expect(mustInstance(state, sense).counters).toEqual({});
  });

  it("control: a crisis icon stops your removal from the main scheme, so it is not heard; ignoring crisis, it is", () => {
    const { state: started, sense } = start();
    const crisis = encounterCardInVillainArea(started, CRISIS.id, 3);
    const mainId = mainSchemeStates(started)[0]!.instanceId;
    const withThreat: GameState = {
      ...crisis.state,
      instances: { ...crisis.state.instances, [mainId]: { ...mustInstance(crisis.state, mainId), threat: 3 } },
    };
    const stopped = play(withThreat, CLEAR_MAIN_AND_CHIP).state;
    expect(mustInstance(stopped, mainId).threat).toBe(3);
    expect(mustInstance(stopped, crisis.id).threat).toBe(2);
    expect(mustInstance(stopped, sense).counters).toEqual({});
    const { state } = play(withThreat, CLEAR_MAIN_IGNORING_CRISIS);
    expect(mustInstance(state, mainId).threat).toBe(0);
    expect(mustInstance(state, sense).counters).toEqual({ sensed: 1 });
  });

  it("replays to the same state", () => {
    const { state: started } = start();
    const lair = encounterCardInVillainArea(started, LAIR.id, 2);
    const { session } = play(lair.state, REMOVE_2);
    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });
});
