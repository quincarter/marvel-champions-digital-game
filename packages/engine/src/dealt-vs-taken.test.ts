/**
 * Damage dealt and damage taken are two amounts on one damage event (owner ruling 2026-10-07, docs/phase7-wave7.md
 * §4.1): "after X deals / is dealt damage" answers damage that reached the damage-dealing process, whatever then kept
 * the target from taking it; "after X takes damage" and "attacks and damages" need damage placed on the target.
 *
 * RRG 1.8 "Prevent" (p. 35): "the amount of damage that character 'takes' is reduced, but the amount of damage 'dealt'
 * is not reduced"; "If an effect prevents all damage dealt to a character, that character is not considered to have
 * taken damage"; "If all damage from an attack is prevented, the attacking character is considered to have dealt
 * damage, but is not considered to have 'attacked and damaged' the attacked character." "Tough" (p. 44) prevents the
 * same way. Damage that is 0 as it would be dealt is neither (owner ruling 2026-10-06; `zero-damage-no-window.test.ts`).
 *
 * Synthetic cards. Each observer is a forced ability that leaves a counter on the character the damage is aimed at.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
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
const YOUR_HERO = { categories: ["hero"], controller: "you" } as const;
const YOUR_ALLIES = { categories: ["ally"], controller: "you" } as const;
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
const observer = (name: string, on: object) =>
  forced(`${name}.forced-response`, "response", { on: "dealDamage", targetIs: ANY_CHARACTER, ...on }, [
    mark({ kind: "eventTarget" }, name),
  ]);

/** "When a character would take any amount of damage." */
const WOULD = forced("would.forced-interrupt", "interrupt", { on: "dealDamage", targetIs: ANY_CHARACTER }, [
  mark({ kind: "eventTarget" }, "would"),
]);
/** "After a character is dealt any amount of damage." */
const DEALT = observer("dealt", { eventAtLeast: { dealt: 1 } });
/** "After a character is dealt 3 or more damage." */
const DEALT3 = observer("dealt3", { eventAtLeast: { dealt: 3 } });
/** "After a character takes any amount of damage." */
const TOOK = observer("took", { requireResults: { amount: 1 } });
/** "After a character takes 3 or more damage." */
const TOOK3 = observer("took3", { requireResults: { amount: 3 } });
/** The same "takes" reading off the event's own `taken`. */
const TAKEN = observer("taken", { eventAtLeast: { taken: 1 } });
/** "After the villain attacks you" and "after the villain attacks and damages you". */
const ATTACKED = forced("attacked.forced-response", "response", whenAttacked, [mark({ kind: "self" }, "attacked")]);
const DAMAGES = forced("damages.forced-response", "response", { ...whenAttacked, requireResults: { damage: 1 } }, [
  mark({ kind: "self" }, "damages"),
]);
const OBSERVERS = [WOULD, DEALT, DEALT3, TOOK, TOOK3, TAKEN, ATTACKED, DAMAGES];
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: OBSERVERS.map((o) => o.ref) });

const interruptOn = (id: string, target: object, effects: readonly EffectSpec[]) =>
  forced(`${id}.forced-interrupt`, "interrupt", { on: "dealDamage", targetIs: target }, effects);
const constantRule = (id: string, rule: RuleSpec) =>
  stubAbility(`${id}.constant`, { trigger: { kind: "constant", rules: [rule] }, effects: [] });
const supportWith = (id: string, ability: StubAbility) => ({
  ability,
  card: stubSupport({ id, cost: 0, abilities: [ability.ref] }),
});

/** "When your hero would take damage, prevent all of that damage." */
const EVACUATE = supportWith("evacuate", interruptOn("evacuate", YOUR_HERO, [{ kind: "preventDamage" }]));
/** "When your hero would take damage, prevent 2 of that damage." */
const PATCH = supportWith("patch", interruptOn("patch", YOUR_HERO, [{ kind: "preventDamage", amount: n(2) }]));
/** "When your hero would be dealt damage, increase that damage by 2." */
const AMP = supportWith("amp", interruptOn("amp", YOUR_HERO, [{ kind: "increaseDamage", amount: n(2) }]));
/** "When an ally you control would take damage, prevent all of that damage." */
const SHELTER = supportWith("shelter", interruptOn("shelter", YOUR_ALLIES, [{ kind: "preventDamage" }]));
/** "Reduce the amount of damage your hero takes by 5." */
const ARMOR = supportWith("armor", constantRule("armor", { kind: "reduceDamageTaken", target: YOUR_HERO, amount: 5 }));
/** "Your hero cannot take damage." */
const WARD = supportWith("ward", constantRule("ward", { kind: "cannotTakeDamage", target: YOUR_HERO }));
const OPTIONAL = [EVACUATE, PATCH, AMP, SHELTER, ARMOR, WARD];

const POT_CARD = stubSupport({ id: "pot", cost: 0 });
const PAL = stubAlly({ id: "pal", cost: 0, atk: 1, thw: 1, hp: 5, resources: 1 });

/** "Action: the villain attacks you." */
const ATTACK_ABILITY = stubAbility("attack.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "enemyAttack", enemies: theVillain, against: you }],
});
const ATTACKER = stubSupport({ id: "attacker", cost: 0, abilities: [ATTACK_ABILITY.ref] });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects } as AbilityDefinition);
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Deal X damage to your hero", X = the mark counters on the pot. */
const HIT_X = actionEvent("hit-x", [
  { kind: "dealDamage", target: yourHero, amount: { kind: "counters", of: POT, counterType: "mark" } },
]);
/** "Deal 2 damage to each character you control." */
const BLAST = actionEvent("blast", [{ kind: "dealDamage", target: { kind: "each", query: FRIENDLY }, amount: n(2) }]);
/** "Until the end of the turn, each time a character is dealt damage, …" then "deal X damage to your hero". */
const EACH_TIME = actionEvent("each-time", [
  {
    kind: "eachTimeUntil",
    until: "endOfTurn",
    on: { on: "dealDamage", targetIs: ANY_CHARACTER, eventAtLeast: { dealt: 1 } },
    effects: [mark(POT, "eachDealt")],
  },
  {
    kind: "eachTimeUntil",
    until: "endOfTurn",
    on: { on: "dealDamage", targetIs: ANY_CHARACTER, requireResults: { amount: 1 } },
    effects: [mark(POT, "eachTaken")],
  },
  { kind: "dealDamage", target: yourHero, amount: { kind: "counters", of: POT, counterType: "mark" } },
]);
const EVENTS = [HIT_X, BLAST, EACH_TIME];
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const deps: EngineDeps = depsOf(
  ...OBSERVERS,
  ...OPTIONAL.map((o) => o.ability),
  ATTACK_ABILITY,
  ...EVENTS.map((event) => event.ability),
);

interface Options {
  readonly atk?: number;
  /** Tough status cards on the hero. */
  readonly tough?: number;
  readonly also?: readonly (typeof EVACUATE)[];
  readonly ally?: boolean;
  /** The X of `HIT_X` and `EACH_TIME`. */
  readonly x?: number;
}

function setup(options: Options = {}) {
  const villain = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: options.atk ?? 3, sch: 1 }] });
  const scheme = stubMainScheme({
    id: "main",
    stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(0) }],
  });
  const hero = stubIdentity({
    id: HERO.id,
    hp: 12,
    atk: 2,
    thw: 2,
    def: 2,
    rec: 3,
    heroHandSize: 5,
    alterEgoHandSize: 6,
  });
  const supports = [WATCH, POT_CARD, ATTACKER, ...(options.also ?? []).map((o) => o.card)];
  let state = gameAtFirstTurn({
    cards: [hero, WATCH, POT_CARD, ATTACKER, PAL, BLANK, ...OPTIONAL.map((o) => o.card), ...EVENTS.map((e) => e.card)],
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
  state = patch(state, heroId, { statuses: { ...mustInstance(state, heroId).statuses, tough: options.tough ?? 0 } });
  const pot = placed[POT_CARD.id]!;
  state = patch(state, pot, { counters: { ...mustInstance(state, pot).counters, mark: options.x ?? 0 } });
  return {
    state,
    hero: heroId,
    villain: activeVillain(state).instanceId,
    watch: placed[WATCH.id]!,
    pot,
    attacker: placed[ATTACKER.id]!,
    ally: placed[PAL.id],
  };
}
type Setup = ReturnType<typeof setup>;

const patch = (state: GameState, id: InstanceId, change: Partial<GameState["instances"][string]>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), ...change } },
});

/** The villain attacks p1, undefended. */
function villainAttacks(s: Setup) {
  const command: Command = {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: s.attacker,
    abilityId: ATTACK_ABILITY.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
    payment: [],
  };
  const { session, events } = driveSession(startSession(s.state), deps, [command], defaultPick);
  return { session, state: session.state, events };
}
function play(s: Setup, event: (typeof EVENTS)[number]) {
  const given = giveCard(s.state, P1, event.card.id);
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  const { session, events } = driveSession(startSession(given.state), deps, [command], defaultPick);
  return { session, state: session.state, events };
}

const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const damageWindows = (events: readonly GameEvent[], timing: "interrupt" | "response") =>
  of(events, "windowOpened").filter((e) => e.event.kind === "dealDamage" && e.timing === timing);
/** Each resolved damage event's target and three amounts, in the order they resolved. */
const resolved = (events: readonly GameEvent[]) =>
  of(events, "triggerEvent").flatMap((e) =>
    e.phase === "resolved" && e.event.kind === "dealDamage"
      ? [
          {
            target: e.event.targetInstanceId,
            amount: e.event.amount,
            dealt: e.event.dealt,
            taken: e.event.taken,
            result: e.event.results?.amount ?? 0,
          },
        ]
      : [],
  );
const counter = (state: GameState, id: InstanceId, name: string) => mustInstance(state, id).counters[name] ?? 0;
const seen = (state: GameState, id: InstanceId) => ({
  would: counter(state, id, "would"),
  dealt: counter(state, id, "dealt"),
  dealt3: counter(state, id, "dealt3"),
  took: counter(state, id, "took"),
  took3: counter(state, id, "took3"),
  taken: counter(state, id, "taken"),
});
const NOTHING = { would: 0, dealt: 0, dealt3: 0, took: 0, took3: 0, taken: 0 };
const DEALT_NOT_TAKEN = { dealt: 1, dealt3: 1, took: 0, took3: 0, taken: 0 };
const expectReplays = (session: { log: Parameters<typeof replay>[0]; state: GameState }) => {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
};

describe("damage dealt and not taken: 'is dealt damage' answers, 'takes damage' does not (RRG 1.8 p. 35)", () => {
  it("control, nothing in the way: 3 dealt and 3 taken, every observer answers once", () => {
    const s = setup({ x: 3 });
    const { state, events, session } = play(s, HIT_X);
    expect(seen(state, s.hero)).toEqual({ would: 1, dealt: 1, dealt3: 1, took: 1, took3: 1, taken: 1 });
    expect(resolved(events)).toEqual([{ target: s.hero, amount: 3, dealt: 3, taken: 3, result: 3 }]);
    expect(mustInstance(state, s.hero).damage).toBe(3);
    expectReplays(session);
  });

  it("a tough status card: spent, 3 dealt and 0 taken (p. 44)", () => {
    const s = setup({ x: 3, tough: 1 });
    const { state, events, session } = play(s, HIT_X);
    // The status card resolves ahead of every "would take damage" interrupt (FAQ p. 58).
    expect(of(events, "interruptsPreempted")).toHaveLength(1);
    expect(seen(state, s.hero)).toEqual({ would: 0, ...DEALT_NOT_TAKEN });
    expect(resolved(events)).toEqual([{ target: s.hero, amount: 3, dealt: 3, taken: 0, result: 0 }]);
    expect(mustInstance(state, s.hero)).toMatchObject({ damage: 0, statuses: { tough: 0 } });
    expectReplays(session);
  });

  it("an interrupt prevents all of it: nothing is left to take, and 3 was still dealt", () => {
    const s = setup({ x: 3, also: [EVACUATE] });
    const { state, events, session } = play(s, HIT_X);
    expect(damageWindows(events, "interrupt")).toHaveLength(1);
    expect(damageWindows(events, "response")).toHaveLength(1);
    expect(of(events, "damagePrevented")).toMatchObject([{ targetInstanceId: s.hero, amount: 3, reason: "effect" }]);
    expect(of(events, "damageDealt")).toEqual([]);
    expect(seen(state, s.hero)).toEqual({ would: 1, ...DEALT_NOT_TAKEN });
    expect(resolved(events)).toEqual([{ target: s.hero, amount: 0, dealt: 3, taken: 0, result: 0 }]);
    expect(mustInstance(state, s.hero).damage).toBe(0);
    expectReplays(session);
  });

  it("a tough status card and a prevention interrupt together: the status card resolves first and is the one spent", () => {
    // Status cards have timing priority over triggered abilities (FAQ p. 58), so the interrupt never gets a window.
    const s = setup({ x: 3, tough: 1, also: [EVACUATE] });
    const { state, events } = play(s, HIT_X);
    expect(of(events, "damagePrevented")).toMatchObject([{ reason: "tough" }]);
    expect(seen(state, s.hero)).toEqual({ would: 0, ...DEALT_NOT_TAKEN });
    expect(mustInstance(state, s.hero).statuses.tough).toBe(0);
  });

  it("a constant reduction that takes it to 0: the tough card stays (FAQ p. 58), 3 dealt and 0 taken", () => {
    const s = setup({ x: 3, tough: 1, also: [ARMOR] });
    const { state, events, session } = play(s, HIT_X);
    expect(of(events, "damagePrevented")).toMatchObject([{ targetInstanceId: s.hero, amount: 3, reason: "reduced" }]);
    expect(seen(state, s.hero)).toEqual({ would: 1, ...DEALT_NOT_TAKEN });
    expect(resolved(events)).toEqual([{ target: s.hero, amount: 3, dealt: 3, taken: 0, result: 0 }]);
    expect(mustInstance(state, s.hero)).toMatchObject({ damage: 0, statuses: { tough: 1 } });
    expectReplays(session);
  });

  it("'cannot take damage': the tough card stays, 3 dealt and 0 taken", () => {
    // An attack: an effect that deals damage does not accept a character that cannot take it as its target.
    const s = setup({ atk: 3, tough: 1, also: [WARD] });
    const { state, events, session } = villainAttacks(s);
    expect(of(events, "damagePrevented")).toMatchObject([
      { targetInstanceId: s.hero, amount: 3, reason: "cannotTakeDamage" },
    ]);
    expect(seen(state, s.hero)).toEqual({ would: 1, ...DEALT_NOT_TAKEN });
    expect(resolved(events)).toEqual([{ target: s.hero, amount: 3, dealt: 3, taken: 0, result: 0 }]);
    expect(mustInstance(state, s.hero)).toMatchObject({ damage: 0, statuses: { tough: 1 } });
    expectReplays(session);
  });

  it("0 as it would be dealt: no window, nothing dealt or taken, the tough card stays, whatever else is in play", () => {
    for (const also of [[], [EVACUATE], [ARMOR], [WARD]]) {
      const s = setup({ x: 0, atk: 0, tough: 1, also });
      const { state, events, session } = also.includes(WARD) ? villainAttacks(s) : play(s, HIT_X);
      expect(of(events, "windowOpened").filter((e) => e.event.kind === "dealDamage")).toEqual([]);
      expect(of(events, "interruptsPreempted")).toEqual([]);
      expect(of(events, "damagePrevented")).toEqual([]);
      expect(seen(state, s.hero)).toEqual(NOTHING);
      expect(mustInstance(state, s.hero)).toMatchObject({ damage: 0, statuses: { tough: 1 } });
      expectReplays(session);
    }
  });
});

describe("the two amounts when only part of the damage is taken", () => {
  it("3 dealt, 2 prevented: 'dealt 3 or more' answers, 'took 3 or more' does not, 1 is taken", () => {
    const s = setup({ x: 3, also: [PATCH] });
    const { state, events, session } = play(s, HIT_X);
    expect(seen(state, s.hero)).toEqual({ would: 1, dealt: 1, dealt3: 1, took: 1, took3: 0, taken: 1 });
    expect(resolved(events)).toEqual([{ target: s.hero, amount: 1, dealt: 3, taken: 1, result: 1 }]);
    expect(mustInstance(state, s.hero).damage).toBe(1);
    expectReplays(session);
  });

  it("2 dealt, both prevented: dealt 2 is not 'dealt 3 or more'", () => {
    const s = setup({ x: 2, also: [PATCH] });
    const { state, events } = play(s, HIT_X);
    expect(seen(state, s.hero)).toEqual({ would: 1, dealt: 1, dealt3: 0, took: 0, took3: 0, taken: 0 });
    expect(resolved(events)).toEqual([{ target: s.hero, amount: 0, dealt: 2, taken: 0, result: 0 }]);
  });

  it("an increase and a prevention on one instance: 3 + 2 dealt, 2 prevented, 3 taken, in either order", () => {
    const s = setup({ x: 3, also: [PATCH, AMP] });
    const { state, events, session } = play(s, HIT_X);
    expect(resolved(events)).toEqual([{ target: s.hero, amount: 3, dealt: 5, taken: 3, result: 3 }]);
    expect(seen(state, s.hero)).toEqual({ would: 1, dealt: 1, dealt3: 1, took: 1, took3: 1, taken: 1 });
    expect(mustInstance(state, s.hero).damage).toBe(3);
    expectReplays(session);
  });

  it("a constant reduction that leaves some: 6 dealt, 1 taken", () => {
    const s = setup({ x: 6, also: [ARMOR] });
    const { state, events } = play(s, HIT_X);
    expect(resolved(events)).toEqual([{ target: s.hero, amount: 6, dealt: 6, taken: 1, result: 1 }]);
    expect(seen(state, s.hero)).toEqual({ would: 1, dealt: 1, dealt3: 1, took: 1, took3: 0, taken: 1 });
  });
});

describe("the same split everywhere damage is answered", () => {
  it("an attack whose damage is all prevented: the attacker dealt damage and did not 'attack and damage' (p. 35)", () => {
    const s = setup({ atk: 3, also: [EVACUATE] });
    const { state, events, session } = villainAttacks(s);
    expect(seen(state, s.hero)).toEqual({ would: 1, ...DEALT_NOT_TAKEN });
    expect(counter(state, s.watch, "attacked")).toBe(1);
    expect(counter(state, s.watch, "damages")).toBe(0);
    // The attack's own log line is the damage it dealt, not what was taken.
    expect(of(events, "attackResolved")).toMatchObject([{ damageDealt: 3 }]);
    expect(mustInstance(state, s.hero).damage).toBe(0);
    expectReplays(session);
  });

  it("an attack against a tough hero: the same", () => {
    const s = setup({ atk: 3, tough: 1 });
    const { state } = villainAttacks(s);
    expect(seen(state, s.hero)).toEqual({ would: 0, ...DEALT_NOT_TAKEN });
    expect(counter(state, s.watch, "attacked")).toBe(1);
    expect(counter(state, s.watch, "damages")).toBe(0);
  });

  it("simultaneous damage with one share prevented: that character was dealt 2 and took 0, the other took 2", () => {
    const s = setup({ ally: true, also: [SHELTER] });
    const { state, events, session } = play(s, BLAST);
    expect(seen(state, s.ally!)).toEqual({ would: 1, dealt: 1, dealt3: 0, took: 0, took3: 0, taken: 0 });
    expect(seen(state, s.hero)).toEqual({ would: 1, dealt: 1, dealt3: 0, took: 1, took3: 0, taken: 1 });
    expect(resolved(events)).toEqual(
      expect.arrayContaining([
        { target: s.ally, amount: 0, dealt: 2, taken: 0, result: 0 },
        { target: s.hero, amount: 2, dealt: 2, taken: 2, result: 2 },
      ]),
    );
    expect(mustInstance(state, s.ally!).damage).toBe(0);
    expect(mustInstance(state, s.hero).damage).toBe(2);
    expectReplays(session);
  });

  it("a lasting 'each time a character is dealt damage' hears prevented damage; 'each time … takes damage' does not", () => {
    const prevented = setup({ x: 3, also: [EVACUATE] });
    const a = play(prevented, EACH_TIME);
    expect(counter(a.state, prevented.pot, "eachDealt")).toBe(1);
    expect(counter(a.state, prevented.pot, "eachTaken")).toBe(0);
    const taken = setup({ x: 3 });
    const b = play(taken, EACH_TIME);
    expect(counter(b.state, taken.pot, "eachDealt")).toBe(1);
    expect(counter(b.state, taken.pot, "eachTaken")).toBe(1);
    const none = setup({ x: 0, also: [EVACUATE] });
    const c = play(none, EACH_TIME);
    expect(counter(c.state, none.pot, "eachDealt")).toBe(0);
    expect(counter(c.state, none.pot, "eachTaken")).toBe(0);
    expectReplays(a.session);
  });

  it("every resolved damage event carries both amounts, and `taken` is its `amount` result", () => {
    for (const options of [{ x: 3 }, { x: 3, tough: 1 }, { x: 3, also: [PATCH] }, { x: 6, also: [ARMOR] }]) {
      const { events } = play(setup(options), HIT_X);
      const all = resolved(events);
      expect(all).toHaveLength(1);
      for (const damage of all) {
        expect(damage.dealt).toBeGreaterThan(0);
        expect(damage.taken).toBe(damage.result);
        expect(damage.taken).toBeLessThanOrEqual(damage.dealt!);
      }
    }
  });
});
