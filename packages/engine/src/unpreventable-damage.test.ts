/**
 * docs/phase7-wave11-hero-packs.md §H3.3: unpreventable damage (`dealDamage.unpreventable`; Luke Cage 62001a, Internal
 * Injury 62028). Synthetic cards.
 *
 * Sources: the MC62 insert ("cannot be reduced or prevented", tough status cards not removed; RRG 1.8 has no entry);
 * the June 25 and July 9, 2026 rulings, which treat "reduce" and "prevent" alike. Owner question Q103 at its default A:
 * only reductions, preventions and tough are barred; a redirect and an increase still apply (`resolve/unpreventable.ts`).
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import { replay } from "./engine.js";
import { mustInstance, mustPlayer } from "./query.js";
import { candidatesFor } from "./resolve/triggers.js";
import { interruptBarredByUnpreventable } from "./resolve/unpreventable.js";
import { damageTakenBreakdown, type ConsequentialDamage } from "./rules.js";
import type { InstanceId } from "./ids.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport, stubVillain } from "./testing/fixtures.js";
import type { TriggerEvent } from "./trigger-events.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const theVillain: TargetRef = { kind: "villain" };
const me: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const constant = (id: string, rules: readonly RuleSpec[]) =>
  stubAbility(id, { trigger: { kind: "constant", rules }, effects: [] } satisfies AbilityDefinition);
/** "Forced Interrupt: When this villain would take damage, …" */
const forcedInterrupt = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(id, {
    trigger: { kind: "interrupt", forced: true, on: { on: "dealDamage", targetIs: { self: true } } },
    effects,
  } satisfies AbilityDefinition);

const REDUCE = constant("reduce.constant", [{ kind: "reduceDamageTaken", target: { self: true }, amount: 2 }]);
const PREVENT_ALL = constant("prevent-all.constant", [{ kind: "preventAllDamage", target: { self: true } }]);
const CAP = constant("cap.constant", [{ kind: "maxSustainedDamage", target: { self: true }, amount: n(1) }]);
const INCREASE_RULE = constant("increase.constant", [
  { kind: "increaseDamageTaken", target: { self: true }, amount: 1 },
]);
const PER_ATTACK_CAP = constant("per-attack-cap.constant", [
  { kind: "maxDamageTakenPerAttack", target: { self: true }, amount: 1 },
]);
const CANNOT = constant("cannot.constant", [{ kind: "cannotTakeDamage", target: { self: true } }]);
const PREVENT_2 = forcedInterrupt("prevent2.interrupt", [{ kind: "preventDamage", amount: n(2) }]);
/** "When this villain would take more than 1 damage, reduce that amount to 1" (Cosmic Flight's shape). */
const REDUCE_TO_1 = forcedInterrupt("reduce-to-1.interrupt", [{ kind: "reduceDamageTo", amount: n(1) }]);
/** "Forced Interrupt: … prevent that damage and this villain becomes confused" (Forcefield Generator's shape). */
const PREVENT_AND_CONFUSE = forcedInterrupt("prevent-confuse.interrupt", [
  { kind: "preventDamage" },
  { kind: "giveStatus", target: theVillain, status: "confused" },
]);
const CANCEL = forcedInterrupt("cancel.interrupt", [{ kind: "cancelTriggeringEvent" }]);
const INCREASE_1 = forcedInterrupt("increase1.interrupt", [{ kind: "increaseDamage", amount: n(1) }]);
/** "… deal that damage to the hero instead" (a redirect, `sourceFromEvent`). */
const REDIRECT = forcedInterrupt("redirect.interrupt", [
  {
    kind: "replaceTriggeringEvent",
    with: [
      {
        kind: "dealDamage",
        target: { kind: "identityOf", player: { kind: "id", playerId: P1 } },
        amount: { kind: "eventAmount" },
        sourceFromEvent: true,
      },
    ],
  },
]);
type Stub = typeof REDUCE;
const villain = (id: string, abilities: readonly Stub[]) =>
  stubVillain({ id, stages: [{ hp: flat(40), atk: 1, sch: 1, abilities: abilities.map((a) => a.ref) }] });
const PLAIN = villain("plain", []);
const REDUCER = villain("reducer", [REDUCE]);
const WARDED = villain("warded", [PREVENT_ALL]);
const CAPPED = villain("capped", [CAP]);
const PREVENTER = villain("preventer", [PREVENT_2]);
const INCREASER = villain("increaser", [INCREASE_1, INCREASE_RULE]);
const REDIRECTOR = villain("redirector", [REDIRECT]);
const PER_ATTACK_CAPPED = villain("per-attack-capped", [PER_ATTACK_CAP]);
const UNDAMAGEABLE = villain("undamageable", [CANNOT]);
const REDUCES_TO_1 = villain("reduces-to-1", [REDUCE_TO_1]);
const CONFUSED_WARD = villain("confused-ward", [PREVENT_AND_CONFUSE]);
const CANCELLER = villain("canceller", [CANCEL]);
const VILLAINS = [
  PLAIN,
  REDUCER,
  WARDED,
  CAPPED,
  PREVENTER,
  INCREASER,
  REDIRECTOR,
  PER_ATTACK_CAPPED,
  UNDAMAGEABLE,
  REDUCES_TO_1,
  CONFUSED_WARD,
  CANCELLER,
];

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const ZAP = actionEvent("zap", [{ kind: "dealDamage", target: theVillain, amount: n(3) }]);
const UNPREVENTABLE_ZAP = actionEvent("u-zap", [
  { kind: "dealDamage", target: theVillain, amount: n(3), unpreventable: true },
]);
const STRIKE = actionEvent("strike", [{ kind: "dealDamage", target: theVillain, amount: n(3), fromAttack: true }]);
const UNPREVENTABLE_STRIKE = actionEvent("u-strike", [
  { kind: "dealDamage", target: theVillain, amount: n(3), fromAttack: true, unpreventable: true },
]);
/** Unpreventable damage plus a rider, so the event is playable at a villain that cannot take damage. */
const UNPREVENTABLE_ZAP_AND_CONFUSE = actionEvent("u-zap-confuse", [
  { kind: "dealDamage", target: theVillain, amount: n(3), unpreventable: true },
  { kind: "giveStatus", target: theVillain, status: "confused" },
]);
const TAKE = actionEvent("take", [{ kind: "dealDamage", target: me, amount: n(3), taken: true }]);
const UNPREVENTABLE_TAKE = actionEvent("u-take", [
  { kind: "dealDamage", target: me, amount: n(3), taken: true, unpreventable: true },
]);
const TOUGHEN = actionEvent("toughen", [{ kind: "giveStatus", target: theVillain, status: "tough" }]);
const TOUGHEN_ME = actionEvent("toughen-me", [{ kind: "giveStatus", target: me, status: "tough" }]);
const EVENTS = [
  ZAP,
  UNPREVENTABLE_ZAP,
  STRIKE,
  UNPREVENTABLE_STRIKE,
  UNPREVENTABLE_ZAP_AND_CONFUSE,
  TAKE,
  UNPREVENTABLE_TAKE,
  TOUGHEN,
  TOUGHEN_ME,
];

/** "Interrupt: When your identity would take damage, prevent 1 of that damage." (optional, Metal Bracer's shape) */
const BRACER_INTERRUPT = stubAbility("bracer.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "dealDamage" } },
  effects: [{ kind: "preventDamage", amount: n(1) }],
} satisfies AbilityDefinition);
/** "Interrupt: When your identity would take damage, draw 1 card." (answers damage, changes nothing about it) */
const WATCHER_INTERRUPT = stubAbility("watcher.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "dealDamage" } },
  effects: [{ kind: "draw", player: { kind: "controller" }, amount: n(1) }],
} satisfies AbilityDefinition);
/** "Interrupt: … prevent 1 of that damage, then draw 1 card." (Deflection's shape: more than a prevention) */
const DEFLECT_INTERRUPT = stubAbility("deflect.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "dealDamage" } },
  effects: [
    { kind: "preventDamage", amount: n(1) },
    { kind: "draw", player: { kind: "controller" }, amount: n(1) },
  ],
} satisfies AbilityDefinition);
const DEFLECT = stubSupport({ id: "deflect", cost: 0, abilities: [DEFLECT_INTERRUPT.ref] });
const BRACER = stubSupport({ id: "bracer", cost: 0, abilities: [BRACER_INTERRUPT.ref] });
const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: [WATCHER_INTERRUPT.ref] });

const deps: EngineDeps = depsOf(
  REDUCE,
  PREVENT_ALL,
  CAP,
  INCREASE_RULE,
  PREVENT_2,
  INCREASE_1,
  REDIRECT,
  BRACER_INTERRUPT,
  WATCHER_INTERRUPT,
  DEFLECT_INTERRUPT,
  PER_ATTACK_CAP,
  CANNOT,
  REDUCE_TO_1,
  PREVENT_AND_CONFUSE,
  CANCEL,
  ...EVENTS.map((e) => e.ability),
);

function start(v: typeof PLAIN): GameState {
  const state = gameAtFirstTurn({
    cards: [...VILLAINS, BRACER, WATCHER, DEFLECT, ...EVENTS.map((e) => e.card)],
    deps,
    villain: v,
    deck: [
      ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
      ...copiesOf(WATCHER.id, 2),
      ...copiesOf(BRACER.id, 2),
      DEFLECT.id,
    ],
  });
  return { ...state, players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
}
const villainOf = (state: GameState) => mustInstance(state, state.villains[0]!.instanceId);
const heroOf = (state: GameState) => mustInstance(state, mustPlayer(state, P1).identity.instanceId);
const play = (state: GameState, card: { readonly card: { readonly id: string } }) =>
  playFree(state, deps, card.card.id as never);

describe("§H3.3 unpreventable damage against tough", () => {
  it("control: 3 damage to a tough villain is prevented and the tough card discarded", () => {
    const state = play(play(start(PLAIN), TOUGHEN).state, ZAP).state;
    expect(villainOf(state).damage).toBe(0);
    expect(villainOf(state).statuses.tough).toBe(0);
  });

  it("unpreventable: the damage is taken and the tough card stays (MC62 insert); replay deep-equal", () => {
    const { state, events, session } = play(play(start(PLAIN), TOUGHEN).state, UNPREVENTABLE_ZAP);
    expect(villainOf(state).damage).toBe(3);
    expect(villainOf(state).statuses.tough).toBe(1);
    expect(events.find((e) => e.type === "damageDealt")).toMatchObject({ amount: 3, unpreventable: true });
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("'take 3 unpreventable damage' (taken) goes through the player's own tough card, which stays", () => {
    const toughened = play(start(PLAIN), TOUGHEN_ME).state;
    expect(heroOf(play(toughened, TAKE).state).damage).toBe(0);
    const state = play(toughened, UNPREVENTABLE_TAKE).state;
    expect(heroOf(state).damage).toBe(3);
    expect(heroOf(state).statuses.tough).toBe(1);
  });
});

describe("§H3.3 unpreventable damage against reductions and preventions", () => {
  it("a constant reduction: 3 - 2 = 1 normally, 3 unpreventable", () => {
    expect(villainOf(play(start(REDUCER), ZAP).state).damage).toBe(1);
    expect(villainOf(play(start(REDUCER), UNPREVENTABLE_ZAP).state).damage).toBe(3);
  });

  it("'prevent all damage to X': none normally, 3 unpreventable", () => {
    expect(villainOf(play(start(WARDED), ZAP).state).damage).toBe(0);
    expect(villainOf(play(start(WARDED), UNPREVENTABLE_ZAP).state).damage).toBe(3);
  });

  it("a lingering reduction (a consequential-damage rule whose card left play) is not applied either", () => {
    const state = start(PLAIN);
    const villainId = villainOf(state).instanceId;
    const consequential: ConsequentialDamage = {
      from: "attack",
      event: { kind: "dealDamage", targetInstanceId: villainId, amount: 3, sourceInstanceId: null, fromAttack: false },
      vars: {},
      slots: {},
      lingering: [{ sourceInstanceId: "gone" as InstanceId, kind: "reduceDamageTaken", amount: 2 }],
    };
    const taken = (unpreventable: boolean) =>
      damageTakenBreakdown(state, deps, villainId, 3, false, consequential, undefined, unpreventable).taken;
    expect(taken(false)).toBe(1);
    expect(taken(true)).toBe(3);
  });

  it("a 'reduce that amount to 1' interrupt (Cosmic Flight's shape): 1 normally, 3 unpreventable", () => {
    expect(villainOf(play(start(REDUCES_TO_1), ZAP).state).damage).toBe(1);
    const { state, events } = play(start(REDUCES_TO_1), UNPREVENTABLE_ZAP);
    expect(villainOf(state).damage).toBe(3);
    expect(events.some((e) => e.type === "damageCapped")).toBe(false);
  });

  it("a 'prevent 2 of that damage' interrupt: 1 normally; against unpreventable damage it does not resolve", () => {
    expect(villainOf(play(start(PREVENTER), ZAP).state).damage).toBe(1);
    const { state, events } = play(start(PREVENTER), UNPREVENTABLE_ZAP);
    expect(villainOf(state).damage).toBe(3);
    expect(events.some((e) => e.type === "damagePrevented")).toBe(false);
  });

  it("a forced interrupt still resolves: its prevention does nothing, its other effect happens", () => {
    const plain = play(start(CONFUSED_WARD), ZAP).state;
    expect(villainOf(plain).damage).toBe(0);
    expect(villainOf(plain).statuses.confused).toBe(1);
    const state = play(start(CONFUSED_WARD), UNPREVENTABLE_ZAP).state;
    expect(villainOf(state).damage).toBe(3);
    expect(villainOf(state).statuses.confused).toBe(1);
  });

  it("an optional interrupt that only prevents is not offered (engine reading); one that does more still is", () => {
    const withBracer = playerCardIntoPlay(start(PLAIN), BRACER.id);
    const withDeflect = playerCardIntoPlay(withBracer.state, DEFLECT.id);
    const both = playerCardIntoPlay(withDeflect.state, WATCHER.id);
    const hero = heroOf(both.state).instanceId;
    const damage = (unpreventable: boolean): TriggerEvent => ({
      kind: "dealDamage",
      targetInstanceId: hero,
      amount: 3,
      sourceInstanceId: null,
      fromAttack: false,
      ...(unpreventable ? { unpreventable: true as const } : {}),
    });
    const offered = (event: TriggerEvent) =>
      candidatesFor(both.state, deps, event, "interrupt", false).map((c) => String(c.abilityId));
    expect(offered(damage(false)).sort()).toEqual(["bracer.interrupt", "deflect.interrupt", "watcher.interrupt"]);
    expect(offered(damage(true)).sort()).toEqual(["deflect.interrupt", "watcher.interrupt"]);
    expect(interruptBarredByUnpreventable(BRACER_INTERRUPT.definition, damage(true))).toBe(true);
    expect(interruptBarredByUnpreventable(BRACER_INTERRUPT.definition, damage(false))).toBe(false);
  });
});

describe("§H3.3 what still applies to unpreventable damage (Q103 at A)", () => {
  it("caps are 'cannot's (RRG 1.8 p. 13; wave 6 Q9): the sustained cap and the per-attack cap still hold", () => {
    expect(villainOf(play(start(CAPPED), ZAP).state).damage).toBe(1);
    expect(villainOf(play(start(CAPPED), UNPREVENTABLE_ZAP).state).damage).toBe(1);
    expect(villainOf(play(start(PER_ATTACK_CAPPED), STRIKE).state).damage).toBe(1);
    expect(villainOf(play(start(PER_ATTACK_CAPPED), UNPREVENTABLE_STRIKE).state).damage).toBe(1);
  });

  it("'cannot take damage' beats unpreventable damage (RRG 1.8 \"Cannot\", p. 13)", () => {
    const state = play(start(UNDAMAGEABLE), UNPREVENTABLE_ZAP_AND_CONFUSE).state;
    expect(villainOf(state).damage).toBe(0);
    expect(villainOf(state).statuses.confused).toBe(1);
  });

  it("cancelling the damage event still cancels it", () => {
    expect(villainOf(play(start(CANCELLER), ZAP).state).damage).toBe(0);
    expect(villainOf(play(start(CANCELLER), UNPREVENTABLE_ZAP).state).damage).toBe(0);
  });

  it("increases apply: 3 + 1 (interrupt) + 1 (constant) = 5", () => {
    expect(villainOf(play(start(INCREASER), ZAP).state).damage).toBe(5);
    expect(villainOf(play(start(INCREASER), UNPREVENTABLE_ZAP).state).damage).toBe(5);
  });

  it("a redirect applies, and the moved damage stays unpreventable: through the hero's tough card, which stays", () => {
    const toughened = play(start(REDIRECTOR), TOUGHEN_ME).state;
    const plain = play(toughened, ZAP).state;
    expect(villainOf(plain).damage).toBe(0);
    expect(heroOf(plain).damage).toBe(0);
    expect(heroOf(plain).statuses.tough).toBe(0);
    const state = play(toughened, UNPREVENTABLE_ZAP).state;
    expect(villainOf(state).damage).toBe(0);
    expect(heroOf(state).damage).toBe(3);
    expect(heroOf(state).statuses.tough).toBe(1);
  });
});
