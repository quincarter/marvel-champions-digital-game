/**
 * docs/phase7-wave6.md §3.53 (the gap §3.52 found): an interrupt or response with an "up to N" counter cost, used inside
 * a timing window, asks how many counters to remove (`chooseCostCounters`), as an action's `costSelection.counters` is
 * chosen up front. Synthetic cards shaped like Gambit's Throw de Card (37001a: "Interrupt: When you play an ATTACK
 * event, remove up to 3 charge counters from here → that event deal +1 damage for each counter removed").
 *
 * - The count runs from 1 (RRG 1.8 "Cost", p. 14: "A cost requiring … 'up to' some number of game elements requires a
 *   minimum of one such game element") to the printed N or the counters held, whichever is lower; with at most one
 *   counter there is nothing to ask.
 * - It is asked before the payment (RRG 1.8 "Initiating Abilities", p. 24: the cost is determined at step 3, paid at
 *   step 5), survives a resource payment, and is spent with its candidate.
 * - A count the choice did not offer is refused.
 */

import { flat, trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import type { PendingChoice } from "./choices.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { TargetRef } from "./spec.js";
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
const onAttackPlayed = {
  kind: "interrupt",
  forced: false,
  on: { on: "cardBeingPlayed", playerIs: "controller", targetIs: { categories: ["event"], trait: ATTACK } },
} as const;
const upTo3 = (target: "self" | "identity", extra: AbilityCost = {}): AbilityCost => ({
  ...extra,
  spendCounters: { counterType: "charge", amount: 3, target, upTo: true, bind: "removed" },
});
const bonus = [{ kind: "modifyCardEffect", card: eventTarget, damage: removed }] as const;

/** Throw de Card's shape on a support: up to 3 charge counters from here → +1 damage each. */
const THROW = stubAbility("throw.interrupt", { trigger: onAttackPlayed, cost: upTo3("self"), effects: bonus });
const THROW_CARD = stubSupport({ id: "throw-deck", cost: 0, abilities: [THROW.ref] });
/** The same with a resource to pay too: the count must survive the payment step. */
const PAID = stubAbility("paid.interrupt", {
  trigger: onAttackPlayed,
  cost: upTo3("self", { resources: 1 }),
  effects: bonus,
});
const PAID_CARD = stubSupport({ id: "paid-deck", cost: 0, abilities: [PAID.ref] });
/** The same as an event in hand, from the identity's counters: the count is asked before the card is played. */
const HAND = stubAbility("hand.interrupt", { trigger: onAttackPlayed, cost: upTo3("identity"), effects: bonus });
const HAND_CARD = stubEvent({ id: "hand-throw", cost: 0, abilities: [HAND.ref] });

/** An ATTACK event dealing 1 damage to the villain. */
const STRIKE_ACTION = stubAbility("strike.action", {
  trigger: { kind: "action" },
  label: ["attack"],
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: n(1) }],
});
const STRIKE = { ...stubEvent({ id: "strike", cost: 0, abilities: [STRIKE_ACTION.ref] }), traits: [ATTACK] };

const VILLAIN = stubVillain({ id: "big-villain", stages: [{ hp: flat(40), atk: 0, sch: 0 }] });
const deps: EngineDeps = depsOf(THROW, PAID, HAND, STRIKE_ACTION);
const USED = [THROW.ref.id, PAID.ref.id, HAND.ref.id];

type Kind = "throw" | "paid";

interface Table {
  readonly state: GameState;
  /** The supports in play, in the order given. */
  readonly supports: readonly InstanceId[];
  readonly strike: InstanceId;
}

/** P1 with one support per entry (its kind and charge counters), `identity` charge counters, and the strike in hand. */
function table(supports: readonly (readonly [Kind, number])[], identity = 0, hand = false): Table {
  let state = gameAtFirstTurn({
    cards: [THROW_CARD, PAID_CARD, HAND_CARD, STRIKE, VILLAIN],
    deps,
    villain: VILLAIN,
    deck: [THROW_CARD.id, THROW_CARD.id, PAID_CARD.id, HAND_CARD.id, STRIKE.id, STRIKE.id],
  });
  const withCharges = (id: InstanceId, count: number): void => {
    state = {
      ...state,
      instances: { ...state.instances, [id]: { ...mustInstance(state, id), counters: { charge: count } } },
    };
  };
  const ids: InstanceId[] = [];
  for (const [kind, charges] of supports) {
    const placed = playerCardIntoPlay(state, kind === "throw" ? THROW_CARD.id : PAID_CARD.id);
    state = placed.state;
    ids.push(placed.id);
    withCharges(placed.id, charges);
  }
  if (identity > 0) withCharges(mustPlayer(state, P1).identity.instanceId, identity);
  if (hand) state = giveCard(state, P1, HAND_CARD.id).state;
  const strike = giveCard(state, P1, STRIKE.id);
  return { state: strike.state, supports: ids, strike: strike.id };
}

const playFree = (card: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment: [],
  attachToInstanceId: null,
});

/**
 * Uses every Throw-shaped interrupt offered and answers each count prompt from `counts` in turn (recording each prompt
 * asked); a payment takes its first option; everything else is the default.
 */
function picker(counts: readonly number[], asked: PendingChoice[]) {
  const queue = [...counts];
  return (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseTriggers")
      return choice.options.filter((o) => USED.some((id) => o.optionId.includes(id))).map((o) => o.optionId);
    if (choice.prompt.kind === "chooseCostCounters") {
      asked.push(choice);
      const next = queue.shift();
      if (next === undefined) throw new Error("an unexpected count prompt");
      return [String(next)];
    }
    if (choice.prompt.kind === "payForAbility") return choice.options.slice(0, 1).map((o) => o.optionId);
    return defaultPick(state);
  };
}

function run(state: GameState, counts: readonly number[], ...commands: Command[]) {
  const asked: PendingChoice[] = [];
  const result = runCommandsPicking(state, deps, picker(counts, asked), ...commands);
  const replayed = replay(result.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.state);
  return { ...result, asked };
}

const charges = (state: GameState, id: InstanceId): number => mustInstance(state, id).counters.charge ?? 0;
const villainDamage = (state: GameState): number => mustInstance(state, state.villains[0]!.instanceId).damage;
const optionIds = (choice: PendingChoice | undefined) => choice?.options.map((o) => o.optionId);

describe("§3.53 an up-to counter cost chosen inside a timing window", () => {
  it("3 counters, 1 chosen: asks 3, 2 or 1, removes only 1, +1 damage", () => {
    const { state, supports, strike } = table([["throw", 3]]);
    const { state: after, asked } = run(state, [1], playFree(strike));
    expect(asked).toHaveLength(1);
    expect(asked[0]?.prompt).toEqual({
      kind: "chooseCostCounters",
      instanceId: supports[0],
      abilityId: THROW.ref.id,
      counterType: "charge",
      min: 1,
      max: 3,
    });
    expect(optionIds(asked[0])).toEqual(["3", "2", "1"]);
    expect([asked[0]?.minSelections, asked[0]?.maxSelections]).toEqual([1, 1]);
    expect(charges(after, supports[0]!)).toBe(2);
    expect(villainDamage(after)).toBe(1 + 1);
    expect(after.stack).toEqual([]);
  });

  it("the maximum chosen: removes all 3, +3 damage", () => {
    const { state, supports, strike } = table([["throw", 3]]);
    const { state: after } = run(state, [3], playFree(strike));
    expect(charges(after, supports[0]!)).toBe(0);
    expect(villainDamage(after)).toBe(1 + 3);
  });

  it("bound by the counters held: 2 held offers 2 or 1; 5 held still offers no more than the printed 3", () => {
    const two = table([["throw", 2]]);
    const { state: afterTwo, asked: askedTwo } = run(two.state, [2], playFree(two.strike));
    expect(optionIds(askedTwo[0])).toEqual(["2", "1"]);
    expect(askedTwo[0]?.prompt).toMatchObject({ min: 1, max: 2 });
    expect(charges(afterTwo, two.supports[0]!)).toBe(0);
    expect(villainDamage(afterTwo)).toBe(1 + 2);

    const five = table([["throw", 5]]);
    const { state: afterFive, asked: askedFive } = run(five.state, [2], playFree(five.strike));
    expect(optionIds(askedFive[0])).toEqual(["3", "2", "1"]);
    expect(charges(afterFive, five.supports[0]!)).toBe(3);
    expect(villainDamage(afterFive)).toBe(1 + 2);
  });

  it("one counter is no choice: nothing is asked and it is removed", () => {
    const { state, supports, strike } = table([["throw", 1]]);
    const { state: after, asked } = run(state, [], playFree(strike));
    expect(asked).toEqual([]);
    expect(charges(after, supports[0]!)).toBe(0);
    expect(villainDamage(after)).toBe(1 + 1);
  });

  it("a count the choice did not offer is refused, and the state is untouched", () => {
    const { state, strike } = table([["throw", 2]]);
    let session = startSession(state);
    const apply = (command: Command) => {
      const result = sessionApply(session, command, deps);
      if (!result.ok) throw new Error(result.error.message);
      session = result.session;
    };
    apply(playFree(strike));
    const triggers = session.state.pendingChoice!;
    expect(triggers.prompt.kind).toBe("chooseTriggers");
    apply({
      type: "resolveChoice",
      playerId: P1,
      choiceId: triggers.choiceId,
      selectedOptionIds: triggers.options.filter((o) => o.optionId.includes(THROW.ref.id)).map((o) => o.optionId),
    });
    const count = session.state.pendingChoice!;
    expect(count.prompt.kind).toBe("chooseCostCounters");
    for (const selected of [["3"], ["0"], ["1", "2"], []]) {
      const refused = sessionApply(
        session,
        { type: "resolveChoice", playerId: P1, choiceId: count.choiceId, selectedOptionIds: selected },
        deps,
      );
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.error.code).toBe("invalid_choice");
    }
    expect(session.state.pendingChoice).toEqual(count);
  });

  it("two abilities in one window are each asked their own count", () => {
    const { state, supports, strike } = table([
      ["throw", 3],
      ["throw", 2],
    ]);
    const { state: after, asked } = run(state, [1, 2], playFree(strike));
    expect(asked.map((choice) => choice.prompt)).toEqual([
      expect.objectContaining({ instanceId: supports[0], max: 3 }),
      expect.objectContaining({ instanceId: supports[1], max: 2 }),
    ]);
    expect(charges(after, supports[0]!)).toBe(2);
    expect(charges(after, supports[1]!)).toBe(0);
    expect(villainDamage(after)).toBe(1 + 1 + 2);
  });

  it("asked before a resource payment, and the count survives it", () => {
    const { state, supports, strike } = table([["paid", 3]]);
    const before = mustPlayer(state, P1).hand.length;
    const { state: after, asked } = run(state, [2], playFree(strike));
    expect(asked).toHaveLength(1);
    expect(charges(after, supports[0]!)).toBe(1);
    expect(villainDamage(after)).toBe(1 + 2);
    // The strike was played and one card paid the resource.
    expect(mustPlayer(after, P1).hand.length).toBe(before - 2);
  });

  it("an event from hand: asked before it is played, removed from the identity", () => {
    const { state, strike } = table([], 3, true);
    const identity = mustPlayer(state, P1).identity.instanceId;
    const { state: after, asked } = run(state, [1], playFree(strike));
    expect(asked[0]?.prompt).toMatchObject({ kind: "chooseCostCounters", abilityId: HAND.ref.id, max: 3 });
    expect(charges(after, identity)).toBe(2);
    expect(villainDamage(after)).toBe(1 + 1);
  });

  it("the chosen count does not outlive its candidate: the next play is asked again, from what is left", () => {
    const { state, supports, strike } = table([["throw", 3]]);
    const first = run(state, [1], playFree(strike));
    expect(first.state.stack).toEqual([]);
    const second = giveCard(first.state, P1, STRIKE.id, [strike]);
    const { state: after, asked } = run(second.state, [2], playFree(second.id));
    expect(optionIds(asked[0])).toEqual(["2", "1"]);
    expect(charges(after, supports[0]!)).toBe(0);
    expect(villainDamage(after)).toBe(1 + 1 + 1 + 2);
  });
});
