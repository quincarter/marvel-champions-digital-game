import { describe, expect, test } from "vitest";
import { choiceId, type GameState, type PendingChoice } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { chosenResourcesNoteOf, isPaymentSheet, paymentSheetView } from "./payment-sheet.js";

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

  test("a chosen-size cost says up to max is spent and never caps the selection", () => {
    const chosen: PendingChoice = {
      ...BASE,
      prompt: {
        kind: "payForAbility",
        instanceId: "i1" as never,
        abilityId: "a1" as never,
        cost: 0,
        chosenResources: { min: 1, max: 3, payingFor: "i1" as never },
      },
    };
    const view = paymentSheetView(STATE, chosen, [], POOL_DEPS);
    expect(view?.note).toBe("Pay 1 to 3. Up to 3 are spent; extra is overpaid.");
    expect(view?.confirmLabel).toBe("Pay 1 more");
    expect(chosenResourcesNoteOf(pay("payForAbility", 2).prompt)).toBeNull();
  });

  test("only payment prompts have a payment sheet", () => {
    const other: PendingChoice = { ...BASE, prompt: { kind: "chooseTarget", slot: "s", abilityId: null } };
    expect(isPaymentSheet(other)).toBe(false);
    expect(paymentSheetView(STATE, other, [], POOL_DEPS)).toBeNull();
  });
});
