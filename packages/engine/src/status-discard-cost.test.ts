/**
 * docs/phase7-wave6.md §3.6: discarding a status card as a cost (`AbilityCost.discardStatus`), and how many an effect
 * discarded (`EffectSpec removeStatus.bind`, `count`). Synthetic cards shaped like Made of Rage (`mut_gen` 32007:
 * "discard a tough status card from your hero →"), Homesick (32025: "If you discarded no tough status cards this way")
 * and Steel Fist (32008: "You may discard a tough status card from your hero"), with an Iron Will-shaped listener
 * (32004) to show each discard is a §3.5 `statusDiscarded`.
 *
 * Sources: RRG 1.8 "Cost" (p. 13: paid in full or not at all), "Cost Arrow Icon" (p. 14: responses to the cost resolve
 * before the effect), "Status Cards" (p. 41).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";
import type { TriggerEvent } from "./trigger-events.js";

const yourHero: TargetQuery = { categories: ["identity"], controller: "you" };
const hero: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const self: TargetRef = { kind: "self" };
const bump = (counterType: string, amount: number | string = 1): EffectSpec => ({
  kind: "addCounters",
  target: self,
  counterType,
  amount: typeof amount === "number" ? { kind: "const", value: amount } : { kind: "var", name: amount },
});
const def = (definition: AbilityDefinition) => definition;

// Colossus's identity can hold any number of tough cards here (the §3.7 shape), so a cost has two to choose from.
const KIT_CONSTANT = stubAbility(
  "kit.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [{ kind: "statusLimit", target: yourHero, status: "tough", max: "unlimited" }],
    },
    effects: [],
  }),
);
const IRON_WILL_RESPONSE = stubAbility(
  "iron-will.response",
  def({
    trigger: {
      kind: "response",
      forced: false,
      on: { on: "statusDiscarded", targetIs: yourHero, eventIs: { status: "tough" } },
    },
    effects: [bump("drawn")],
  }),
);
// Made of Rage's cost on an action: "Discard a tough status card from your hero → ...".
const RAGE_ACTION = stubAbility(
  "rage.action",
  def({
    trigger: { kind: "action" },
    cost: { discardStatus: { status: "tough", from: hero } },
    effects: [bump("fired")],
  }),
);
// Homesick's count: "Discard each tough status card from your identity. If you discarded none ...".
const STRIP_ACTION = stubAbility(
  "strip.action",
  def({
    trigger: { kind: "action" },
    effects: [
      { kind: "removeStatus", target: hero, status: "tough", bind: "stripped" },
      bump("stripped", "stripped.amount"),
      {
        kind: "if",
        condition: { kind: "compare", left: { kind: "var", name: "stripped.amount" }, op: "equalTo", right: n(0) },
        then: [bump("none")],
      },
    ],
  }),
);
// Steel Fist's "a tough status card": one, however many are held.
const CHIP_ACTION = stubAbility(
  "chip.action",
  def({
    trigger: { kind: "action" },
    effects: [
      { kind: "removeStatus", target: hero, status: "tough", count: 1, bind: "chipped" },
      bump("chipped", "chipped.amount"),
    ],
  }),
);

function n(value: number) {
  return { kind: "const", value } as const;
}

const KIT = stubSupport({ id: "kit", cost: 0, abilities: [KIT_CONSTANT.ref] });
const IRON_WILL = stubSupport({ id: "iron-will", cost: 0, abilities: [IRON_WILL_RESPONSE.ref] });
const RAGE = stubSupport({ id: "rage", cost: 0, abilities: [RAGE_ACTION.ref] });
const STRIP = stubSupport({ id: "strip", cost: 0, abilities: [STRIP_ACTION.ref] });
const CHIP = stubSupport({ id: "chip", cost: 0, abilities: [CHIP_ACTION.ref] });
const SUPPORTS = [KIT, IRON_WILL, RAGE, STRIP, CHIP];

const TOUGHEN_ABILITY = stubAbility("toughen.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "giveStatus", target: hero, status: "tough" }],
});
const TOUGHEN = stubEvent({ id: "toughen", cost: 0, abilities: [TOUGHEN_ABILITY.ref] });

const deps: EngineDeps = depsOf(
  KIT_CONSTANT,
  IRON_WILL_RESPONSE,
  RAGE_ACTION,
  STRIP_ACTION,
  CHIP_ACTION,
  TOUGHEN_ABILITY,
);

function start(): GameState {
  let state = gameAtFirstTurn({
    deps,
    cards: [...SUPPORTS, TOUGHEN],
    deck: [...SUPPORTS.map((s) => s.id), ...copiesOf(TOUGHEN.id, 4)],
  });
  for (const support of SUPPORTS) state = playerCardIntoPlay(state, support.id).state;
  return { ...state, players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
}

const acceptTriggers = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
  return defaultPick(state);
};

const heroId = (state: GameState): InstanceId => state.players[0]!.identity.instanceId;
const supportId = (state: GameState, name: string): InstanceId =>
  state.players[0]!.playArea.find((id) => mustInstance(state, id).cardId === name)!;
const counter = (state: GameState, support: string, type: string): number =>
  mustInstance(state, supportId(state, support)).counters[type] ?? 0;
const tough = (state: GameState): number => mustInstance(state, heroId(state)).statuses.tough;

function run(state: GameState, ...commands: readonly Command[]) {
  return runCommandsPicking(state, deps, acceptTriggers, ...commands);
}
const use = (state: GameState, support: string, abilityId: string): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: supportId(state, support),
  abilityId: abilityId as never,
  payment: [],
});
function toughened(times: number): GameState {
  let state = start();
  for (let i = 0; i < times; i++) {
    const given = giveCard(state, P1, TOUGHEN.id);
    state = run(given.state, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    }).state;
  }
  return state;
}
function offered(state: GameState, abilityId: string): boolean {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(`expected P1's turn, got ${actions.kind}`);
  return actions.legal.some((a) => a.action.kind === "useAbility" && a.action.abilityId === abilityId);
}
const discardedEvents = (events: readonly GameEvent[]): readonly TriggerEvent[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "statusDiscarded" ? [e.event] : [],
  );
const resolvedAt = (events: readonly GameEvent[], abilityId: string): number =>
  events.findIndex((e) => e.type === "abilityResolved" && e.abilityId === abilityId);

function expectReplays(result: ReturnType<typeof run>): void {
  const replayed = replay(result.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.session.state);
}

describe("§3.6 `AbilityCost.discardStatus`", () => {
  it("with no tough status card the cost can't be paid: not offered, refused", () => {
    const state = start();
    expect(tough(state)).toBe(0);
    expect(offered(state, "rage.action")).toBe(false);
    expect(applyCommand(state, use(state, RAGE.id, "rage.action"), deps).ok).toBe(false);
  });

  it("paying discards exactly one of two, announced with cause 'cost', answered before the effect resolves", () => {
    const state = toughened(2);
    expect(tough(state)).toBe(2);
    expect(offered(state, "rage.action")).toBe(true);
    const result = run(state, use(state, RAGE.id, "rage.action"));
    expect(tough(result.state)).toBe(1);
    expect(discardedEvents(result.events)).toEqual([
      { kind: "statusDiscarded", instanceId: heroId(result.state), status: "tough", cause: "cost" },
    ]);
    expect(counter(result.state, RAGE.id, "fired")).toBe(1);
    expect(counter(result.state, IRON_WILL.id, "drawn")).toBe(1);
    // RRG 1.8 "Cost Arrow Icon" (p. 14): responses to the cost resolve before the effect after the arrow.
    expect(resolvedAt(result.events, "iron-will.response")).toBeGreaterThanOrEqual(0);
    expect(resolvedAt(result.events, "iron-will.response")).toBeLessThan(resolvedAt(result.events, "rage.action"));
    expect(
      result.events.some(
        (e) => e.type === "statusRemoved" && e.instanceId === heroId(result.state) && e.reason === "cost",
      ),
    ).toBe(true);
    expectReplays(result);
  });
});

describe("§3.6 `removeStatus.bind` / `count`", () => {
  it("binds how many were discarded: two, each announced", () => {
    const state = toughened(2);
    const result = run(state, use(state, STRIP.id, "strip.action"));
    expect(tough(result.state)).toBe(0);
    expect(counter(result.state, STRIP.id, "stripped")).toBe(2);
    expect(counter(result.state, STRIP.id, "none")).toBe(0);
    expect(discardedEvents(result.events)).toHaveLength(2);
    expect(counter(result.state, IRON_WILL.id, "drawn")).toBe(2);
    expectReplays(result);
  });

  it("binds 0 when there was none to discard", () => {
    const state = start();
    const result = run(state, use(state, STRIP.id, "strip.action"));
    expect(counter(result.state, STRIP.id, "stripped")).toBe(0);
    expect(counter(result.state, STRIP.id, "none")).toBe(1);
    expect(discardedEvents(result.events)).toEqual([]);
    expectReplays(result);
  });

  it("`count: 1` discards one of two and binds 1", () => {
    const state = toughened(2);
    const result = run(state, use(state, CHIP.id, "chip.action"));
    expect(tough(result.state)).toBe(1);
    expect(counter(result.state, CHIP.id, "chipped")).toBe(1);
    expect(discardedEvents(result.events)).toEqual([
      { kind: "statusDiscarded", instanceId: heroId(result.state), status: "tough", cause: "effect" },
    ]);
    expectReplays(result);
  });
});
