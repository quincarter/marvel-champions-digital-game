/**
 * `AbilityCost.damageSelf` ("Take N damage →": Focused Rage `01027`, The Search for Spiral `39016`), on synthetic cards.
 *
 * RRG 1.8 "Cost" (p. 14): "If taking damage is a cost, that cost is not considered paid unless all of that damage was
 * taken. (If any of the damage is prevented, then the cost has not been paid.)" FAQ "Focused Rage (#27)" (p. 57): "The
 * tough status card prevents She-Hulk from 'tak[ing] 1 damage,' so the ability's cost cannot be paid. Because you cannot
 * partially pay a cost, you cannot attempt to pay the cost of Focused Rage's ability just to remove She-Hulk's tough
 * status card." So a cost that would certainly be prevented is not offered (as for `indirectDamage` and `damageCards`);
 * one an interrupt prevents as it is paid is settled unpaid and the ability's effects do not resolve.
 */

import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSupport } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const DRAW_2: EffectSpec = { kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 2 } };
const YOUR_IDENTITY = { categories: ["identity"], controller: "you" } as const;

/** "Action: Take 2 damage → draw 2 cards." */
const RAGE_ABILITY = stubAbility("rage.action", {
  trigger: { kind: "action" },
  cost: { damageSelf: 2 } satisfies AbilityCost,
  effects: [DRAW_2],
});
const RAGE = stubSupport({ id: "rage", cost: 0, abilities: [RAGE_ABILITY.ref] });

const onYourIdentityDamage = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.interrupt`, {
    trigger: { kind: "interrupt", forced: true, on: { on: "dealDamage", targetIs: YOUR_IDENTITY } },
    effects,
  });
  return { ability, card: stubSupport({ id, cost: 0, abilities: [ability.ref] }) };
};
/** "Forced Interrupt: when your identity would take damage, prevent 1 of it." */
const SHIELD = onYourIdentityDamage("shield", [{ kind: "preventDamage", amount: { kind: "const", value: 1 } }]);
/** "Forced Interrupt: when your identity would take damage, prevent all of it." */
const WALL = onYourIdentityDamage("wall", [{ kind: "preventDamage" }]);
/** "Forced Interrupt: when your identity would take damage, give it a tough status card." */
const ARMOR = onYourIdentityDamage("armor", [{ kind: "giveStatus", target: { kind: "eventTarget" }, status: "tough" }]);

const constantSupport = (id: string, rule: RuleSpec) => {
  const ability = stubAbility(`${id}.constant`, { trigger: { kind: "constant", rules: [rule] }, effects: [] });
  return { ability, card: stubSupport({ id, cost: 0, abilities: [ability.ref] }) };
};
const WARD = constantSupport("ward", { kind: "cannotTakeDamage", target: YOUR_IDENTITY });
const AEGIS = constantSupport("aegis", { kind: "preventAllDamage", target: YOUR_IDENTITY });
const PADDING = constantSupport("padding", { kind: "reduceDamageTaken", target: YOUR_IDENTITY, amount: 1 });

const STUBS = [SHIELD, WALL, ARMOR, WARD, AEGIS, PADDING];
const deps: EngineDeps = depsOf(RAGE_ABILITY, ...STUBS.map((s) => s.ability));

const start = (): GameState =>
  gameAtFirstTurn({
    cards: [RAGE, ...STUBS.map((s) => s.card)],
    deps,
    deck: [RAGE.id, ...STUBS.map((s) => s.card.id)],
  });

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

const useRage = (rage: InstanceId): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: rage,
  abilityId: RAGE_ABILITY.ref.id,
  payment: [],
});

function offered(state: GameState, rage: InstanceId): boolean {
  const actions = legalActions(state, P1, deps);
  if (actions.kind !== "turn") throw new Error(`expected P1's turn, got ${actions.kind}`);
  return actions.legal.some((a) => a.action.kind === "useAbility" && a.action.instanceId === rage);
}

function run(state: GameState, command: Command) {
  const { session, events } = driveSession(startSession(state), deps, [command]);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}

const identityOf = (state: GameState): InstanceId => mustPlayer(state, P1).identity.instanceId;
const handSize = (state: GameState): number => mustPlayer(state, P1).hand.length;
const resolved = (events: readonly GameEvent[]): number =>
  events.findIndex((e) => e.type === "abilityResolved" && e.abilityId === RAGE_ABILITY.ref.id);
const withTough = (state: GameState): GameState => {
  const id = identityOf(state);
  const instance = mustInstance(state, id);
  return {
    ...state,
    instances: { ...state.instances, [id]: { ...instance, statuses: { ...instance.statuses, tough: 1 } } },
  };
};

describe("`AbilityCost.damageSelf`: take 2 damage → draw 2 cards", () => {
  it("all of it taken: the cost is paid, the damage lands before the effect resolves", () => {
    const { state, ids } = inPlay(start(), RAGE.id);
    const rage = ids[0]!;
    expect(offered(state, rage)).toBe(true);
    const hand = handSize(state);
    const { state: after, events } = run(state, useRage(rage));
    expect(mustInstance(after, identityOf(after)).damage).toBe(2);
    expect(handSize(after)).toBe(hand + 2);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "costDamageSettled", amount: 2, taken: 2, paid: true }),
    );
    const damaged = events.findIndex((e) => e.type === "damageDealt" && e.targetInstanceId === identityOf(after));
    expect(damaged).toBeGreaterThanOrEqual(0);
    expect(damaged).toBeLessThan(resolved(events));
  });

  it("a tough status card already on the identity: not offered, refused, the tough card stays (FAQ #27)", () => {
    const { state, ids } = inPlay(start(), RAGE.id);
    const tough = withTough(state);
    expect(offered(tough, ids[0]!)).toBe(false);
    expect(applyCommand(tough, useRage(ids[0]!), deps).ok).toBe(false);
    expect(mustInstance(tough, identityOf(tough)).statuses.tough).toBe(1);
  });

  it("a constant that would prevent or reduce it: not offered (cannot take damage, prevent all, take 1 less)", () => {
    for (const blocker of [WARD, AEGIS, PADDING]) {
      const { state, ids } = inPlay(start(), RAGE.id, blocker.card.id);
      expect(offered(state, ids[0]!)).toBe(false);
      expect(applyCommand(state, useRage(ids[0]!), deps).ok).toBe(false);
    }
  });

  it("a tough status card an interrupt gives as it is paid absorbs it: unpaid, no draw, the tough card is discarded", () => {
    const { state, ids } = inPlay(start(), RAGE.id, ARMOR.card.id);
    expect(offered(state, ids[0]!)).toBe(true); // an interrupt can't be known before paying
    const hand = handSize(state);
    const { state: after, events } = run(state, useRage(ids[0]!));
    const identity = mustInstance(after, identityOf(after));
    expect(identity.damage).toBe(0);
    expect(identity.statuses.tough).toBe(0); // the damage was dealt and prevented by it
    expect(events).toContainEqual(expect.objectContaining({ type: "damagePrevented", reason: "tough" }));
    expect(handSize(after)).toBe(hand);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "costDamageSettled", amount: 2, taken: 0, paid: false }),
    );
    expect(resolved(events)).toBe(-1);
  });

  it("an interrupt that prevents some of it: 1 of 2 taken is not paid, the effect does not resolve", () => {
    const { state, ids } = inPlay(start(), RAGE.id, SHIELD.card.id);
    expect(offered(state, ids[0]!)).toBe(true);
    const hand = handSize(state);
    const { state: after, events } = run(state, useRage(ids[0]!));
    expect(mustInstance(after, identityOf(after)).damage).toBe(1); // the rest is still taken
    expect(handSize(after)).toBe(hand);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "costDamageSettled", amount: 2, taken: 1, paid: false }),
    );
    expect(resolved(events)).toBe(-1);
  });

  it("an interrupt that prevents all of it: unpaid, the effect does not resolve", () => {
    const { state, ids } = inPlay(start(), RAGE.id, WALL.card.id);
    const hand = handSize(state);
    const { state: after, events } = run(state, useRage(ids[0]!));
    expect(mustInstance(after, identityOf(after)).damage).toBe(0);
    expect(handSize(after)).toBe(hand);
    expect(events).toContainEqual(
      expect.objectContaining({ type: "costDamageSettled", amount: 2, taken: 0, paid: false }),
    );
    expect(resolved(events)).toBe(-1);
  });
});
