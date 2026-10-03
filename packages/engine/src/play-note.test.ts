/**
 * docs/phase7-wave6.md §3.52: what an interrupt did to the card being played. Synthetic cards shaped like Gambit's Throw
 * de Card (37001a: "Interrupt: When you play an ATTACK event, remove up to 3 charge counters from here → that event deal
 * +1 damage for each counter removed") and Charged Card (37006: "If Gambit's 'Throw de Card' ability removed at least:
 * • 1 counter, this attack gains ranged. • 2 counters, … piercing. • 3 counters, … overkill").
 *
 * - `modifyCardEffect.note` records a number on the card's play (its `playCard` frame), with the damage bonus.
 * - `Predicate playNote { name, atLeast }` reads it while that card resolves; the note ends with the play.
 * - `Predicate playedVia` (§3.42) reads the same record (the play's frame), so a card played twice keeps neither.
 *
 * Here the event's thresholds draw a card each (one draw per threshold reached), so a near miss shows in the hand size.
 *
 * Sources: the cards' text; RRG 1.8 "Event" (p. 19: a modifier to the damage an event deals applies to each instance;
 * the event's effects resolve before it is discarded), "Cost" (p. 14: "up to" requires at least one), "Interrupt"
 * (p. 23). No FFG ruling on Throw de Card or Charged Card in the post-RRG 1.7 rulings transcript.
 */

import { flat, trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, Predicate, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubSupport, stubVillain } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const ATTACK = trait("ATTACK");
const n = (value: number) => ({ kind: "const", value }) as const;
const removed = { kind: "var", name: "removed" } as const;
const eventTarget: TargetRef = { kind: "eventTarget" };
const VILLAIN_REF: TargetRef = { kind: "villain" };
const playNote = (atLeast: number): Predicate => ({ kind: "playNote", name: "throw", atLeast });

/** Throw de Card's shape: up to 3 charge counters from here → +1 damage each, and the number noted on the play. */
const THROW = stubAbility("throw.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: false,
    on: { on: "cardBeingPlayed", playerIs: "controller", targetIs: { categories: ["event"], trait: ATTACK } },
  },
  cost: { spendCounters: { counterType: "charge", amount: 3, target: "self", upTo: true, bind: "removed" } },
  effects: [{ kind: "modifyCardEffect", card: eventTarget, damage: removed, note: { name: "throw", value: removed } }],
});
const THROW_CARD = stubSupport({ id: "throw-deck", cost: 0, abilities: [THROW.ref] });

/** A standing interrupt that notes 2 and adds no damage: the note is written even when the bonus is 0. */
const NOTER = stubAbility("noter.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "cardBeingPlayed", playerIs: "controller", targetIs: { categories: ["event"], trait: ATTACK } },
  },
  effects: [{ kind: "modifyCardEffect", card: eventTarget, damage: n(0), note: { name: "throw", value: n(2) } }],
});
const NOTER_CARD = stubSupport({ id: "noter", cost: 0, abilities: [NOTER.ref] });

/** An action noting on a card that is not being played (itself, in play): nothing to note on. */
const MISPLACED = stubAbility("misplaced.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "modifyCardEffect", card: { kind: "self" }, note: { name: "throw", value: n(3) } }],
});
const MISPLACED_CARD = stubSupport({ id: "misplaced", cost: 0, abilities: [MISPLACED.ref] });

/** Charged Card's shape: 1 damage, then one draw per threshold of the note reached. */
const draw: EffectSpec = { kind: "draw", player: { kind: "controller" }, amount: n(1) };
const CHARGED_ACTION = stubAbility("charged.action", {
  trigger: { kind: "action" },
  label: ["attack"],
  effects: [
    { kind: "dealDamage", target: VILLAIN_REF, amount: n(1) },
    { kind: "if", condition: playNote(1), then: [draw] },
    { kind: "if", condition: playNote(2), then: [draw] },
    { kind: "if", condition: playNote(3), then: [draw] },
  ],
});
const CHARGED = { ...stubEvent({ id: "charged", cost: 0, abilities: [CHARGED_ACTION.ref] }), traits: [ATTACK] };
/** The same thresholds on an event that is not an ATTACK: Throw de Card cannot interrupt its play. */
const PLAIN = stubEvent({ id: "plain", cost: 0, abilities: [CHARGED_ACTION.ref] });

const VILLAIN = stubVillain({ id: "big-villain", stages: [{ hp: flat(40), atk: 0, sch: 0 }] });
const deps: EngineDeps = depsOf(THROW, NOTER, MISPLACED, CHARGED_ACTION);

interface Table {
  readonly state: GameState;
  readonly deck: InstanceId | null;
  readonly charged: InstanceId;
}

/** P1 with Throw de Card's support holding `charges` counters (or none in play), and Charged Card in hand. */
function table(charges: number | null, extra: readonly ("noter" | "misplaced" | "second")[] = []): Table {
  let state = gameAtFirstTurn({
    cards: [THROW_CARD, NOTER_CARD, MISPLACED_CARD, CHARGED, PLAIN, VILLAIN],
    deps,
    villain: VILLAIN,
    deck: [THROW_CARD.id, THROW_CARD.id, NOTER_CARD.id, MISPLACED_CARD.id, CHARGED.id, CHARGED.id, PLAIN.id],
  });
  let deck: InstanceId | null = null;
  const withCharges = (id: InstanceId, count: number): void => {
    state = {
      ...state,
      instances: { ...state.instances, [id]: { ...mustInstance(state, id), counters: { charge: count } } },
    };
  };
  if (charges !== null) {
    const placed = playerCardIntoPlay(state, THROW_CARD.id);
    state = placed.state;
    deck = placed.id;
    withCharges(placed.id, charges);
  }
  if (extra.includes("second")) {
    const placed = playerCardIntoPlay(state, THROW_CARD.id);
    state = placed.state;
    withCharges(placed.id, 1);
  }
  if (extra.includes("noter")) state = playerCardIntoPlay(state, NOTER_CARD.id).state;
  if (extra.includes("misplaced")) state = playerCardIntoPlay(state, MISPLACED_CARD.id).state;
  const given = giveCard(state, P1, CHARGED.id);
  return { state: given.state, deck, charged: given.id };
}

const playFree = (card: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment: [],
  attachToInstanceId: null,
});

/** Answers every choice by default, except that every Throw de Card offered is used (or declined, with `use: false`). */
const throwPicker =
  (use: boolean) =>
  (state: GameState): readonly string[] => {
    const offered = (state.pendingChoice?.options ?? []).filter((o) => o.optionId.includes(THROW.ref.id));
    return use && offered.length > 0 ? offered.map((o) => o.optionId) : defaultPick(state);
  };

function run(state: GameState, use: boolean, ...commands: Command[]) {
  const result = runCommandsPicking(state, deps, throwPicker(use), ...commands);
  const replayed = replay(result.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.state);
  return result;
}

const villainDamage = (state: GameState): number => mustInstance(state, state.villains[0]!.instanceId).damage;
const handSize = (state: GameState): number => mustPlayer(state, P1).hand.length;
const notes = (events: readonly GameEvent[]) =>
  events.filter((e): e is Extract<GameEvent, { type: "playNoted" }> => e.type === "playNoted");

describe("§3.52 a note on the card being played", () => {
  // Each count: counters removed, damage dealt (1 + removed), draws (thresholds reached). A near miss (one threshold
  // off, or the bonus without the note) fails the exact draw count.
  for (const [charges, removedCount] of [
    [1, 1],
    [2, 2],
    [3, 3],
    [5, 3],
  ] as const) {
    it(`${charges} charge counter(s): removes ${removedCount}, +${removedCount} damage, reaches ${removedCount} threshold(s)`, () => {
      const { state, deck, charged } = table(charges);
      const before = handSize(state);
      const { state: after, events } = run(state, true, playFree(charged));
      expect(mustInstance(after, deck!).counters.charge ?? 0).toBe(charges - removedCount);
      expect(villainDamage(after)).toBe(1 + removedCount);
      expect(handSize(after)).toBe(before - 1 + removedCount);
      expect(notes(events)).toEqual([
        { type: "playNoted", instanceId: charged, name: "throw", value: removedCount, total: removedCount },
      ]);
      expect(mustPlayer(after, P1).discard).toContain(charged);
    });
  }

  it("order: the counters leave, then the note, then the event's damage, then its draws", () => {
    const { state, charged } = table(2);
    const { events } = run(state, true, playFree(charged));
    const at = (type: GameEvent["type"]) => events.findIndex((e) => e.type === type);
    expect(at("counterRemoved")).toBeGreaterThanOrEqual(0);
    expect(at("counterRemoved")).toBeLessThan(at("playNoted"));
    expect(at("playNoted")).toBeLessThan(at("damageDealt"));
    expect(at("damageDealt")).toBeLessThan(at("cardDrawn"));
  });

  it("declined: no counters removed, no note, no bonus, no threshold", () => {
    const { state, deck, charged } = table(3);
    const before = handSize(state);
    const { state: after, events } = run(state, false, playFree(charged));
    expect(mustInstance(after, deck!).counters.charge).toBe(3);
    expect(villainDamage(after)).toBe(1);
    expect(handSize(after)).toBe(before - 1);
    expect(notes(events)).toEqual([]);
  });

  it("the note ends with the play: a second copy played afterwards, Throw declined, reaches nothing", () => {
    const { state, charged } = table(3);
    const second = giveCard(state, P1, CHARGED.id, [charged]);
    const first = run(second.state, true, playFree(charged));
    const before = handSize(first.state);
    const { state: after, events } = run(first.state, false, playFree(second.id));
    expect(handSize(after)).toBe(before - 1);
    expect(notes(events)).toEqual([]);
    expect(after.stack).toEqual([]);
  });

  it("a non-ATTACK event: Throw de Card is not offered, and the same thresholds read false", () => {
    const { state, deck } = table(3);
    const plain = giveCard(state, P1, PLAIN.id);
    const before = handSize(plain.state);
    const { state: after, events } = run(plain.state, true, playFree(plain.id));
    expect(mustInstance(after, deck!).counters.charge).toBe(3);
    expect(handSize(after)).toBe(before - 1);
    expect(notes(events)).toEqual([]);
  });

  it("a note is written even when the bonus is 0, and two notes of one name add up", () => {
    // Noter alone: 2, no extra damage → two thresholds.
    const alone = table(null, ["noter"]);
    const beforeAlone = handSize(alone.state);
    const one = run(alone.state, false, playFree(alone.charged));
    expect(villainDamage(one.state)).toBe(1);
    expect(handSize(one.state)).toBe(beforeAlone - 1 + 2);
    expect(notes(one.events).map((e) => [e.value, e.total])).toEqual([[2, 2]]);
    // Noter (2) and two Throw de Card supports (1 each): 4 in total, all three thresholds, +2 damage. The forced
    // interrupt resolves first (RRG 1.8 "Ability", "Simultaneous Timing Priority", p. 5), then the two chosen together.
    const both = table(1, ["noter", "second"]);
    const beforeBoth = handSize(both.state);
    const two = run(both.state, true, playFree(both.charged));
    expect(villainDamage(two.state)).toBe(1 + 2);
    expect(handSize(two.state)).toBe(beforeBoth - 1 + 3);
    expect(notes(two.events).map((e) => [e.value, e.total])).toEqual([
      [2, 2],
      [1, 3],
      [1, 4],
    ]);
  });

  it("a note on a card that is not being played writes nothing", () => {
    const { state } = table(null, ["misplaced"]);
    const misplaced = mustPlayer(state, P1).playArea.find(
      (id) => mustInstance(state, id).cardId === MISPLACED_CARD.id,
    )!;
    const { state: after, events } = run(state, false, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: misplaced,
      abilityId: MISPLACED.ref.id,
      payment: [],
    });
    expect(notes(events)).toEqual([]);
    expect(after.stack).toEqual([]);
  });

  it("nothing changes when no card notes: the event deals its 1 damage and reaches no threshold", () => {
    const { state, charged } = table(null);
    const before = handSize(state);
    const { state: after, events } = run(state, false, playFree(charged));
    expect(villainDamage(after)).toBe(1);
    expect(handSize(after)).toBe(before - 1);
    expect(notes(events)).toEqual([]);
  });
});
