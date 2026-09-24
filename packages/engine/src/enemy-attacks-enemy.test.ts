/**
 * docs/phase7-wave3.md §3.23: `EffectSpec enemyAttacksEnemy`, an enemy attacking another enemy, on synthetic cards
 * shaped like Moondragon (`drax` 19013): "Choose a minion. That minion attacks another enemy of your choice."
 *
 * §4 Q12, decided by the user on 2026-09-23 (no FFG ruling exists): an attack, not an activation. No boost card, no
 * "when this minion attacks/activates" ability, nobody defends, and the ATK is dealt as attack damage, so the target's
 * tough and retaliate apply. Overkill follows RRG 1.8 "Overkill" (p. 31) as written: a minion the attack defeats spills
 * its excess onto the villain; guard (RRG 1.8 "Guard", p. 21) restricts only a player's attacks.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import { type EffectContext, matchesQuery } from "./select.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSupport } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const named = (name: string): TargetRef => ({ kind: "each", query: { name } });
const recorder = named("recorder");
const mark = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: recorder,
  counterType,
  amount: { kind: "const", value: 1 },
});

/** "When this minion attacks" / "when this minion activates": keyed on the enemy activation, as every such card is. */
const WHEN_ATTACKS = stubAbility("brute.when-attacks", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", selfIs: "source" } },
  effects: [mark("activated")],
});
/** "After this minion is attacked": fires for any attack, so it hears this one. */
const WHEN_ATTACKED = stubAbility("target.after-attacked", {
  trigger: { kind: "response", forced: true, on: { on: "characterAttacked", selfIs: "target" } },
  effects: [mark("attacked")],
});
/** "After this minion takes damage from an attack": the damage is attack damage. */
const ATTACK_DAMAGE = stubAbility("target.attack-damage", {
  trigger: { kind: "response", forced: true, on: { on: "dealDamage", selfIs: "target", fromAttack: true } },
  effects: [mark("attackDamage")],
});

const BRUTE = stubMinion({
  id: "brute",
  atk: 3,
  sch: 1,
  hp: 6,
  keywords: [{ name: "villainous" }],
  abilities: [WHEN_ATTACKS.ref],
});
const SMASHER = stubMinion({ id: "smasher", atk: 5, sch: 1, hp: 6, keywords: [{ name: "overkill" }] });
const TARGET = stubMinion({ id: "target", atk: 1, sch: 1, hp: 8, abilities: [WHEN_ATTACKED.ref, ATTACK_DAMAGE.ref] });
const SPIKY = stubMinion({ id: "spiky", atk: 1, sch: 1, hp: 8, keywords: [{ name: "retaliate", value: 2 }] });
const FRAIL = stubMinion({ id: "frail", atk: 1, sch: 1, hp: 2 });
const GUARD = stubMinion({ id: "guard", atk: 1, sch: 1, hp: 5, keywords: [{ name: "guard" }] });
const RECORDER = stubSupport({ id: "recorder", cost: 0 });
const MINIONS = [BRUTE, SMASHER, TARGET, SPIKY, FRAIL, GUARD];

const attacks = (attacker: string, target: TargetRef): EffectSpec => ({
  kind: "enemyAttacksEnemy",
  attacker: named(attacker),
  target,
  bind: "hit",
});
const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const theVillain: TargetRef = { kind: "each", query: { categories: ["villain"] } };
const BRUTE_HITS_TARGET = actionEvent("brute-hits-target", [attacks("brute", named("target"))]);
const BRUTE_HITS_SPIKY = actionEvent("brute-hits-spiky", [attacks("brute", named("spiky"))]);
const SMASHER_HITS_FRAIL = actionEvent("smasher-hits-frail", [attacks("smasher", named("frail"))]);
const SMASHER_HITS_VILLAIN = actionEvent("smasher-hits-villain", [attacks("smasher", theVillain)]);
const BRUTE_HITS_VILLAIN = actionEvent("brute-hits-villain", [attacks("brute", theVillain)]);
/** Moondragon's own shape, both choices included: "Choose a minion. That minion attacks another enemy of your choice." */
const MINION_QUERY: TargetQuery = { categories: ["minion"], canAttackOneOf: { categories: ["enemy"] } };
const CHOOSE_AND_ATTACK = actionEvent("choose-and-attack", [
  { kind: "chooseTarget", slot: "attacker", query: MINION_QUERY, chooser: { kind: "controller" } },
  {
    kind: "chooseTarget",
    slot: "attacked",
    query: {
      categories: ["enemy"],
      attackableBy: { kind: "slot", slot: "attacker" },
      excluding: { kind: "slot", slot: "attacker" },
    },
    chooser: { kind: "controller" },
  },
  {
    kind: "enemyAttacksEnemy",
    attacker: { kind: "slot", slot: "attacker" },
    target: { kind: "slot", slot: "attacked" },
  },
]);
/** The control: "This minion attacks you", a real enemy activation. */
const BRUTE_ATTACKS_YOU = actionEvent("brute-attacks-you", [{ kind: "enemyAttack", enemies: named("brute") }]);
const EVENTS = [
  BRUTE_ATTACKS_YOU,
  BRUTE_HITS_TARGET,
  BRUTE_HITS_SPIKY,
  SMASHER_HITS_FRAIL,
  SMASHER_HITS_VILLAIN,
  BRUTE_HITS_VILLAIN,
  CHOOSE_AND_ATTACK,
];

const deps: EngineDeps = depsOf(WHEN_ATTACKS, WHEN_ATTACKED, ATTACK_DAMAGE, ...EVENTS.map((e) => e.ability));

interface Table {
  readonly state: GameState;
  readonly ids: Readonly<Record<string, InstanceId>>;
  readonly recorder: InstanceId;
}

function table(minions: readonly string[]): Table {
  const base = gameAtFirstTurn({
    cards: [RECORDER, ...MINIONS, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: [...MINIONS.flatMap((m) => copiesOf(m.id, 1)), ...copiesOf(BRUTE.id, 10)],
    deck: [RECORDER.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
  });
  let state: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const placed = playerCardIntoPlay(state, RECORDER.id);
  state = placed.state;
  const ids: Record<string, InstanceId> = {};
  for (const minion of minions) {
    const engaged = minionEngagedWith(state, minion as never);
    state = engaged.state;
    ids[minion] = engaged.id;
  }
  return { state, ids, recorder: placed.id };
}

const counters = (state: GameState, id: InstanceId, type: string): number =>
  mustInstance(state, id).counters[type] ?? 0;
const villainDamage = (state: GameState): number => mustInstance(state, state.villains[0]!.instanceId).damage;
const encounterDeckSize = (state: GameState): number =>
  Object.values(state.encounterDecks).reduce((sum, piles) => sum + piles.deck.length, 0);
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

describe("§3.23 an enemy attacking another enemy (Q12: an attack, not an activation)", () => {
  it("deals no boost card, even to a villainous attacker, and asks nobody to defend", () => {
    const t = table(["brute", "target"]);
    const before = encounterDeckSize(t.state);
    const { state, events } = playFree(t.state, deps, BRUTE_HITS_TARGET.card.id);
    expect(ofType(events, "boostCardDealt")).toEqual([]);
    expect(ofType(events, "defenderDeclared")).toEqual([]);
    expect(ofType(events, "defenseDeclined")).toEqual([]);
    expect(encounterDeckSize(state)).toBe(before);
    expect(mustInstance(state, t.ids.brute!).boostCards).toEqual([]);
  });

  it("does not fire the attacker's 'when this minion attacks' (activation) abilities", () => {
    const t = table(["brute", "target"]);
    const { state } = playFree(t.state, deps, BRUTE_HITS_TARGET.card.id);
    expect(counters(state, t.recorder, "activated")).toBe(0);
  });

  it("control: the same minion's real activation does deal a boost card and fire that ability", () => {
    const t = table(["brute"]);
    const { state, events } = playFree(t.state, deps, BRUTE_ATTACKS_YOU.card.id);
    expect(counters(state, t.recorder, "activated")).toBe(1);
    expect(ofType(events, "boostCardDealt")).toHaveLength(1);
  });

  it("deals the attacker's ATK to the target as attack damage, and the target is attacked", () => {
    const t = table(["brute", "target"]);
    const { state, events } = playFree(t.state, deps, BRUTE_HITS_TARGET.card.id);
    expect(mustInstance(state, t.ids.target!).damage).toBe(3);
    expect(counters(state, t.recorder, "attackDamage")).toBe(1);
    expect(counters(state, t.recorder, "attacked")).toBe(1);
    expect(ofType(events, "enemyAttackedEnemy")).toEqual([
      { type: "enemyAttackedEnemy", attackerInstanceId: t.ids.brute, targetInstanceId: t.ids.target, damageDealt: 3 },
    ]);
  });

  it("lets the target's tough status card absorb it", () => {
    const t = table(["brute", "target"]);
    const target = t.ids.target!;
    const tough: GameState = {
      ...t.state,
      instances: {
        ...t.state.instances,
        [target]: {
          ...mustInstance(t.state, target),
          statuses: { ...mustInstance(t.state, target).statuses, tough: 1 },
        },
      },
    };
    const { state } = playFree(tough, deps, BRUTE_HITS_TARGET.card.id);
    expect(mustInstance(state, target).damage).toBe(0);
    expect(mustInstance(state, target).statuses.tough).toBe(0);
  });

  it("lets the target's retaliate hit the attacking minion", () => {
    const t = table(["brute", "spiky"]);
    const { state } = playFree(t.state, deps, BRUTE_HITS_SPIKY.card.id);
    expect(mustInstance(state, t.ids.spiky!).damage).toBe(3);
    expect(mustInstance(state, t.ids.brute!).damage).toBe(2);
  });

  it("overkill: a minion it defeats spills its excess onto the villain (RRG 1.8 'Overkill', p. 31)", () => {
    const t = table(["smasher", "frail"]);
    const { state } = playFree(t.state, deps, SMASHER_HITS_FRAIL.card.id);
    expect(state.instances[t.ids.frail!]).toBeDefined();
    expect(state.players[0]!.playArea).not.toContain(t.ids.frail);
    expect(villainDamage(state)).toBe(3);
  });

  it("overkill against the villain itself spills nowhere", () => {
    const t = table(["smasher"]);
    const { state } = playFree(t.state, deps, SMASHER_HITS_VILLAIN.card.id);
    expect(villainDamage(state)).toBe(5);
  });

  it("is not restricted by guard, which restricts only a player's attacks (RRG 1.8 'Guard', p. 21)", () => {
    const t = table(["brute", "guard"]);
    const { state } = playFree(t.state, deps, BRUTE_HITS_VILLAIN.card.id);
    expect(villainDamage(state)).toBe(3);
  });

  it("a stunned attacker removes its stun instead of attacking (RRG 1.8 'Stun', p. 41)", () => {
    const t = table(["brute", "target"]);
    const brute = t.ids.brute!;
    const stunned: GameState = {
      ...t.state,
      instances: {
        ...t.state.instances,
        [brute]: {
          ...mustInstance(t.state, brute),
          statuses: { ...mustInstance(t.state, brute).statuses, stunned: 1 },
        },
      },
    };
    const { state } = playFree(stunned, deps, BRUTE_HITS_TARGET.card.id);
    expect(mustInstance(state, brute).statuses.stunned).toBe(0);
    expect(mustInstance(state, t.ids.target!).damage).toBe(0);
    expect(counters(state, t.recorder, "attacked")).toBe(0);
  });

  it("runs Moondragon's shape through both choices: the chosen minion attacks the chosen enemy", () => {
    const t = table(["brute", "target"]);
    const pick = (s: GameState): readonly string[] => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "chooseTarget" && choice.prompt.slot === "attacker") return [t.ids.brute!];
      if (choice?.prompt.kind === "chooseTarget" && choice.prompt.slot === "attacked") return [t.ids.target!];
      return defaultPick(s);
    };
    const handed = playerCardIntoPlay(t.state, CHOOSE_AND_ATTACK.card.id);
    const inHand: GameState = {
      ...handed.state,
      players: handed.state.players.map((p) =>
        p.playerId === P1
          ? { ...p, playArea: p.playArea.filter((id) => id !== handed.id), hand: [...p.hand, handed.id] }
          : p,
      ),
    };
    const { state } = runCommandsPicking(inHand, deps, pick, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: handed.id,
      payment: [],
      attachToInstanceId: null,
    });
    expect(mustInstance(state, t.ids.target!).damage).toBe(3);
    expect(villainDamage(state)).toBe(0);
  });

  it("a minion with no other enemy it may attack is not a valid choice (RRG 1.8 'Target', pp. 42–43)", () => {
    const context = (d: EngineDeps): EffectContext => ({
      selfInstanceId: null,
      controllerId: P1,
      event: null,
      bindings: {},
      deps: d,
    });
    // The villain is another enemy, so a lone minion can still be chosen.
    const t = table(["brute"]);
    expect(matchesQuery(t.state, t.ids.brute!, MINION_QUERY, context(deps))).toBe(true);
    // With the villain made unattackable ("cannot be attacked"), a lone minion has nothing to attack.
    const wallRule = stubAbility("wall.constant", {
      trigger: { kind: "constant", rules: [{ kind: "cannotAttack", target: { categories: ["villain"] } }] },
      effects: [],
    });
    const WALL = stubSupport({ id: "wall", cost: 0, abilities: [wallRule.ref] });
    const wallDeps = depsOf(wallRule);
    const walled = playerCardIntoPlay(
      gameAtFirstTurn({ cards: [WALL, BRUTE], deps: wallDeps, encounter: copiesOf(BRUTE.id, 5), deck: [WALL.id] }),
      WALL.id,
    ).state;
    const lone = minionEngagedWith(walled, BRUTE.id);
    expect(matchesQuery(lone.state, lone.id, MINION_QUERY, context(wallDeps))).toBe(false);
    // A second minion is another enemy again.
    const pair = minionEngagedWith(lone.state, BRUTE.id);
    expect(matchesQuery(pair.state, lone.id, MINION_QUERY, context(wallDeps))).toBe(true);
  });
});
