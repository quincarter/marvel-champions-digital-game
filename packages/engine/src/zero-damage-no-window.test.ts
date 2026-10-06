/**
 * 0 damage opens no damage window (owner ruling 2026-10-06, docs/phase7-wave7.md §4.1; the parallel of "a placement of
 * 0 threat opens no window").
 *
 * RRG 1.8 "Damage" (p. 14) words every step around damage as "any amount of damage": "would deal/be dealt", "would
 * take", "takes" and "after [character] deals/is dealt/takes". "Tough" (p. 44) the same, and both it and "Attack (Enemy
 * Activation)" (p. 9) keep the status card when a basic defense reduces the attack to 0. "Prevent" (p. 35): prevented
 * damage is dealt but not taken, and an attack whose damage was all prevented has not "attacked and damaged". The
 * attack itself still happened (p. 9 step 6; "Retaliate X", p. 38: "after this character is attacked"). "Cost"
 * (p. 14): dealing damage as a cost is paid whatever becomes of the damage.
 *
 * Synthetic cards. Each observer is a forced ability that leaves a counter: the damage observers on the character the
 * damage is aimed at, the attack observers on their own card.
 */

import { flat, type KeywordInstance } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityCost, AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAlly,
  stubEvent,
  stubIdentity,
  stubMainScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import { defaultPick, giveCard, HERO, runWith } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const you = { kind: "controller" } as const;
const yourHero: TargetRef = { kind: "identityOf", player: you };
const theVillain: TargetRef = { kind: "named", name: "villain" };
const FRIENDLY = { categories: ["character"], controller: "you" } as const;
const ANY_CHARACTER = { categories: ["character"] } as const;
const POT: TargetRef = { kind: "each", query: { categories: ["support"], name: "pot" } };
const whenAttacked = { on: "enemyAttack", playerIs: "controller", usesAttackedPlayer: true } as const;

const mark = (target: TargetRef, counterType: string): EffectSpec => ({
  kind: "addCounters",
  target,
  counterType,
  amount: n(1),
});
const forced = (id: string, kind: "interrupt" | "response", on: object, effects: readonly EffectSpec[]) =>
  stubAbility(id, { trigger: { kind, forced: true, on }, effects } as AbilityDefinition);

/** "When a character would take any amount of damage" (p. 14 steps 1 and 3). */
const WOULD = forced("would.forced-interrupt", "interrupt", { on: "dealDamage", targetIs: ANY_CHARACTER }, [
  mark({ kind: "eventTarget" }, "would"),
]);
/** "After a character is dealt any amount of damage": dealt, whether or not it was taken (p. 35). */
const DEALT = forced("dealt.forced-response", "response", { on: "dealDamage", targetIs: ANY_CHARACTER }, [
  mark({ kind: "eventTarget" }, "dealt"),
]);
/** "After a character takes any amount of damage". */
const TOOK = forced(
  "took.forced-response",
  "response",
  { on: "dealDamage", targetIs: ANY_CHARACTER, requireResults: { amount: 1 } },
  [mark({ kind: "eventTarget" }, "took")],
);
/** "After you deal any amount of damage to an enemy": the event's own amount, damage dealt (p. 35). */
const YOU_DEAL = forced(
  "you-deal.forced-response",
  "response",
  {
    on: "dealDamage",
    sourceIs: { controller: "you", categories: ["identity", "event"] },
    targetIs: { categories: ["enemy"] },
    eventAtLeast: { amount: 1 },
  },
  [mark({ kind: "self" }, "youDealt")],
);
/** "After the villain attacks you". */
const ATTACKED = forced("attacked.forced-response", "response", whenAttacked, [mark({ kind: "self" }, "attacked")]);
/** "After the villain attacks and damages you". */
const DAMAGES = forced("damages.forced-response", "response", { ...whenAttacked, requireResults: { damage: 1 } }, [
  mark({ kind: "self" }, "damages"),
]);
/** "After your hero defends". */
const DEFENDED = forced("defended.forced-response", "response", { on: "defended", targetIs: FRIENDLY }, [
  mark({ kind: "self" }, "defended"),
]);
/** "After your hero attacks" (a player attack resolved). */
const YOU_ATTACKED = forced("you-attacked.forced-response", "response", { on: "attack", playerIs: "controller" }, [
  mark({ kind: "self" }, "youAttacked"),
]);
const OBSERVERS = [WOULD, DEALT, TOOK, YOU_DEAL, ATTACKED, DAMAGES, DEFENDED, YOU_ATTACKED];
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: OBSERVERS.map((o) => o.ref) });

/** "When your hero would take damage, prevent all of that damage." */
const EVACUATE = forced(
  "evacuate.forced-interrupt",
  "interrupt",
  { on: "dealDamage", targetIs: { categories: ["hero"], controller: "you" } },
  [{ kind: "preventDamage" }],
);
/** "When an ally you control would take damage, prevent all of that damage." */
const SHELTER = forced(
  "shelter.forced-interrupt",
  "interrupt",
  { on: "dealDamage", targetIs: { categories: ["ally"], controller: "you" } },
  [{ kind: "preventDamage" }],
);
const EVACUATE_CARD = stubSupport({ id: "evacuate", cost: 0, abilities: [EVACUATE.ref] });
const SHELTER_CARD = stubSupport({ id: "shelter", cost: 0, abilities: [SHELTER.ref] });
const POT_CARD = stubSupport({ id: "pot", cost: 0 });
const PAL = stubAlly({ id: "pal", cost: 0, atk: 1, thw: 1, hp: 5, resources: 1 });

/** "Action: the villain attacks you." */
const ATTACK_ABILITY = stubAbility("attack.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "enemyAttack", enemies: theVillain, against: you }],
});
const ATTACKER = stubSupport({ id: "attacker", cost: 0, abilities: [ATTACK_ABILITY.ref] });

const actionEvent = (
  id: string,
  effects: readonly EffectSpec[],
  extra: { cost?: AbilityCost; attack?: boolean } = {},
) => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    ...(extra.attack ? { label: ["attack"] } : {}),
    ...(extra.cost ? { cost: extra.cost } : {}),
    effects,
  } as AbilityDefinition);
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Deal X damage to your hero", X = the mark counters on the pot (0 unless a test adds some). */
const HIT_X = actionEvent("hit-x", [
  { kind: "dealDamage", target: yourHero, amount: { kind: "counters", of: POT, counterType: "mark" } },
]);
/** "(attack): Deal N damage to the villain. If this attack deals damage, …" */
const strike = (amount: number) =>
  actionEvent(
    `strike${amount}`,
    [
      { kind: "attack", target: theVillain, amount: n(amount), bind: "hit" },
      { kind: "if", condition: { kind: "varAtLeast", name: "hit.made", amount: 1 }, then: [mark(POT, "made")] },
      { kind: "if", condition: { kind: "varAtLeast", name: "hit.damage", amount: 1 }, then: [mark(POT, "damaged")] },
    ],
    { attack: true },
  );
const STRIKE0 = strike(0);
const STRIKE2 = strike(2);
/** "Deal X indirect damage to you", X = the mark counters on the pot. */
const INDIRECT_X = actionEvent("indirect-x", [
  { kind: "dealIndirectDamage", to: you, amount: { kind: "counters", of: POT, counterType: "mark" } },
]);
/** "Deal damage to each character you control equal to the mark counters on it." */
const PER_MARK = actionEvent("per-mark", [
  {
    kind: "dealDamage",
    target: { kind: "each", query: FRIENDLY },
    amount: { kind: "counters", of: { kind: "slot", slot: "affected" }, counterType: "mark" },
    perTarget: true,
  },
]);
/** "Deal 2 damage to each character you control." */
const BLAST = actionEvent("blast", [{ kind: "dealDamage", target: { kind: "each", query: FRIENDLY }, amount: n(2) }]);
/** "Deal 0 damage to your hero → (mark paid)." */
const PAY0 = actionEvent("pay0", [mark(POT, "paid")], { cost: { dealDamage: { target: yourHero, amount: 0 } } });
/** "Until the end of the turn, each time a character is dealt damage, …" then "deal X damage to your hero". */
const EACH_TIME = actionEvent("each-time", [
  {
    kind: "eachTimeUntil",
    until: "endOfTurn",
    on: { on: "dealDamage", targetIs: ANY_CHARACTER },
    effects: [mark(POT, "eachTime")],
  },
  { kind: "dealDamage", target: yourHero, amount: { kind: "counters", of: POT, counterType: "mark" } },
]);
const EVENTS = [HIT_X, STRIKE0, STRIKE2, INDIRECT_X, PER_MARK, BLAST, PAY0, EACH_TIME];
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const deps: EngineDeps = depsOf(
  ...OBSERVERS,
  EVACUATE,
  SHELTER,
  ATTACK_ABILITY,
  ...EVENTS.map((event) => event.ability),
);

interface Options {
  readonly atk?: number;
  readonly def?: number;
  /** Tough status cards on the hero. */
  readonly tough?: number;
  readonly villainTough?: number;
  readonly villainKeywords?: readonly KeywordInstance[];
  readonly also?: readonly (typeof EVACUATE_CARD)[];
  readonly ally?: boolean;
}

function setup(options: Options = {}) {
  const villain = stubVillain({
    id: "villain",
    stages: [{ hp: flat(30), atk: options.atk ?? 3, sch: 1, keywords: options.villainKeywords ?? [] }],
  });
  const scheme = stubMainScheme({
    id: "main",
    stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
  });
  const hero = stubIdentity({
    id: HERO.id,
    hp: 12,
    atk: 2,
    thw: 2,
    def: options.def ?? 2,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
  });
  const supports = [WATCH, POT_CARD, ATTACKER, ...(options.also ?? [])];
  let state = gameAtFirstTurn({
    cards: [hero, WATCH, POT_CARD, ATTACKER, EVACUATE_CARD, SHELTER_CARD, PAL, BLANK, ...EVENTS.map((e) => e.card)],
    deps,
    villain,
    mainScheme: scheme,
    deck: [...supports.map((card) => card.id), PAL.id, ...EVENTS.map((e) => e.card.id)],
    encounter: copiesOf(BLANK.id, 30),
  });
  const placed: Record<string, InstanceId> = {};
  for (const card of [...supports, ...(options.ally ? [PAL] : [])]) {
    const put = playerCardIntoPlay(state, card.id);
    state = put.state;
    placed[card.id] = put.id;
  }
  if (mustPlayer(state, P1).identity.form !== "hero")
    state = runWith(deps, state, { type: "changeForm", playerId: P1 });
  const heroId = mustPlayer(state, P1).identity.instanceId;
  const villainId = activeVillain(state).instanceId;
  state = withTough(withTough(state, heroId, options.tough ?? 0), villainId, options.villainTough ?? 0);
  return {
    state,
    hero: heroId,
    villain: villainId,
    watch: placed[WATCH.id]!,
    pot: placed[POT_CARD.id]!,
    attacker: placed[ATTACKER.id]!,
    ally: placed[PAL.id],
  };
}
type Setup = ReturnType<typeof setup>;

const patch = (state: GameState, id: InstanceId, change: Partial<GameState["instances"][string]>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), ...change } },
});
const withTough = (state: GameState, id: InstanceId, tough: number): GameState =>
  patch(state, id, { statuses: { ...mustInstance(state, id).statuses, tough } });
const withMarks = (state: GameState, id: InstanceId, marks: number): GameState =>
  patch(state, id, { counters: { ...mustInstance(state, id).counters, mark: marks } });

const defending =
  (hero: InstanceId) =>
  (state: GameState): readonly string[] =>
    state.pendingChoice?.prompt.kind === "declareDefender" ? [hero] : defaultPick(state);

/** The villain attacks p1 (undefended unless `pick` declares a defender). */
function villainAttacks(s: Setup, pick = defaultPick) {
  const command: Command = {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: s.attacker,
    abilityId: ATTACK_ABILITY.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
    payment: [],
  };
  const { session, events } = driveSession(startSession(s.state), deps, [command], pick);
  return { session, state: session.state, events };
}
function play(state: GameState, event: (typeof EVENTS)[number], pick = defaultPick) {
  const given = giveCard(state, P1, event.card.id);
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  const { session, events } = driveSession(startSession(given.state), deps, [command], pick);
  return { session, state: session.state, events };
}

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
/** The timing windows opened for a damage event. */
const damageWindows = (events: readonly GameEvent[], timing?: "interrupt" | "response") =>
  of(events, "windowOpened").filter(
    (e) => e.event.kind === "dealDamage" && (timing === undefined || e.timing === timing),
  );
const counter = (state: GameState, id: InstanceId, name: string) => mustInstance(state, id).counters[name] ?? 0;
/** The damage observers' counters on one character. */
const seen = (state: GameState, id: InstanceId) => ({
  would: counter(state, id, "would"),
  dealt: counter(state, id, "dealt"),
  took: counter(state, id, "took"),
});
const NOTHING = { would: 0, dealt: 0, took: 0 };
const expectReplays = (session: { log: Parameters<typeof replay>[0]; state: GameState }) => {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
};

describe("1. damage whose amount is 0 as it would be dealt (RRG 1.8 'Damage', p. 14: 'any amount of damage')", () => {
  it("a 0 ATK attack with no boost: no window, nothing dealt or taken, the tough status card stays", () => {
    const s = setup({ atk: 0, tough: 1 });
    const { state, events, session } = villainAttacks(s);
    expect(damageWindows(events)).toEqual([]);
    expect(of(events, "interruptsPreempted")).toEqual([]);
    expect(of(events, "damageDealt")).toEqual([]);
    expect(of(events, "damagePrevented")).toEqual([]);
    expect(of(events, "statusRemoved")).toEqual([]);
    expect(seen(state, s.hero)).toEqual(NOTHING);
    expect(mustInstance(state, s.hero)).toMatchObject({ damage: 0, statuses: { tough: 1 } });
    // The attack happened: "after the villain attacks you" answers it; "attacks and damages" does not.
    expect(counter(state, s.watch, "attacked")).toBe(1);
    expect(counter(state, s.watch, "damages")).toBe(0);
    expectReplays(session);
  });

  it("the same attack at 1 ATK is the contrast: each window opens and each observer answers once", () => {
    const s = setup({ atk: 1 });
    const { state, events } = villainAttacks(s);
    expect(damageWindows(events, "interrupt")).toHaveLength(1);
    expect(damageWindows(events, "response")).toHaveLength(1);
    expect(seen(state, s.hero)).toEqual({ would: 1, dealt: 1, took: 1 });
    expect(mustInstance(state, s.hero).damage).toBe(1);
    expect(counter(state, s.watch, "attacked")).toBe(1);
    expect(counter(state, s.watch, "damages")).toBe(1);
  });

  it("an effect that computes X = 0: no window, and the tough status card stays", () => {
    const s = setup({ tough: 1 });
    const { state, events, session } = play(s.state, HIT_X);
    expect(damageWindows(events)).toEqual([]);
    expect(of(events, "interruptsPreempted")).toEqual([]);
    expect(of(events, "damageDealt")).toEqual([]);
    expect(of(events, "damagePrevented")).toEqual([]);
    expect(seen(state, s.hero)).toEqual(NOTHING);
    expect(mustInstance(state, s.hero)).toMatchObject({ damage: 0, statuses: { tough: 1 } });
    expectReplays(session);
  });

  it("the same effect at X = 2: windows open and the damage is taken", () => {
    const s = setup();
    const { state } = play(withMarks(s.state, s.pot, 2), HIT_X);
    expect(seen(state, s.hero)).toEqual({ would: 1, dealt: 1, took: 1 });
    expect(mustInstance(state, s.hero).damage).toBe(2);
  });

  it("a lasting 'each time a character is dealt damage' effect is not set off by 0 damage, and is by 2", () => {
    const s = setup();
    const none = play(s.state, EACH_TIME);
    expect(counter(none.state, s.pot, "eachTime")).toBe(0);
    const some = play(withMarks(s.state, s.pot, 2), EACH_TIME);
    expect(counter(some.state, s.pot, "eachTime")).toBe(1);
    expectReplays(none.session);
  });
});

describe("2. damage brought to 0 before it is taken", () => {
  it("a basic defense whose DEF covers the attack: 0 is dealt, so no window and the tough card stays (p. 9, p. 44)", () => {
    const s = setup({ atk: 3, def: 5, tough: 1 });
    const { state, events, session } = villainAttacks(s, defending(s.hero));
    expect(damageWindows(events)).toEqual([]);
    expect(of(events, "interruptsPreempted")).toEqual([]);
    expect(of(events, "damageDealt")).toEqual([]);
    expect(seen(state, s.hero)).toEqual(NOTHING);
    expect(mustInstance(state, s.hero)).toMatchObject({ damage: 0, exhausted: true, statuses: { tough: 1 } });
    expect(counter(state, s.watch, "defended")).toBe(1);
    expect(counter(state, s.watch, "attacked")).toBe(1);
    expect(counter(state, s.watch, "damages")).toBe(0);
    expectReplays(session);
  });

  it("a defense that leaves 1: that 1 has its windows and is taken", () => {
    const s = setup({ atk: 3, def: 2 });
    const { state } = villainAttacks(s, defending(s.hero));
    expect(seen(state, s.hero)).toEqual({ would: 1, dealt: 1, took: 1 });
    expect(mustInstance(state, s.hero).damage).toBe(1);
    expect(counter(state, s.watch, "defended")).toBe(1);
    expect(counter(state, s.watch, "damages")).toBe(1);
  });

  it("an interrupt prevents all of it: the 'would' window opened, then nothing answers the damage afterwards", () => {
    const s = setup({ atk: 3, also: [EVACUATE_CARD] });
    const { state, events, session } = villainAttacks(s);
    expect(damageWindows(events, "interrupt")).toHaveLength(1);
    expect(damageWindows(events, "response")).toEqual([]);
    expect(of(events, "damagePrevented")).toMatchObject([{ targetInstanceId: s.hero, amount: 3, reason: "effect" }]);
    expect(of(events, "damageDealt")).toEqual([]);
    expect(seen(state, s.hero)).toEqual({ would: 1, dealt: 0, took: 0 });
    expect(mustInstance(state, s.hero).damage).toBe(0);
    // The attack resolved; it did not "attack and damage" (RRG 1.8 "Prevent", p. 35).
    expect(counter(state, s.watch, "attacked")).toBe(1);
    expect(counter(state, s.watch, "damages")).toBe(0);
    expectReplays(session);
  });

  it("a tough status card prevents it: the card is spent, the damage was dealt and not taken (p. 35, p. 44)", () => {
    const s = setup({ atk: 3, tough: 1 });
    const { state, events, session } = villainAttacks(s);
    // The status card resolves ahead of every "would take damage" interrupt (FAQ p. 58).
    expect(of(events, "interruptsPreempted")).toHaveLength(1);
    expect(damageWindows(events, "interrupt")).toEqual([]);
    expect(of(events, "damagePrevented")).toMatchObject([{ targetInstanceId: s.hero, amount: 3, reason: "tough" }]);
    expect(of(events, "damageDealt")).toEqual([]);
    expect(seen(state, s.hero)).toEqual({ would: 0, dealt: 1, took: 0 });
    expect(mustInstance(state, s.hero)).toMatchObject({ damage: 0, statuses: { tough: 0 } });
    expect(counter(state, s.watch, "attacked")).toBe(1);
    expect(counter(state, s.watch, "damages")).toBe(0);
    expectReplays(session);
  });
});

describe("3. the attack still happens at 0 damage", () => {
  const RETALIATE: readonly KeywordInstance[] = [{ name: "retaliate", value: 1 }];

  it("a player attack for 0: it was made, the villain keeps its tough card, and retaliate answers the attack (p. 38)", () => {
    const s = setup({ villainKeywords: RETALIATE, villainTough: 1 });
    const { state, events, session } = play(s.state, STRIKE0);
    expect(seen(state, s.villain)).toEqual(NOTHING);
    expect(mustInstance(state, s.villain)).toMatchObject({ damage: 0, statuses: { tough: 1 } });
    expect(counter(state, s.watch, "youAttacked")).toBe(1);
    expect(counter(state, s.watch, "youDealt")).toBe(0);
    // "If this attack deals damage" reads false; the attack was still made.
    expect(counter(state, s.pot, "made")).toBe(1);
    expect(counter(state, s.pot, "damaged")).toBe(0);
    // Retaliate 1: the only damage event that opened windows, and it is the hero's.
    expect(damageWindows(events).map((e) => e.event.kind === "dealDamage" && e.event.targetInstanceId)).toEqual([
      s.hero,
      s.hero,
    ]);
    expect(seen(state, s.hero)).toEqual({ would: 1, dealt: 1, took: 1 });
    expect(mustInstance(state, s.hero).damage).toBe(1);
    expectReplays(session);
  });

  it("the same attack for 2: 'if this attack deals damage' reads true and 'you deal damage' answers", () => {
    const s = setup({ villainKeywords: RETALIATE });
    const { state } = play(s.state, STRIKE2);
    expect(seen(state, s.villain)).toEqual({ would: 1, dealt: 1, took: 1 });
    expect(mustInstance(state, s.villain).damage).toBe(2);
    expect(counter(state, s.watch, "youDealt")).toBe(1);
    expect(counter(state, s.pot, "made")).toBe(1);
    expect(counter(state, s.pot, "damaged")).toBe(1);
    expect(mustInstance(state, s.hero).damage).toBe(1);
  });

  it("a 0 ATK overkill attack against a defending ally spills nothing", () => {
    const s = setup({ atk: 0, villainKeywords: [{ name: "overkill" }], ally: true });
    const { state, events } = villainAttacks(s, defending(s.ally!));
    expect(damageWindows(events)).toEqual([]);
    expect(of(events, "damageDealt")).toEqual([]);
    expect(seen(state, s.ally!)).toEqual(NOTHING);
    expect(seen(state, s.hero)).toEqual(NOTHING);
    expect(counter(state, s.watch, "defended")).toBe(1);
    expect(counter(state, s.watch, "attacked")).toBe(1);
  });

  it("0 indirect damage: nothing to assign, no window", () => {
    const s = setup({ tough: 1, ally: true });
    const { state, events, session } = play(s.state, INDIRECT_X);
    expect(of(events, "choiceRequested").filter((e) => e.choice.prompt.kind === "assignIndirectDamage")).toEqual([]);
    expect(damageWindows(events)).toEqual([]);
    expect(seen(state, s.hero)).toEqual(NOTHING);
    expect(seen(state, s.ally!)).toEqual(NOTHING);
    expect(mustInstance(state, s.hero).statuses.tough).toBe(1);
    expectReplays(session);
  });

  it("indirect damage of 2, all assigned to the hero: the ally assigned none has no window", () => {
    const s = setup({ ally: true });
    const picks = (state: GameState): readonly string[] =>
      state.pendingChoice?.prompt.kind === "assignIndirectDamage" ? [`${s.hero}#1`, `${s.hero}#2`] : defaultPick(state);
    const { state } = play(withMarks(s.state, s.pot, 2), INDIRECT_X, picks);
    expect(seen(state, s.hero)).toEqual({ would: 1, dealt: 1, took: 1 });
    expect(mustInstance(state, s.hero).damage).toBe(2);
    expect(seen(state, s.ally!)).toEqual(NOTHING);
  });

  it("a per-target amount: the character owed 0 has no window and keeps its tough card; the other takes its 2", () => {
    const s = setup({ tough: 1, ally: true });
    const { state, events, session } = play(withMarks(s.state, s.ally!, 2), PER_MARK);
    expect(seen(state, s.hero)).toEqual(NOTHING);
    expect(mustInstance(state, s.hero)).toMatchObject({ damage: 0, statuses: { tough: 1 } });
    expect(seen(state, s.ally!)).toEqual({ would: 1, dealt: 1, took: 1 });
    expect(mustInstance(state, s.ally!).damage).toBe(2);
    expect(of(events, "damageDealt")).toMatchObject([{ targetInstanceId: s.ally, amount: 2 }]);
    expectReplays(session);
  });

  it("simultaneous damage where an interrupt prevents one character's share: only the other is answered", () => {
    const s = setup({ ally: true, also: [SHELTER_CARD] });
    const { state, events, session } = play(s.state, BLAST);
    expect(seen(state, s.ally!)).toEqual({ would: 1, dealt: 0, took: 0 });
    expect(mustInstance(state, s.ally!).damage).toBe(0);
    expect(seen(state, s.hero)).toEqual({ would: 1, dealt: 1, took: 1 });
    expect(mustInstance(state, s.hero).damage).toBe(2);
    expect(of(events, "damageDealt")).toMatchObject([{ targetInstanceId: s.hero, amount: 2 }]);
    expectReplays(session);
  });

  it("'deal 0 damage →' as a cost is paid (RRG 1.8 'Cost', p. 14): the effect resolves, with no damage window", () => {
    const s = setup({ tough: 1 });
    const { state, events, session } = play(s.state, PAY0);
    expect(counter(state, s.pot, "paid")).toBe(1);
    expect(damageWindows(events)).toEqual([]);
    expect(seen(state, s.hero)).toEqual(NOTHING);
    expect(mustInstance(state, s.hero).statuses.tough).toBe(1);
    expectReplays(session);
  });
});
