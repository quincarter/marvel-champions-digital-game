/**
 * Prompt titles and why-not wording for wave 8's engine additions (docs/phase7-wave8.md): a card-instructed basic
 * power (§3.64), wild declarations (§3.62), the additional cost to change form (§3.63), a "ready" cost (§3.54), a
 * deck-discard cost's size (§3.55), and the exclusion codes those prompts surface.
 */

import { frameId, type ChoicePrompt, type GameState, type StackFrame } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { promptTitleOf } from "./choice-source.js";
import { basicReasonWording, exclusionWording } from "./highlights.js";
import { paymentSubjectWords } from "./change-form-choice.js";

const title = (prompt: unknown, counts?: Parameters<typeof promptTitleOf>[2], state?: GameState): string =>
  promptTitleOf(prompt as ChoicePrompt, POOL_DEPS, counts, state);

describe("card-instructed basic power", () => {
  test("which character and power", () => {
    expect(title({ kind: "chooseBasicPower", powers: ["attack"], sourceInstanceId: null })).toBe("Choose who attacks");
    expect(title({ kind: "chooseBasicPower", powers: ["thwart"], sourceInstanceId: null })).toBe("Choose who thwarts");
    expect(title({ kind: "chooseBasicPower", powers: ["attack", "thwart"], sourceInstanceId: null })).toBe(
      "Choose who attacks or thwarts",
    );
  });

  test("which target", () => {
    expect(title({ kind: "chooseBasicPowerTarget", power: "attack", characterInstanceId: "x" })).toBe(
      "Choose an enemy to attack",
    );
    expect(title({ kind: "chooseBasicPowerTarget", power: "thwart", characterInstanceId: "x" })).toBe(
      "Choose a scheme to thwart",
    );
  });
});

describe("wild declarations", () => {
  test("one wild, or several", () => {
    expect(title({ kind: "declareWildTypes", wilds: 1 })).toBe("Choose what your wild counts as");
    expect(title({ kind: "declareWildTypes", wilds: 2 })).toBe("Choose what your two wilds count as");
  });
});

describe("the additional cost to change form", () => {
  const spend = (requirement: object, formChangeCost: object) =>
    title({ kind: "spendResources", requirement, formChangeCost });

  test("same-type, mixed and plain costs read as a question about the destination form", () => {
    expect(spend({ generic: 2 }, { to: "hero", sourceInstanceIds: [], sameType: 2 })).toBe(
      "Spend 2 resources of the same type to change to hero form?",
    );
    expect(spend({ generic: 3 }, { to: "alterEgo", sourceInstanceIds: [], sameType: 2 })).toBe(
      "Spend 3 resources, 2 of one type, to change to alter-ego form?",
    );
    expect(spend({ generic: 1 }, { to: "hero", sourceInstanceIds: [] })).toBe(
      "Spend 1 resource to change to hero form?",
    );
    expect(spend({}, { to: "hero", sourceInstanceIds: [] })).toBe("Pay to change to hero form?");
  });

  test("an ordinary spend keeps its own title", () => {
    expect(title({ kind: "spendResources", requirement: { generic: 2 } })).toBe("Spend 2 resources?");
  });
});

describe("ready cost", () => {
  test("chooseCostCards in ready mode asks for a card to ready", () => {
    expect(title({ kind: "chooseCostCards", instanceId: "c", abilityId: "a", slot: "s", mode: "ready" })).toBe(
      "Choose a card to ready",
    );
  });
});

describe("deck-discard cost size", () => {
  const frame = (effects: readonly { kind: string }[], cursor: number): StackFrame =>
    ({ kind: "effects", frameId: frameId("f9"), effects, cursor }) as unknown as StackFrame;
  const stateWith = (...frames: StackFrame[]): GameState => ({ stack: frames }) as unknown as GameState;
  const choice = { minSelections: 1, frameId: frameId("f9") };

  test("a chooseNumber followed by payDeckDiscardChoice is the size of the discard", () => {
    const state = stateWith(frame([{ kind: "chooseNumber" }, { kind: "payDeckDiscardChoice" }], 0));
    expect(title({ kind: "chooseNumber", min: 1, max: 3 }, choice, state)).toBe("Discard up to 3 cards from your deck");
    expect(title({ kind: "chooseNumber", min: 2, max: 4 }, choice, state)).toBe("Discard 2 to 4 cards from your deck");
    expect(title({ kind: "chooseNumber", min: 1, max: 1 }, choice, state)).toBe("Discard up to 1 card from your deck");
  });

  test("any other chooseNumber keeps the generic title", () => {
    const state = stateWith(frame([{ kind: "chooseNumber" }, { kind: "draw" }], 0));
    expect(title({ kind: "chooseNumber", min: 1, max: 3 }, choice, state)).toBe("Choose a number from 1 to 3");
    expect(title({ kind: "chooseNumber", min: 1, max: 3 })).toBe("Choose a number from 1 to 3");
  });
});

describe("why-not wording", () => {
  test("a guarded villain, a missing ability and a refused host each get their own words", () => {
    expect(exclusionWording("cannotBeAttacked")).toBe("can't be attacked right now");
    expect(exclusionWording("noSuchAbility")).toBe("has no such ability");
    expect(exclusionWording("cannotAttachTo")).toBe("can't be attached there");
  });

  test("a change of form short of its extra cost says so in a few words", () => {
    expect(
      basicReasonWording(
        "changeForm",
        "insufficient_resources",
        "changing to hero form has an additional cost: Card (2 resources of the same type): need 2, paid 0",
      ),
    ).toBe("can't pay the extra cost to change form");
    expect(basicReasonWording("changeForm", "wrong_form", "already in hero form")).toBe("already in hero form");
    expect(basicReasonWording("attack", "insufficient_resources", "nope")).toBe("nope");
    expect(basicReasonWording("endTurn", null, null)).toBe("not available right now");
  });

  test("the payment bar names a change of form", () => {
    expect(paymentSubjectWords({ kind: "changeForm" })).toBe("Change form");
    expect(paymentSubjectWords({ kind: "changeForm", to: "alterEgo" })).toBe("Change to alter-ego");
    expect(paymentSubjectWords({ kind: "basicRecover" })).toBe("This action");
  });
});
