import { describe, expect, test } from "vitest";
import { choiceId, type GameState, type PendingChoice } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { isPaymentSheet, paymentSheetView } from "./payment-sheet.js";

const STATE = { players: [], instances: {}, stack: [] } as unknown as GameState;
const BASE = {
  choiceId: choiceId("c1"),
  playerId: "p1" as never,
  minSelections: 0,
  maxSelections: 0,
  options: [],
  frameId: null,
  ordered: false,
  soleDecider: false,
  authority: "player",
} as const;
const pay = (kind: "payForCard" | "payForAbility", cost: number): PendingChoice => ({
  ...BASE,
  prompt: { kind, instanceId: "i1" as never, abilityId: "a1" as never, cost },
});

describe("paymentSheetView", () => {
  test("nothing picked: Confirm is off and says what is missing; declining is its own, named control", () => {
    const view = paymentSheetView(STATE, pay("payForAbility", 2), [], POOL_DEPS);
    expect(view).toMatchObject({ canConfirm: false, confirmLabel: "Pay 2 more", declineLabel: "Don't use it" });
  });

  test("a card in a window says 'Don't play it'", () => {
    expect(paymentSheetView(STATE, pay("payForCard", 1), [], POOL_DEPS)?.declineLabel).toBe("Don't play it");
  });

  test("a selection the engine rejects never enables Confirm", () => {
    expect(paymentSheetView(STATE, pay("payForAbility", 1), ["hand:x"], POOL_DEPS)?.canConfirm).toBe(false);
  });

  test("only payment prompts have a payment sheet", () => {
    const other: PendingChoice = { ...BASE, prompt: { kind: "chooseTarget", slot: "s", abilityId: null } };
    expect(isPaymentSheet(other)).toBe(false);
    expect(paymentSheetView(STATE, other, [], POOL_DEPS)).toBeNull();
  });
});
