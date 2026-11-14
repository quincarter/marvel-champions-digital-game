/**
 * "When/After [this card] is attacked" also hears an enemy's attack on it (`patternHearsKind`, trigger-events.ts):
 * a pattern on `attack` with the card as its target answers an `enemyAttacksEnemy` with this card the enemy attacked.
 * Rules-expert reading, 2026-11-12: an enemy is a character (RRG 1.8 "Character", p. 12), and the owner's decision on
 * enemy-against-enemy attacks (docs/phase7-wave3.md §4 Q12, §3.23) already applies the target's tough, damage reduction
 * and retaliate to them; no FFG ruling covers it. Synthetic cards shaped like Sinister Syndicate's Shocker ("After
 * Shocker is attacked, stun the attacking character", `hood` 24045) and Speed Demon ("When a character attacks Speed
 * Demon, Speed Demon attacks that character", 24046), and like Black Widow's "a character you control attacks" (`aos`
 * 50064), which names a player's attacker.
 *
 * Also `RuleSpec cannotHaveStatus.from` ("Minions cannot ... stun him", The Punisher community scenario): a "cannot"
 * stops the effect, not the trigger (RRG 1.8 "'Cannot'", p. 11).
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubSupport, stubVillain } from "./testing/fixtures.js";
import { runCommands } from "./testing/drive.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const named = (name: string): TargetRef => ({ kind: "each", query: { name } });
const theVillain: TargetRef = { kind: "each", query: { categories: ["villain"] } };
const mark = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: named("recorder"),
  counterType,
  amount: { kind: "const", value: 1 },
});

/** "Forced Response: After Shocker is attacked, stun the attacking character." */
const SHOCKER_RESPONSE = stubAbility("shocker.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "attack", selfIs: "target" } },
  effects: [{ kind: "giveStatus", target: { kind: "eventSource" }, status: "stunned" }],
});
/** "Forced Interrupt: When a character attacks Speed Demon, Speed Demon attacks that character." */
const SPEEDY_INTERRUPT = stubAbility("speedy.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "attack", selfIs: "target" } },
  effects: [{ kind: "enemyAttack", enemies: { kind: "self" }, targetCharacter: { kind: "eventSource" } }],
});
/** "When a character **you control** attacks Black Widow": a player's attacker only. */
const WIDOW_INTERRUPT = stubAbility("widow.forced-interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "attack", selfIs: "target", sourceIs: { not: { controller: "encounter" } } },
  },
  effects: [mark("widow")],
});
/** "Minions cannot attack or stun him" on the villain. */
const VILLAIN_CONSTANT = stubAbility("vigilante.constant", {
  trigger: {
    kind: "constant",
    rules: [
      { kind: "cannotAttack", attacker: { categories: ["minion"] }, target: { self: true } },
      { kind: "cannotHaveStatus", target: { self: true }, statuses: ["stunned"], from: { categories: ["minion"] } },
    ],
  },
  effects: [],
});
const VIGILANTE = stubVillain({
  id: "vigilante",
  stages: [{ hp: flat(30), atk: 2, sch: 1, abilities: [VILLAIN_CONSTANT.ref] }],
});

const BRUTE = stubMinion({ id: "brute", atk: 3, sch: 1, hp: 30 });
const SHOCKER = stubMinion({ id: "shocker", atk: 1, sch: 1, hp: 30, abilities: [SHOCKER_RESPONSE.ref] });
const SPEEDY = stubMinion({ id: "speedy", atk: 2, sch: 1, hp: 30, abilities: [SPEEDY_INTERRUPT.ref] });
const WIDOW = stubMinion({ id: "widow", atk: 1, sch: 1, hp: 30, abilities: [WIDOW_INTERRUPT.ref] });
const RECORDER = stubSupport({ id: "recorder", cost: 0 });
const MINIONS = [BRUTE, SHOCKER, SPEEDY, WIDOW];

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const attack = (attacker: TargetRef, target: string): EffectSpec => ({
  kind: "enemyAttacksEnemy",
  attacker,
  target: named(target),
});
const BRUTE_HITS_SHOCKER = actionEvent("brute-hits-shocker", [attack(named("brute"), "shocker")]);
const BRUTE_HITS_SPEEDY = actionEvent("brute-hits-speedy", [attack(named("brute"), "speedy")]);
const BRUTE_HITS_WIDOW = actionEvent("brute-hits-widow", [attack(named("brute"), "widow")]);
const VILLAIN_HITS_SHOCKER = actionEvent("villain-hits-shocker", [attack(theVillain, "shocker")]);
const VILLAIN_HITS_SPEEDY = actionEvent("villain-hits-speedy", [attack(theVillain, "speedy")]);
/** A player card stunning the villain: not a minion's effect. */
const STUN_THE_VILLAIN = actionEvent("stun-the-villain", [
  { kind: "giveStatus", target: theVillain, status: "stunned" },
]);
const EVENTS = [
  BRUTE_HITS_SHOCKER,
  BRUTE_HITS_SPEEDY,
  BRUTE_HITS_WIDOW,
  VILLAIN_HITS_SHOCKER,
  VILLAIN_HITS_SPEEDY,
  STUN_THE_VILLAIN,
];

const deps: EngineDeps = depsOf(
  SHOCKER_RESPONSE,
  SPEEDY_INTERRUPT,
  WIDOW_INTERRUPT,
  VILLAIN_CONSTANT,
  ...EVENTS.map((e) => e.ability),
);

interface Table {
  readonly state: GameState;
  readonly ids: Readonly<Record<string, InstanceId>>;
  readonly recorder: InstanceId;
}

function table(minions: readonly string[], opts: { readonly vigilante?: boolean } = {}): Table {
  const base = gameAtFirstTurn({
    cards: [RECORDER, VIGILANTE, ...MINIONS, ...EVENTS.map((e) => e.card)],
    deps,
    ...(opts.vigilante ? { villain: VIGILANTE } : {}),
    encounter: [...MINIONS.map((m) => m.id), ...copiesOf(BRUTE.id, 10)],
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

const stunned = (state: GameState, id: InstanceId): number => mustInstance(state, id).statuses.stunned;
const counters = (state: GameState, id: InstanceId, type: string): number =>
  mustInstance(state, id).counters[type] ?? 0;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const villainId = (state: GameState): InstanceId => state.villains[0]!.instanceId;

describe("'After this card is attacked' hears an enemy's attack on it (Shocker's shape)", () => {
  it("control: after your hero attacks it, your hero is stunned", () => {
    const t = table(["shocker"]);
    const hero = t.state.players[0]!.identity.instanceId;
    const { state } = runCommands(t.state, deps, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: hero,
      targetInstanceId: t.ids.shocker!,
    });
    expect(stunned(state, hero)).toBe(1);
  });

  it("after a minion attacks it, that minion is stunned", () => {
    const t = table(["brute", "shocker"]);
    const { state } = playFree(t.state, deps, BRUTE_HITS_SHOCKER.card.id);
    expect(mustInstance(state, t.ids.shocker!).damage).toBe(3);
    expect(stunned(state, t.ids.brute!)).toBe(1);
  });

  it("after the villain attacks it, the villain is stunned", () => {
    const t = table(["shocker"]);
    const { state } = playFree(t.state, deps, VILLAIN_HITS_SHOCKER.card.id);
    expect(stunned(state, villainId(state))).toBe(1);
  });
});

describe("'When a character attacks this card, it attacks that character' against an enemy (Speed Demon's shape)", () => {
  it("the attacked minion attacks the attacking minion first, as an enemy attacking an enemy, then is attacked", () => {
    const t = table(["brute", "speedy"]);
    const { state, events } = playFree(t.state, deps, BRUTE_HITS_SPEEDY.card.id);
    expect(ofType(events, "enemyAttackedEnemy").map((e) => [e.attackerInstanceId, e.targetInstanceId])).toEqual([
      [t.ids.speedy, t.ids.brute],
      [t.ids.brute, t.ids.speedy],
    ]);
    expect(mustInstance(state, t.ids.brute!).damage).toBe(2);
    expect(mustInstance(state, t.ids.speedy!).damage).toBe(3);
    // Not an activation: no boost card, nobody asked to defend.
    expect(ofType(events, "boostCardDealt")).toEqual([]);
    expect(ofType(events, "defenseDeclined")).toEqual([]);
  });

  it("a 'minions cannot attack him' rule stops the attack back, not the trigger (RRG 1.8 'Cannot', p. 11)", () => {
    const t = table(["speedy"], { vigilante: true });
    const { state, events } = playFree(t.state, deps, VILLAIN_HITS_SPEEDY.card.id);
    expect(ofType(events, "enemyAttackedEnemy").map((e) => e.skipped ?? "made")).toEqual(["cannotAttack", "made"]);
    expect(mustInstance(state, villainId(state)).damage).toBe(0);
    expect(mustInstance(state, t.ids.speedy!).damage).toBe(2);
  });
});

describe("a pattern naming a player's attacker is not heard by an enemy's attack (Black Widow's shape)", () => {
  it("a minion attacking it does not trigger 'a character you control attacks'", () => {
    const t = table(["brute", "widow"]);
    const { state } = playFree(t.state, deps, BRUTE_HITS_WIDOW.card.id);
    expect(counters(state, t.recorder, "widow")).toBe(0);
    expect(mustInstance(state, t.ids.widow!).damage).toBe(3);
  });

  it("control: your hero attacking it does", () => {
    const t = table(["widow"]);
    const { state } = runCommands(t.state, deps, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: t.state.players[0]!.identity.instanceId,
      targetInstanceId: t.ids.widow!,
    });
    expect(counters(state, t.recorder, "widow")).toBe(1);
  });
});

describe("RuleSpec cannotHaveStatus with `from` ('minions cannot stun him')", () => {
  it("a minion's ability gives the villain no stunned status card, though it triggers", () => {
    const t = table(["shocker"], { vigilante: true });
    const { state, events } = playFree(t.state, deps, VILLAIN_HITS_SHOCKER.card.id);
    expect(mustInstance(state, t.ids.shocker!).damage, "the attack happened").toBe(2);
    expect(stunned(state, villainId(state))).toBe(0);
    expect(ofType(events, "statusGiven")).toEqual([]);
  });

  it("a player card still stuns him", () => {
    const t = table([], { vigilante: true });
    const { state } = playFree(t.state, deps, STUN_THE_VILLAIN.card.id);
    expect(stunned(state, villainId(state))).toBe(1);
  });

  it("the rule binds only its target: the same minion's ability stuns another attacker", () => {
    const t = table(["brute", "shocker"], { vigilante: true });
    const { state } = playFree(t.state, deps, BRUTE_HITS_SHOCKER.card.id);
    expect(stunned(state, t.ids.brute!)).toBe(1);
  });
});
