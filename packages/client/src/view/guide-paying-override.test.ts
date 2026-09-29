import { describe, expect, test } from "vitest";
import { abilityId, cardId } from "@mc/content";
import type { LessonPayer, LessonStep } from "./lesson-model.js";
import { payingOverrideFor, type PayingOverrideSnapshot, type ResolvedPayer } from "./guide-paying-override.js";

const SUBJECT = cardId("01002"); // Black Cat, standing in for any signature card
const PAYER_CARD = cardId("01088"); // Energy, standing in for any single-card payer
const SUBJECT_INSTANCE = "instance:subject";
const PAYER_INSTANCE = "instance:payer";

const ONE_PAYER: LessonPayer = { kind: "handCard", code: PAYER_CARD, doThis: "Tap Energy, then Pay" };
const ONE_PAYER_OPTION_ID = `hand:${PAYER_INSTANCE}`;

function resolved(payer: LessonPayer, instanceId: string | null): readonly ResolvedPayer[] {
  return [{ payer, instanceId }];
}

const STEP_WITH_PAY_WITH: LessonStep = {
  id: "play-signature",
  anchor: { kind: "card", code: SUBJECT },
  copy: {
    title: "Play it",
    body: "…",
    doThis: "Tap it to play it",
    doThisTabbed: "Tap it, then Play",
    payWith: [ONE_PAYER],
  },
  mode: "await",
};

const STEP_WITHOUT_PAY_WITH: LessonStep = {
  id: "play-two-card-cost",
  anchor: { kind: "card", code: SUBJECT },
  copy: { title: "Play it", body: "…", doThis: "Play it" },
  mode: "await",
};

describe("payingOverrideFor", () => {
  test("null with no step, no anchor, a non-card anchor, or no payWith — nothing to walk", () => {
    expect(payingOverrideFor(null, SUBJECT_INSTANCE, resolved(ONE_PAYER, PAYER_INSTANCE), null, false)).toBeNull();
    expect(payingOverrideFor(STEP_WITHOUT_PAY_WITH, SUBJECT_INSTANCE, [], null, false)).toBeNull();
    const zoneAnchorStep: LessonStep = {
      ...STEP_WITH_PAY_WITH,
      anchor: { kind: "zone", id: "villain" },
    };
    expect(
      payingOverrideFor(zoneAnchorStep, SUBJECT_INSTANCE, resolved(ONE_PAYER, PAYER_INSTANCE), null, false),
    ).toBeNull();
  });

  test("before the signature card is the payment subject: no override on desktop", () => {
    expect(
      payingOverrideFor(STEP_WITH_PAY_WITH, SUBJECT_INSTANCE, resolved(ONE_PAYER, PAYER_INSTANCE), null, false),
    ).toBeNull();
    expect(
      payingOverrideFor(
        STEP_WITH_PAY_WITH,
        SUBJECT_INSTANCE,
        resolved(ONE_PAYER, PAYER_INSTANCE),
        { subject: "instance:someone-else", spentOptionIds: [] },
        false,
      ),
    ).toBeNull();
  });

  test("before the signature card is the payment subject: doThisTabbed on a tabbed layout", () => {
    expect(
      payingOverrideFor(STEP_WITH_PAY_WITH, SUBJECT_INSTANCE, resolved(ONE_PAYER, PAYER_INSTANCE), null, true),
    ).toEqual({ doThis: "Tap it, then Play" });
  });

  test("no doThisTabbed set: still null on a tabbed layout before the card is the subject", () => {
    const { doThisTabbed: _unused, ...copyWithoutTabbed } = STEP_WITH_PAY_WITH.copy;
    const noTabbedCopy: LessonStep = { ...STEP_WITH_PAY_WITH, copy: copyWithoutTabbed };
    expect(
      payingOverrideFor(noTabbedCopy, SUBJECT_INSTANCE, resolved(ONE_PAYER, PAYER_INSTANCE), null, true),
    ).toBeNull();
  });

  test("the signature card is the subject, nothing paid: TRY THIS moves to the payer card", () => {
    const payment: PayingOverrideSnapshot = { subject: SUBJECT_INSTANCE, spentOptionIds: [] };
    expect(
      payingOverrideFor(STEP_WITH_PAY_WITH, SUBJECT_INSTANCE, resolved(ONE_PAYER, PAYER_INSTANCE), payment, false),
    ).toEqual({ anchor: { kind: "card", code: PAYER_CARD }, doThis: "Tap Energy, then Pay" });
  });

  test("the payer card isn't resolvable in this game: leaves the step's copy alone", () => {
    const payment: PayingOverrideSnapshot = { subject: SUBJECT_INSTANCE, spentOptionIds: [] };
    expect(
      payingOverrideFor(STEP_WITH_PAY_WITH, SUBJECT_INSTANCE, resolved(ONE_PAYER, null), payment, false),
    ).toBeNull();
  });

  test("the payer's own option id is already spent: TRY THIS moves to Pay", () => {
    const payment: PayingOverrideSnapshot = { subject: SUBJECT_INSTANCE, spentOptionIds: [ONE_PAYER_OPTION_ID] };
    expect(
      payingOverrideFor(STEP_WITH_PAY_WITH, SUBJECT_INSTANCE, resolved(ONE_PAYER, PAYER_INSTANCE), payment, false),
    ).toEqual({ anchor: { kind: "control", id: "payment:pay" }, doThis: "Tap Pay" });
  });

  test("two payers: rings the first not-yet-spent one, then the second, then Pay", () => {
    const first: LessonPayer = {
      kind: "identityAbility",
      abilityId: abilityId("01001b.scientist"),
      doThis: "Tap Scientist",
    };
    const firstInstance = "instance:identity";
    const second = ONE_PAYER;
    const secondInstance = PAYER_INSTANCE;
    const payers = [
      { payer: first, instanceId: firstInstance },
      { payer: second, instanceId: secondInstance },
    ];

    const notPaid: PayingOverrideSnapshot = { subject: SUBJECT_INSTANCE, spentOptionIds: [] };
    expect(payingOverrideFor(STEP_WITH_PAY_WITH, SUBJECT_INSTANCE, payers, notPaid, false)).toEqual({
      anchor: { kind: "control", id: `card:${firstInstance}` },
      doThis: "Tap Scientist",
    });

    const firstSpent: PayingOverrideSnapshot = {
      subject: SUBJECT_INSTANCE,
      spentOptionIds: [`ability:${firstInstance}:01001b.scientist`],
    };
    expect(payingOverrideFor(STEP_WITH_PAY_WITH, SUBJECT_INSTANCE, payers, firstSpent, false)).toEqual({
      anchor: { kind: "card", code: PAYER_CARD },
      doThis: "Tap Energy, then Pay",
    });

    const bothSpent: PayingOverrideSnapshot = {
      subject: SUBJECT_INSTANCE,
      spentOptionIds: [`ability:${firstInstance}:01001b.scientist`, `hand:${secondInstance}`],
    };
    expect(payingOverrideFor(STEP_WITH_PAY_WITH, SUBJECT_INSTANCE, payers, bothSpent, false)).toEqual({
      anchor: { kind: "control", id: "payment:pay" },
      doThis: "Tap Pay",
    });
  });
});
