/**
 * docs/phase7-wave7.md §3.79: `AbilityCost.damageSelf` with `choose`, a damage cost whose amount the payer picks, on
 * synthetic cards shaped like Maximum Effort (`deadpool` 44004: "Hero Action (attack): Take any amount of damage up to
 * your remaining hit points → deal an equal amount of damage to an enemy").
 *
 * Sources: RRG 1.8 "Cost" (p. 14): "If taking damage is a cost, that cost is not considered paid unless all of that
 * damage was taken. (If any of the damage is prevented, then the cost has not been paid.)" FAQ "Focused Rage (#27)"
 * (p. 57): a cost a tough status card would prevent "cannot be paid", and "you cannot partially pay a cost". "Cost
 * Arrow Icon" (p. 14): the text before the arrow is paid, and answered, before the text after it resolves. Owner
 * decision, docs/phase7-wave7.md §4.1 Q46 = B: 0 damage may be chosen; the event then does nothing but counts as
 * played.
 */

import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const HERO_HP = 10;
const yourIdentity: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const value = (n: number): ValueSpec => ({ kind: "const", value: n });
const remainingHp: ValueSpec = { kind: "remainingHp", of: yourIdentity };
const YOUR_IDENTITY = { categories: ["identity"], controller: "you" } as const;
/** "Deal an equal amount of damage to the villain." */
const EQUAL_DAMAGE: EffectSpec = {
  kind: "dealDamage",
  target: { kind: "villain" },
  amount: { kind: "var", name: "cost.damageSelf" },
};
const anyAmount = (min: number, max: ValueSpec): AbilityCost => ({ damageSelf: { choose: { min: value(min), max } } });

/** "Action: Take any amount of damage up to your remaining hit points → deal an equal amount of damage to the villain." */
const EFFORT_ABILITY = stubAbility("effort.action", {
  trigger: { kind: "action" },
  cost: anyAmount(0, remainingHp),
  effects: [EQUAL_DAMAGE],
});
const EFFORT = stubSupport({ id: "effort", cost: 0, abilities: [EFFORT_ABILITY.ref] });
/** The same text on an event, played from hand. */
const BURST_ABILITY = stubAbility("burst.action", {
  trigger: { kind: "action" },
  cost: anyAmount(0, remainingHp),
  effects: [EQUAL_DAMAGE],
});
const BURST = stubEvent({ id: "burst", cost: 0, abilities: [BURST_ABILITY.ref] });
/** "Action: Take 2, 3 or 4 damage → deal an equal amount of damage to the villain." */
const TOLL_ABILITY = stubAbility("toll.action", {
  trigger: { kind: "action" },
  cost: anyAmount(2, value(4)),
  effects: [EQUAL_DAMAGE],
});
const TOLL = stubSupport({ id: "toll", cost: 0, abilities: [TOLL_ABILITY.ref] });
/** A range with nothing in it: at least 3, at most 2. */
const EMPTY_ABILITY = stubAbility("empty.action", {
  trigger: { kind: "action" },
  cost: anyAmount(3, value(2)),
  effects: [EQUAL_DAMAGE],
});
const EMPTY = stubSupport({ id: "empty", cost: 0, abilities: [EMPTY_ABILITY.ref] });

const onYourIdentityDamage = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.interrupt`, {
    trigger: { kind: "interrupt", forced: true, on: { on: "dealDamage", targetIs: YOUR_IDENTITY } },
    effects,
  });
  return { ability, card: stubSupport({ id, cost: 0, abilities: [ability.ref] }) };
};
/** "Forced Interrupt: when your identity would take damage, prevent 1 of it." */
const SHIELD = onYourIdentityDamage("shield", [{ kind: "preventDamage", amount: value(1) }]);
const constantSupport = (id: string, rule: RuleSpec) => {
  const ability = stubAbility(`${id}.constant`, { trigger: { kind: "constant", rules: [rule] }, effects: [] });
  return { ability, card: stubSupport({ id, cost: 0, abilities: [ability.ref] }) };
};
const WARD = constantSupport("ward", { kind: "cannotTakeDamage", target: YOUR_IDENTITY });
const AEGIS = constantSupport("aegis", { kind: "preventAllDamage", target: YOUR_IDENTITY });
const PADDING = constantSupport("padding", { kind: "reduceDamageTaken", target: YOUR_IDENTITY, amount: 1 });

const ACTIONS = [EFFORT_ABILITY, BURST_ABILITY, TOLL_ABILITY, EMPTY_ABILITY];
const STUBS = [SHIELD, WARD, AEGIS, PADDING];
const CARDS = [EFFORT, BURST, TOLL, EMPTY, ...STUBS.map((s) => s.card)];
const deps: EngineDeps = depsOf(...ACTIONS, ...STUBS.map((s) => s.ability));

const start = (): GameState => gameAtFirstTurn({ cards: CARDS, deps, deck: CARDS.map((card) => card.id) });

function inPlay(state: GameState, ...cards: readonly string[]): { state: GameState; ids: InstanceId[] } {
  const ids: InstanceId[] = [];
  let current = state;
  for (const card of cards) {
    const placed = playerCardIntoPlay(current, card as never);
    current = placed.state;
    ids.push(placed.id);
  }
  return { state: current, ids };
}

const use = (card: InstanceId, abilityId: string): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: card,
  abilityId: abilityId as never,
  payment: [],
});
const useEffort = (card: InstanceId): Command => use(card, EFFORT_ABILITY.ref.id);

function offered(state: GameState, card: InstanceId): boolean {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(`expected P1's turn, got ${actions.kind}`);
  return actions.legal.some((a) => a.action.kind === "useAbility" && a.action.instanceId === card);
}

/** Runs `command`, answering the cost's `chooseNumber` choice with `amount`; records every range that was asked. */
function run(state: GameState, command: Command, amount: number) {
  const asked: { min: number; max: number; options: string[] }[] = [];
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (choice?.prompt.kind !== "chooseNumber") return defaultPick(current);
    asked.push({ min: choice.prompt.min, max: choice.prompt.max, options: choice.options.map((o) => o.optionId) });
    return [String(amount)];
  };
  const { state: after, events, session } = runCommandsPicking(state, deps, pick, command);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(after);
  return { state: after, events, asked };
}

const identityOf = (state: GameState): InstanceId => mustPlayer(state, P1).identity.instanceId;
const identityDamage = (state: GameState): number => mustInstance(state, identityOf(state)).damage;
const villainDamage = (state: GameState): number => mustInstance(state, activeVillain(state).instanceId).damage;
const settled = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "costDamageSettled" ? [{ amount: e.amount, taken: e.taken, paid: e.paid }] : []));
const resolvedAt = (events: readonly GameEvent[], abilityId: string): number =>
  events.findIndex((e) => e.type === "abilityResolved" && e.abilityId === abilityId);
const identityHits = (state: GameState, events: readonly GameEvent[]): number =>
  events.filter((e) => e.type === "damageDealt" && e.targetInstanceId === identityOf(state)).length;
function withIdentity(state: GameState, change: { damage?: number; tough?: number }): GameState {
  const id = identityOf(state);
  const instance = mustInstance(state, id);
  return {
    ...state,
    instances: {
      ...state.instances,
      [id]: {
        ...instance,
        damage: change.damage ?? instance.damage,
        statuses: { ...instance.statuses, tough: change.tough ?? instance.statuses.tough },
      },
    },
  };
}

describe("§3.79 the choice: any amount from 0 to your remaining hit points", () => {
  it("asks for one number from 0 to 10 on an undamaged 10 hit point identity", () => {
    const { state, ids } = inPlay(start(), EFFORT.id);
    expect(offered(state, ids[0]!)).toBe(true);
    const { asked } = run(state, useEffort(ids[0]!), 3);
    expect(asked).toEqual([
      { min: 0, max: HERO_HP, options: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] },
    ]);
  });

  it("with 4 damage already sustained, the range ends at the 6 hit points remaining", () => {
    const { state, ids } = inPlay(start(), EFFORT.id);
    const { asked } = run(withIdentity(state, { damage: 4 }), useEffort(ids[0]!), 1);
    expect(asked.map(({ min, max }) => ({ min, max }))).toEqual([{ min: 0, max: 6 }]);
  });

  it("choosing 3: 3 damage taken as the cost, then 3 dealt, read from `cost.damageSelf`", () => {
    const { state, ids } = inPlay(start(), EFFORT.id);
    const { state: after, events } = run(state, useEffort(ids[0]!), 3);
    expect(identityDamage(after)).toBe(3);
    expect(villainDamage(after)).toBe(3);
    expect(settled(events)).toEqual([{ amount: 3, taken: 3, paid: true }]);
    expect(events).toContainEqual(expect.objectContaining({ type: "numberChosen", playerId: P1, amount: 3 }));
    const hit = events.findIndex((e) => e.type === "damageDealt" && e.targetInstanceId === identityOf(after));
    expect(hit).toBeGreaterThanOrEqual(0);
    expect(hit).toBeLessThan(resolvedAt(events, EFFORT_ABILITY.ref.id));
  });

  it("choosing 0 (Q46 = B): no damage is dealt to anyone, the cost is paid and the ability resolves", () => {
    const { state, ids } = inPlay(start(), EFFORT.id);
    const { state: after, events } = run(state, useEffort(ids[0]!), 0);
    expect(identityDamage(after)).toBe(0);
    expect(villainDamage(after)).toBe(0);
    expect(identityHits(after, events)).toBe(0);
    expect(settled(events)).toEqual([{ amount: 0, taken: 0, paid: true }]);
    expect(resolvedAt(events, EFFORT_ABILITY.ref.id)).toBeGreaterThanOrEqual(0);
  });

  it("on an event: the pick reaches the event's effect, and choosing 0 still plays the card", () => {
    const given = giveCard(start(), P1, BURST.id);
    const play: Command = {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    };
    const four = run(given.state, play, 4);
    expect(identityDamage(four.state)).toBe(4);
    expect(villainDamage(four.state)).toBe(4);
    expect(settled(four.events)).toEqual([{ amount: 4, taken: 4, paid: true }]);
    const none = run(given.state, play, 0);
    expect(identityDamage(none.state)).toBe(0);
    expect(villainDamage(none.state)).toBe(0);
    expect(mustPlayer(none.state, P1).discard).toContain(given.id);
    expect(none.events).toContainEqual(expect.objectContaining({ type: "cardPlayed", instanceId: given.id }));
  });
});

describe("§3.79 only amounts that can all be taken are offered (RRG 'Cost', p. 14; FAQ #27)", () => {
  it("a tough status card on the identity: 0 is the only amount, nobody is asked, the tough card stays", () => {
    const { state, ids } = inPlay(start(), EFFORT.id);
    const tough = withIdentity(state, { tough: 1 });
    expect(offered(tough, ids[0]!)).toBe(true);
    const { state: after, events, asked } = run(tough, useEffort(ids[0]!), 5);
    expect(asked).toEqual([]);
    expect(mustInstance(after, identityOf(after)).statuses.tough).toBe(1);
    expect(identityDamage(after)).toBe(0);
    expect(villainDamage(after)).toBe(0);
    expect(settled(events)).toEqual([{ amount: 0, taken: 0, paid: true }]);
  });

  it("a constant that would prevent or reduce it (cannot take damage, prevent all, take 1 less): 0 only", () => {
    for (const blocker of [WARD, AEGIS, PADDING]) {
      const { state, ids } = inPlay(start(), EFFORT.id, blocker.card.id);
      const { state: after, events, asked } = run(state, useEffort(ids[0]!), 5);
      expect(asked).toEqual([]);
      expect(identityDamage(after)).toBe(0);
      expect(settled(events)).toEqual([{ amount: 0, taken: 0, paid: true }]);
    }
  });

  it("a minimum above 0 that cannot be taken: not offered and refused, the tough card stays", () => {
    const { state, ids } = inPlay(start(), TOLL.id);
    expect(offered(state, ids[0]!)).toBe(true);
    const tough = withIdentity(state, { tough: 1 });
    expect(offered(tough, ids[0]!)).toBe(false);
    const refused = applyCommand(tough, use(ids[0]!, TOLL_ABILITY.ref.id), deps);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("insufficient_resources");
    expect(mustInstance(tough, identityOf(tough)).statuses.tough).toBe(1);
  });

  it("a printed range of 2 to 4 offers 2, 3 and 4; choosing 4 takes 4 and deals 4", () => {
    const { state, ids } = inPlay(start(), TOLL.id);
    const four = run(state, use(ids[0]!, TOLL_ABILITY.ref.id), 4);
    expect(four.asked).toEqual([{ min: 2, max: 4, options: ["2", "3", "4"] }]);
    expect(identityDamage(four.state)).toBe(4);
    expect(villainDamage(four.state)).toBe(4);
  });

  it("an empty range (at least 3, at most 2) cannot be paid", () => {
    const { state, ids } = inPlay(start(), EMPTY.id);
    expect(offered(state, ids[0]!)).toBe(false);
    expect(applyCommand(state, use(ids[0]!, EMPTY_ABILITY.ref.id), deps).ok).toBe(false);
  });
});

describe("§3.79 the chosen damage is a cost: all of it taken, or not paid", () => {
  it("an interrupt prevents 1 of the 3 chosen: 2 taken, the cost is not paid, the effect does not resolve", () => {
    const { state, ids } = inPlay(start(), EFFORT.id, SHIELD.card.id);
    expect(offered(state, ids[0]!)).toBe(true); // an interrupt can't be known before paying
    const { state: after, events, asked } = run(state, useEffort(ids[0]!), 3);
    expect(asked.map(({ min, max }) => ({ min, max }))).toEqual([{ min: 0, max: HERO_HP }]);
    expect(identityDamage(after)).toBe(2); // the rest is still taken
    expect(villainDamage(after)).toBe(0);
    expect(settled(events)).toEqual([{ amount: 3, taken: 2, paid: false }]);
    expect(resolvedAt(events, EFFORT_ABILITY.ref.id)).toBe(-1);
  });

  it("choosing 0 beside that interrupt: nothing to prevent, paid", () => {
    const { state, ids } = inPlay(start(), EFFORT.id, SHIELD.card.id);
    const { state: after, events } = run(state, useEffort(ids[0]!), 0);
    expect(identityDamage(after)).toBe(0);
    expect(events.some((e) => e.type === "damagePrevented")).toBe(false);
    expect(settled(events)).toEqual([{ amount: 0, taken: 0, paid: true }]);
  });

  it("choosing every remaining hit point pays the cost in full: 6 of 6 taken, and the identity is defeated by it", () => {
    const { state, ids } = inPlay(start(), EFFORT.id);
    const { events } = run(withIdentity(state, { damage: 4 }), useEffort(ids[0]!), 6);
    const hit = events.find((e) => e.type === "damageDealt" && e.targetInstanceId === identityOf(state));
    expect(hit).toEqual(expect.objectContaining({ amount: 6 }));
    expect(events.some((e) => e.type === "playerEliminated" || e.type === "gameEnded")).toBe(true);
  });
});
