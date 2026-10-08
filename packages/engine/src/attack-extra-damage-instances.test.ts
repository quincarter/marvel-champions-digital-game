/**
 * Owner ruling Q53 (docs/phase7-wave8.md §4.1): "that attack deals N additional damage" (`modifyAttack.extraDamage`)
 * modifies the attack, so every instance of damage an "(attack)" ability's attack deals is increased, whether the
 * ability makes its attack with an `attack` effect and then deals more damage, or is a label-only attack.
 *
 * Sources: RRG 1.8 "Attack (Player Ability Type)" (p. 10): "When an attack ability has its damage increased by another
 * ability, each instance of damage in that attack ability that does not use the word 'additional' is increased by the
 * specified amount" and "An ability that increases the damage of an attack only increases the damage of one of that
 * ability's attacks"; "'For Each'" (p. 20); "Alteration Effect" (p. 7), "Additional", with the Repulsor Blast FAQ:
 * additional damage is a simultaneous modification of the instance it modifies. Synthetic cards only.
 */
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubSupport } from "./testing/fixtures.js";
import { gameAtFirstTurn, minionEngagedWith, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const c = (value: number) => ({ kind: "const", value }) as const;
const villain: TargetRef = { kind: "villain" };
const you: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const minions: TargetRef = { kind: "each", query: { categories: ["minion"] } };
const hit = (
  n: number,
  target: TargetRef,
  more: Partial<Extract<EffectSpec, { kind: "dealDamage" }>> = {},
): EffectSpec => ({
  kind: "dealDamage",
  target,
  amount: c(n),
  ...more,
});
const strike = (n: number, target: TargetRef): EffectSpec => ({ kind: "attack", target, amount: c(n) });

const abilities: StubAbility[] = [];
const attackEvent = (id: string, effects: readonly EffectSpec[], label = true) => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    ...(label ? { label: ["attack"] } : {}),
    effects,
  } satisfies AbilityDefinition);
  abilities.push(ability);
  return stubEvent({ id, cost: 0, abilities: [ability.ref] });
};

/** "(attack): Deal 3 damage to the villain. Deal 1 damage to each minion." (an `attack`, then more damage) */
const SWEEP = attackEvent("sweep", [strike(3, villain), hit(1, minions)]);
/** "(attack): Deal 2 damage to the villain. Deal 2 damage to the villain." (twice the same enemy) */
const DOUBLE = attackEvent("double", [strike(2, villain), hit(2, villain)]);
/** "(attack): Deal 2 damage to the villain. … deal 2 additional damage to it." */
const RIDER = attackEvent("rider", [strike(2, villain), hit(2, villain, { additional: true })]);
/** A label-only attack with a rider: "(attack): Deal 2 damage to the villain. Deal 1 to it. … 2 additional damage." */
const VOLLEY = attackEvent("volley", [hit(2, villain), hit(1, villain), hit(2, villain, { additional: true })]);
/** Two attacks in one ability, then more damage: "(attack): Attack the villain for 2, each minion for 2; deal 1 to each minion." */
const PAIR = attackEvent("pair", [strike(2, villain), strike(2, minions), hit(1, minions)]);
/** "(attack): Deal 3 damage to the villain. Deal 1 damage to each minion (not from this attack). Take 1 damage." */
const ASIDE = attackEvent("aside", [strike(3, villain), hit(1, minions, { fromAttack: false }), hit(1, you)]);

/** "Forced Interrupt: When your hero attacks, that attack deals 2 additional damage. (Limit once per phase.)" */
const EDGE_INTERRUPT = stubAbility("edge.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "attack", sourceIs: { categories: ["identity"], controller: "you" } },
  },
  limit: { count: 1, period: "phase" },
  effects: [{ kind: "modifyAttack", extraDamage: c(2) }],
});
const EDGE = stubSupport({ id: "edge", cost: 0, abilities: [EDGE_INTERRUPT.ref] });
const THUG = stubMinion({ id: "thug", atk: 0, sch: 0, hp: 9, boostIcons: 0 });

const EVENTS = [SWEEP, DOUBLE, RIDER, VOLLEY, PAIR, ASIDE];
const deps = depsOf(...abilities, EDGE_INTERRUPT);

/** Hero form with a thug engaged; `edge` puts the "+2 to that attack" support in play. */
function table(edge: boolean) {
  let state = gameAtFirstTurn({
    cards: [...EVENTS, EDGE, THUG],
    deps,
    deck: [...EVENTS.map((card) => card.id), EDGE.id],
    encounter: [THUG.id],
  });
  state = { ...state, players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
  if (edge) state = playerCardIntoPlay(state, EDGE.id).state;
  const thug = minionEngagedWith(state, THUG.id);
  return { state: thug.state, thug: thug.id };
}
/** Every instance of damage dealt to `target` while `card` resolves, in order, and the damage the hero took. */
function play(card: (typeof EVENTS)[number], edge: boolean) {
  const t = table(edge);
  const run = playFree(t.state, deps, card.id);
  const replayed = replay(run.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(run.session.state);
  const to = (id: InstanceId): number[] =>
    run.events.flatMap((event: GameEvent) =>
      event.type === "damageDealt" && event.targetInstanceId === id ? [event.amount] : [],
    );
  const state: GameState = run.state;
  const hero = state.players[0]!.identity.instanceId;
  return { villain: to(state.activeVillainId), thug: to(t.thug), hero: mustInstance(state, hero).damage };
}

describe("Q53: 'that attack deals N additional damage' increases each instance of the attack's damage", () => {
  it("an `attack` and then more damage: the attack's own instance and the later one both get it", () => {
    expect(play(SWEEP, false)).toMatchObject({ villain: [3], thug: [1] });
    expect(play(SWEEP, true)).toMatchObject({ villain: [5], thug: [3] });
  });

  it("two instances against the same enemy each get it", () => {
    expect(play(DOUBLE, false).villain).toEqual([2, 2]);
    expect(play(DOUBLE, true).villain).toEqual([4, 4]);
  });

  it("an instruction that is additional damage does not get it a second time", () => {
    expect(play(RIDER, false).villain).toEqual([2, 2]);
    expect(play(RIDER, true).villain).toEqual([4, 2]);
  });

  it("the same on a label-only attack: each instance, not the additional rider", () => {
    expect(play(VOLLEY, false).villain).toEqual([2, 1, 2]);
    expect(play(VOLLEY, true).villain).toEqual([4, 3, 2]);
  });

  it("an ability that makes two attacks: one attack gets it, the other attack and its later instance do not", () => {
    expect(play(PAIR, false)).toMatchObject({ villain: [2], thug: [2, 1] });
    // The limited interrupt answered the first attack (the villain's); the second attack and the damage after it,
    // which is that second attack's, are as printed.
    expect(play(PAIR, true)).toMatchObject({ villain: [4], thug: [2, 1] });
  });

  it("damage that is not the attack's gets nothing: `fromAttack: false`, and damage to the ability's own player", () => {
    expect(play(ASIDE, false)).toEqual({ villain: [3], thug: [1], hero: 1 });
    expect(play(ASIDE, true)).toEqual({ villain: [5], thug: [1], hero: 1 });
  });
});
