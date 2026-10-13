/**
 * The X picker in the pay step (a card printed with an X cost, `specialCost: "X"`): Wonder Man's Everywhere All at Once
 * (58018, minimum X of 1). Real cards moved into his hand; every price and every limit is the engine's.
 */
import { WAVE10_DEPS } from "@mc/cards";
import { applyCommand, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { heroPackGame } from "./hero-pack-fixture.js";
import { beginPayment, paymentView, setPaymentX, togglePayment } from "./payment-model.js";

function staged(...codes: readonly string[]) {
  const base = heroPackGame("wonderMan");
  const me = base.players[0]!.playerId;
  const find = (code: string, taken: readonly InstanceId[]): InstanceId => {
    const seat = base.players[0]!;
    const id = [...seat.hand, ...seat.deck, ...seat.discard].find(
      (candidate) => base.instances[candidate]?.cardId === code && !taken.includes(candidate),
    );
    if (!id) throw new Error(`no ${code}`);
    return id;
  };
  const hand = codes.reduce<InstanceId[]>((ids, code) => [...ids, find(code, ids)], []);
  const state = {
    ...base,
    players: base.players.map((p) => ({
      ...p,
      identity: { ...p.identity, form: "hero" as const },
      hand,
      deck: p.deck.filter((id) => !hand.includes(id)),
      discard: p.discard.filter((id) => !hand.includes(id)),
    })),
    instances: {
      ...base.instances,
      [base.mainScheme.instanceId]: { ...base.instances[base.mainScheme.instanceId]!, threat: 8 },
    },
  } as GameState;
  return { state, me, hand };
}

describe("the X picker", () => {
  test("opens at the engine's least X and reaches the most the hand can pay for", () => {
    // Everywhere All at Once, then 58023 (2 resources), 58016 (1) and 58004 (1): four resources to pay with.
    const { state, me, hand } = staged("58018", "58023", "58016", "58004");
    const open = beginPayment(state, me, { kind: "playCard", instanceId: hand[0]! }, null, WAVE10_DEPS)!;
    expect(open.x).toBe(1);
    expect(open.xRange!.min).toBe(1);
    const view = paymentView(state, me, open, "x", WAVE10_DEPS);
    expect(view.xPicker).toMatchObject({ value: 1, min: 1 });
    expect(view.required).toBe(1);
    // One more X is asked of a hand that has only so many resources: the next X after the most is unpayable.
    const most = view.xPicker!.max;
    expect(most).toBeGreaterThan(1);
    const past = setPaymentX(state, me, { ...open, xRange: { min: 1, max: most + 5 } }, most + 1, WAVE10_DEPS);
    expect(paymentView(state, me, past, "x", WAVE10_DEPS).command).toBeNull();
  }, 120_000);

  test("raising X reprices the requirement, keeps the picks that are still offered, and the command carries X", () => {
    const { state, me, hand } = staged("58018", "58023", "58016", "58004");
    const open = beginPayment(state, me, { kind: "playCard", instanceId: hand[0]! }, null, WAVE10_DEPS)!;
    const energy = open.query.sources.find((source) => source.instanceId === hand[1])!;
    const picked = togglePayment(open, energy.optionId);
    const atOne = paymentView(state, me, picked, "x", WAVE10_DEPS);
    expect(atOne.command).toMatchObject({ type: "playCard", x: 1 });
    expect(atOne.overpaid).toBe(1);

    const two = setPaymentX(state, me, picked, 2, WAVE10_DEPS);
    expect(two.picked).toEqual([energy.optionId]);
    const atTwo = paymentView(state, me, two, "x", WAVE10_DEPS);
    expect(atTwo.xPicker!.value).toBe(2);
    expect(atTwo.required).toBe(2);
    expect(atTwo.paid).toBe(2);
    expect(atTwo.overpaid).toBe(0);
    expect(atTwo.command).toMatchObject({ x: 2 });
    expect(applyCommand(state, atTwo.command!, WAVE10_DEPS).ok).toBe(true);

    // Raised past what the pick pays for: the pick stays, and the bar reads short until more is chosen.
    const three = paymentView(state, me, setPaymentX(state, me, picked, 3, WAVE10_DEPS), "x", WAVE10_DEPS);
    expect(three.required).toBe(3);
    expect(three.command).toBeNull();
    // Never below the least X, never above the most.
    expect(setPaymentX(state, me, picked, 0, WAVE10_DEPS).x).toBe(1);
    expect(setPaymentX(state, me, picked, 99, WAVE10_DEPS).x).toBe(atOne.xPicker!.max);
  }, 120_000);

  test("a card with a fixed cost has no picker", () => {
    const { state, me, hand } = staged("58004", "58023");
    const open = beginPayment(state, me, { kind: "playCard", instanceId: hand[0]! }, null, WAVE10_DEPS)!;
    expect(open.x).toBeUndefined();
    expect(paymentView(state, me, open, "x", WAVE10_DEPS).xPicker).toBeNull();
    expect(setPaymentX(state, me, open, 3, WAVE10_DEPS)).toBe(open);
  }, 120_000);
});
