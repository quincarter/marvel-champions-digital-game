/**
 * RRG v1.8 "Damage" (p. 14), the order around dealing and taking damage: (1) abilities that trigger "when [character]
 * would deal/be dealt any amount of damage", (2) tough status cards, (3) abilities that trigger "when [character] would
 * take any amount of damage", (4) "takes", then placing the damage. Owner decision 2026-10-16 (audit finding 17): a
 * step 1 ability (`trigger.wouldBeDealt`) resolves before a tough status card, so Armored Rhino Suit's shape ("When any
 * amount of damage would be dealt to Rhino, place it here instead") takes the damage and Rhino keeps his tough card. The
 * General FAQ (RRG v1.8 p. 58: the tough status card is discarded "before any other abilities could trigger") governs
 * the "would be taken" stage, so a step 3 prevention still never sees damage a tough card stops
 * (`status-priority.test.ts`, docs/phase7-wave3.md §3.12).
 *
 * Here the tough card is on the villain and supports listen for its damage.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const theVillain: TargetRef = { kind: "villain" };
const self: TargetRef = { kind: "self" };

/** Armored Rhino Suit's shape (step 1): "When any amount of damage would be dealt to [the villain], place it here instead." */
const SUIT = stubAbility("suit.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    wouldBeDealt: true,
    on: { on: "dealDamage", targetIs: { categories: ["villain"] } },
  },
  effects: [
    {
      kind: "replaceTriggeringEvent",
      with: [{ kind: "addCounters", target: self, counterType: "absorbed", amount: { kind: "eventAmount" } }],
    },
  ],
});
/** A step 1 prevention that leaves some damage: "When damage would be dealt to [the villain], prevent 1 of it." */
const SHAVE = stubAbility("shave.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    wouldBeDealt: true,
    on: { on: "dealDamage", targetIs: { categories: ["villain"] } },
  },
  effects: [
    { kind: "addCounters", target: self, counterType: "saw", amount: n(1) },
    { kind: "preventDamage", amount: n(1) },
  ],
});
/** Flora Colossus's shape (step 3): "When [the villain] would take any amount of damage, prevent 1 of that damage". */
const WATCH = stubAbility("watch.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "dealDamage", targetIs: { categories: ["villain"] } } },
  effects: [
    { kind: "addCounters", target: self, counterType: "saw", amount: n(1) },
    { kind: "preventDamage", amount: n(1) },
  ],
});
const SUIT_CARD = stubSupport({ id: "suit", cost: 0, abilities: [SUIT.ref] });
const SHAVE_CARD = stubSupport({ id: "shave", cost: 0, abilities: [SHAVE.ref] });
const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: [WATCH.ref] });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const TOUGHEN = actionEvent("toughen", [{ kind: "giveStatus", target: theVillain, status: "tough" }]);
const HIT = actionEvent("hit", [{ kind: "attack", target: theVillain, amount: n(5) }]);
const EVENTS = [TOUGHEN, HIT];

const deps: EngineDeps = depsOf(SUIT, SHAVE, WATCH, ...EVENTS.map((e) => e.ability));
const CARDS = [SUIT_CARD, SHAVE_CARD, WATCHER, ...EVENTS.map((e) => e.card)];

/** p1 in hero form with `supports` in play; the villain tough when `tough`. */
function start(tough: boolean, supports: readonly (typeof WATCHER)[]): { state: GameState; ids: InstanceId[] } {
  const base = gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: [...CARDS.map((c) => c.id), ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
  });
  let state: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const ids: InstanceId[] = [];
  for (const support of supports) {
    const placed = playerCardIntoPlay(state, support.id);
    state = placed.state;
    ids.push(placed.id);
  }
  return { state: tough ? playFree(state, deps, TOUGHEN.card.id).state : state, ids };
}
const villain = (state: GameState) => mustInstance(state, state.villains[0]!.instanceId);

describe("RRG v1.8 p. 14: 'would be dealt' abilities, then tough, then 'would be taken' abilities (audit finding 17)", () => {
  it("Rhino suit shape: a 5-damage attack on a tough villain goes onto the suit; no tough card is lost, no damage taken", () => {
    const { state, ids } = start(true, [SUIT_CARD, WATCHER]);
    const [suit, watcher] = ids as [InstanceId, InstanceId];
    const { state: after, events } = playFree(state, deps, HIT.card.id);
    expect(mustInstance(after, suit).counters["absorbed"]).toBe(5);
    expect(villain(after).statuses.tough).toBe(1);
    expect(villain(after).damage).toBe(0);
    // The replacement closed the window: the "would take" interrupt was never gathered, and tough did not pre-empt it.
    expect(mustInstance(after, watcher).counters["saw"]).toBeUndefined();
    expect(events.some((e) => e.type === "interruptsPreempted")).toBe(false);
  });

  it("a step 1 prevention that leaves damage: the tough card then stops the rest and the 'would take' interrupt never triggers", () => {
    const { state, ids } = start(true, [SHAVE_CARD, WATCHER]);
    const [shave, watcher] = ids as [InstanceId, InstanceId];
    const { state: after, events } = playFree(state, deps, HIT.card.id);
    expect(mustInstance(after, shave).counters["saw"]).toBe(1);
    expect(mustInstance(after, watcher).counters["saw"]).toBeUndefined();
    expect(villain(after).statuses.tough).toBe(0);
    expect(villain(after).damage).toBe(0);
    expect(events).toContainEqual(expect.objectContaining({ type: "interruptsPreempted", reason: "tough" }));
  });

  it("a 'would be taken' prevention still loses to tough (General FAQ, RRG v1.8 p. 58): tough spent, interrupt pre-empted", () => {
    const { state, ids } = start(true, [WATCHER]);
    const [watcher] = ids as [InstanceId];
    const { state: after, events } = playFree(state, deps, HIT.card.id);
    expect(mustInstance(after, watcher).counters["saw"]).toBeUndefined();
    expect(villain(after).statuses.tough).toBe(0);
    expect(villain(after).damage).toBe(0);
    expect(events).toContainEqual(expect.objectContaining({ type: "interruptsPreempted", reason: "tough" }));
  });

  it("no tough card: unchanged, the 'would be taken' prevention resolves (5 dealt, 4 taken)", () => {
    const { state, ids } = start(false, [WATCHER]);
    const [watcher] = ids as [InstanceId];
    const { state: after, events } = playFree(state, deps, HIT.card.id);
    expect(mustInstance(after, watcher).counters["saw"]).toBe(1);
    expect(villain(after).damage).toBe(4);
    expect(events.some((e) => e.type === "interruptsPreempted")).toBe(false);
  });

  it("no tough card: the step 1 prevention resolves before the step 3 one, and both apply (5 dealt, 3 taken)", () => {
    const { state, ids } = start(false, [WATCHER, SHAVE_CARD]);
    const [watcher, shave] = ids as [InstanceId, InstanceId];
    const { state: after, events } = playFree(state, deps, HIT.card.id);
    expect(mustInstance(after, shave).counters["saw"]).toBe(1);
    expect(mustInstance(after, watcher).counters["saw"]).toBe(1);
    expect(villain(after).damage).toBe(3);
    const opened = events.flatMap((e) =>
      e.type === "windowOpened" && e.timing === "interrupt" ? [e.candidates.map((c) => String(c.abilityId))] : [],
    );
    expect(opened).toEqual([["shave.interrupt"], ["watch.interrupt"]]);
  });

  it("replays to the same state", () => {
    const { state } = start(true, [SUIT_CARD, WATCHER]);
    const { session } = playFree(state, deps, HIT.card.id);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
