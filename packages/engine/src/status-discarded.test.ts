/**
 * docs/phase7-wave6.md §3.5: "After a status card is discarded from X" (`TriggerEvent statusDiscarded`). Synthetic cards
 * shaped like Colossus's Iron Will (`mut_gen` 32004: "After a tough status card is discarded from Colossus, draw 1
 * card") and Organic Steel (32006: "After a tough status card is discarded from Colossus, exhaust this card … → give
 * Colossus a tough status card"). §4.1 Q5: one event per status card, several discarded by one step share one response
 * window, so Iron Will (no limit) answers each and Organic Steel (exhausts) answers once.
 *
 * Sources: RRG 1.8 "Tough" (p. 44: a tough card prevents the damage and is discarded), "Piercing" (p. 32: discarded
 * before damage), "Stun" (p. 41), "Confuse" (p. 13), "Triggering Condition" (p. 45: one occurrence, one window).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
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
const bump = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: self,
  counterType,
  amount: { kind: "const", value: 1 },
});
const def = (definition: AbilityDefinition) => definition;

// Colossus's identity can hold any number of tough cards here, so piercing has two to discard (§3.7 shape).
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
// Iron Will: optional, no limit.
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
// Organic Steel: exhausts itself, so once per window however many cards were discarded.
const ORGANIC_STEEL_RESPONSE = stubAbility(
  "organic-steel.response",
  def({
    trigger: {
      kind: "response",
      forced: false,
      on: { on: "statusDiscarded", targetIs: yourHero, eventIs: { status: "tough" } },
    },
    cost: { exhaustSelf: true },
    effects: [bump("fired")],
  }),
);
// Watchers for the other statuses, and one on the villain, to show the filters.
const STUN_WATCH = stubAbility(
  "stun-watch.forced-response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "statusDiscarded", eventIs: { status: "stunned" } } },
    effects: [bump("stunned")],
  }),
);
const CONFUSE_WATCH = stubAbility(
  "confuse-watch.forced-response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "statusDiscarded", eventIs: { status: "confused" } } },
    effects: [bump("confused")],
  }),
);
const VILLAIN_WATCH = stubAbility(
  "villain-watch.forced-response",
  def({
    trigger: {
      kind: "response",
      forced: true,
      on: { on: "statusDiscarded", targetIs: { categories: ["villain"] }, eventIs: { status: "tough" } },
    },
    effects: [bump("villain-tough")],
  }),
);

const KIT = stubSupport({ id: "kit", cost: 0, abilities: [KIT_CONSTANT.ref] });
const IRON_WILL = stubSupport({ id: "iron-will", cost: 0, abilities: [IRON_WILL_RESPONSE.ref] });
const ORGANIC_STEEL = stubSupport({ id: "organic-steel", cost: 0, abilities: [ORGANIC_STEEL_RESPONSE.ref] });
const WATCHER = stubSupport({
  id: "watcher",
  cost: 0,
  abilities: [STUN_WATCH.ref, CONFUSE_WATCH.ref, VILLAIN_WATCH.ref],
});
const SUPPORTS = [KIT, IRON_WILL, ORGANIC_STEEL, WATCHER];

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const TOUGHEN = event("toughen", [{ kind: "giveStatus", target: hero, status: "tough" }]);
const TOUGHEN_VILLAIN = event("toughen-villain", [
  { kind: "giveStatus", target: { kind: "villain" }, status: "tough" },
]);
const STUN = event("stun", [{ kind: "giveStatus", target: hero, status: "stunned" }]);
const CONFUSE = event("confuse", [{ kind: "giveStatus", target: hero, status: "confused" }]);
const STRIP = event("strip", [{ kind: "removeStatus", target: hero, status: "tough" }]);
const ZAP = event("zap", [{ kind: "dealDamage", target: hero, amount: { kind: "const", value: 3 } }]);
const ZAP_VILLAIN = event("zap-villain", [
  { kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 3 } },
]);
// "The villain attacks you. That attack gains piercing", with no boost card, so its 2 ATK is the damage.
const PIERCE = event("pierce", [
  { kind: "enemyAttack", enemies: { kind: "villain" }, keywords: ["piercing"], boost: false },
]);
const EVENTS = [TOUGHEN, TOUGHEN_VILLAIN, STUN, CONFUSE, STRIP, ZAP, ZAP_VILLAIN, PIERCE];

const deps: EngineDeps = depsOf(
  KIT_CONSTANT,
  IRON_WILL_RESPONSE,
  ORGANIC_STEEL_RESPONSE,
  STUN_WATCH,
  CONFUSE_WATCH,
  VILLAIN_WATCH,
  ...EVENTS.map((e) => e.ability),
);

function start(): GameState {
  let state = gameAtFirstTurn({
    deps,
    cards: [...SUPPORTS, ...EVENTS.map((e) => e.card)],
    deck: [...SUPPORTS.map((s) => s.id), ...EVENTS.flatMap((e) => copiesOf(e.card.id, 4))],
  });
  for (const support of SUPPORTS) state = playerCardIntoPlay(state, support.id).state;
  return { ...state, players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
}

/** Accepts every optional response offered. */
const acceptTriggers = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
  return defaultPick(state);
};

const heroId = (state: GameState): InstanceId => state.players[0]!.identity.instanceId;
const villainId = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const supportId = (state: GameState, name: string): InstanceId =>
  state.players[0]!.playArea.find((id) => mustInstance(state, id).cardId === name)!;
const counter = (state: GameState, support: string, type: string): number =>
  mustInstance(state, supportId(state, support)).counters[type] ?? 0;

function run(state: GameState, ...commands: readonly Command[]) {
  return runCommandsPicking(state, deps, acceptTriggers, ...commands);
}
function play(state: GameState, card: string) {
  const given = giveCard(state, P1, card);
  return run(given.state, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}
const repeat = (state: GameState, card: string, times: number): GameState => {
  let s = state;
  for (let i = 0; i < times; i++) s = play(s, card).state;
  return s;
};

const discardedEvents = (events: readonly GameEvent[]): readonly TriggerEvent[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "statusDiscarded" ? [e.event] : [],
  );
const windows = (events: readonly GameEvent[]): number =>
  events.filter((e) => e.type === "windowOpened" && e.timing === "response" && e.event.kind === "statusDiscarded")
    .length;

function expectReplays(result: ReturnType<typeof run>): void {
  const replayed = replay(result.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.session.state);
}

describe("§3.5 statusDiscarded", () => {
  it("a tough card used to prevent damage is one event; Iron Will and Organic Steel each answer it", () => {
    const tough = repeat(start(), TOUGHEN.card.id, 2);
    expect(mustInstance(tough, heroId(tough)).statuses.tough).toBe(2);
    const result = play(tough, ZAP.card.id);
    const hero = mustInstance(result.state, heroId(result.state));
    expect(hero.statuses.tough).toBe(1);
    expect(hero.damage).toBe(0);
    expect(discardedEvents(result.events)).toEqual([
      { kind: "statusDiscarded", instanceId: heroId(result.state), status: "tough", cause: "preventedDamage" },
    ]);
    expect(counter(result.state, IRON_WILL.id, "drawn")).toBe(1);
    expect(counter(result.state, ORGANIC_STEEL.id, "fired")).toBe(1);
    expect(mustInstance(result.state, supportId(result.state, ORGANIC_STEEL.id)).exhausted).toBe(true);
    expect(counter(result.state, WATCHER.id, "villain-tough")).toBe(0);
    expectReplays(result);
  });

  it("piercing two tough cards is two events in one window: Iron Will twice, Organic Steel once (Q5)", () => {
    const tough = repeat(start(), TOUGHEN.card.id, 2);
    const result = play(tough, PIERCE.card.id);
    const id = heroId(result.state);
    expect(mustInstance(result.state, id).statuses.tough).toBe(0);
    expect(discardedEvents(result.events)).toEqual([
      { kind: "statusDiscarded", instanceId: id, status: "tough", cause: "piercing" },
      { kind: "statusDiscarded", instanceId: id, status: "tough", cause: "piercing" },
    ]);
    // One shared window per tier: Iron Will and Organic Steel are optional, so one optional tier opened.
    expect(windows(result.events)).toBe(1);
    expect(counter(result.state, IRON_WILL.id, "drawn")).toBe(2);
    expect(counter(result.state, ORGANIC_STEEL.id, "fired")).toBe(1);
    // The villain's 2 ATK went through: the pierced cards prevented nothing.
    expect(mustInstance(result.state, id).damage).toBe(2);
    expectReplays(result);
  });

  it("an effect discarding a status card announces it with cause 'effect'", () => {
    const tough = repeat(start(), TOUGHEN.card.id, 1);
    const result = play(tough, STRIP.card.id);
    expect(discardedEvents(result.events)).toEqual([
      { kind: "statusDiscarded", instanceId: heroId(result.state), status: "tough", cause: "effect" },
    ]);
    expect(counter(result.state, IRON_WILL.id, "drawn")).toBe(1);
    expectReplays(result);
  });

  it("a stun spent on an attack and a confuse spent on a thwart emit with their status, and the filters hold", () => {
    const stunned = play(start(), STUN.card.id).state;
    const attacked = run(stunned, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: heroId(stunned),
      targetInstanceId: villainId(stunned),
    });
    expect(mustInstance(attacked.state, heroId(attacked.state)).statuses.stunned).toBe(0);
    expect(discardedEvents(attacked.events)).toEqual([
      { kind: "statusDiscarded", instanceId: heroId(attacked.state), status: "stunned", cause: "cancelledAttack" },
    ]);
    expect(counter(attacked.state, WATCHER.id, "stunned")).toBe(1);
    expect(counter(attacked.state, WATCHER.id, "confused")).toBe(0);
    // A tough-only response does not hear a stun.
    expect(counter(attacked.state, IRON_WILL.id, "drawn")).toBe(0);
    expectReplays(attacked);

    const confused = play(start(), CONFUSE.card.id).state;
    const thwarted = run(confused, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: heroId(confused),
      schemeInstanceId: confused.mainScheme.instanceId,
    });
    expect(discardedEvents(thwarted.events)).toEqual([
      {
        kind: "statusDiscarded",
        instanceId: heroId(thwarted.state),
        status: "confused",
        cause: "cancelledSchemeOrThwart",
      },
    ]);
    expect(counter(thwarted.state, WATCHER.id, "confused")).toBe(1);
    expect(counter(thwarted.state, WATCHER.id, "stunned")).toBe(0);
    expectReplays(thwarted);
  });

  it("is filtered by target: the villain's tough card is not Colossus's", () => {
    const tough = play(start(), TOUGHEN_VILLAIN.card.id).state;
    const result = play(tough, ZAP_VILLAIN.card.id);
    expect(mustInstance(result.state, villainId(result.state)).statuses.tough).toBe(0);
    expect(discardedEvents(result.events)).toEqual([
      { kind: "statusDiscarded", instanceId: villainId(result.state), status: "tough", cause: "preventedDamage" },
    ]);
    expect(counter(result.state, WATCHER.id, "villain-tough")).toBe(1);
    expect(counter(result.state, IRON_WILL.id, "drawn")).toBe(0);
    expect(counter(result.state, ORGANIC_STEEL.id, "fired")).toBe(0);
    expectReplays(result);
  });

  it("with nothing listening, no event is pushed", () => {
    const bare = gameAtFirstTurn({
      deps,
      cards: EVENTS.map((e) => e.card),
      deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 4)),
    });
    const tough = play(bare, TOUGHEN.card.id).state;
    const result = play(tough, ZAP.card.id);
    expect(mustInstance(result.state, heroId(result.state)).statuses.tough).toBe(0);
    expect(discardedEvents(result.events)).toEqual([]);
    expect(result.events.some((e) => e.type === "statusRemoved" && e.reason === "preventedDamage")).toBe(true);
  });
});
