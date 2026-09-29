import { describe, expect, test } from "vitest";
import { cardId } from "@mc/content";
import type { LessonStep } from "./lesson-model.js";
import { payingOverrideFor } from "./guide-paying-override.js";

const SUBJECT = cardId("01002"); // Black Cat, standing in for any signature card
const PAYER = cardId("01088"); // Energy, standing in for any single-card payer
const SUBJECT_INSTANCE = "instance:subject";
const PAYER_INSTANCE = "instance:payer";

const STEP_WITH_PAY_WITH: LessonStep = {
  id: "play-signature",
  anchor: { kind: "card", code: SUBJECT },
  copy: {
    title: "Play it",
    body: "…",
    doThis: "Tap it to play it",
    doThisTabbed: "Tap it, then Play",
    payWith: PAYER,
    payWithDoThis: "Tap Energy, then Pay",
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
    expect(payingOverrideFor(null, SUBJECT_INSTANCE, PAYER_INSTANCE, null, false)).toBeNull();
    expect(payingOverrideFor(STEP_WITHOUT_PAY_WITH, SUBJECT_INSTANCE, PAYER_INSTANCE, null, false)).toBeNull();
    const zoneAnchorStep: LessonStep = {
      ...STEP_WITH_PAY_WITH,
      anchor: { kind: "zone", id: "villain" },
    };
    expect(payingOverrideFor(zoneAnchorStep, SUBJECT_INSTANCE, PAYER_INSTANCE, null, false)).toBeNull();
  });

  test("before the signature card is the payment subject: no override on desktop", () => {
    expect(payingOverrideFor(STEP_WITH_PAY_WITH, SUBJECT_INSTANCE, PAYER_INSTANCE, null, false)).toBeNull();
    expect(
      payingOverrideFor(
        STEP_WITH_PAY_WITH,
        SUBJECT_INSTANCE,
        PAYER_INSTANCE,
        { subject: "instance:someone-else", paid: 0 },
        false,
      ),
    ).toBeNull();
  });

  test("before the signature card is the payment subject: doThisTabbed on a tabbed layout", () => {
    expect(payingOverrideFor(STEP_WITH_PAY_WITH, SUBJECT_INSTANCE, PAYER_INSTANCE, null, true)).toEqual({
      doThis: "Tap it, then Play",
    });
  });

  test("no doThisTabbed set: still null on a tabbed layout before the card is the subject", () => {
    const { doThisTabbed: _unused, ...copyWithoutTabbed } = STEP_WITH_PAY_WITH.copy;
    const noTabbedCopy: LessonStep = { ...STEP_WITH_PAY_WITH, copy: copyWithoutTabbed };
    expect(payingOverrideFor(noTabbedCopy, SUBJECT_INSTANCE, PAYER_INSTANCE, null, true)).toBeNull();
  });

  test("the signature card is the subject, nothing paid: TRY THIS moves to the payer card", () => {
    expect(
      payingOverrideFor(
        STEP_WITH_PAY_WITH,
        SUBJECT_INSTANCE,
        PAYER_INSTANCE,
        { subject: SUBJECT_INSTANCE, paid: 0 },
        false,
      ),
    ).toEqual({ anchor: { kind: "card", code: PAYER }, doThis: "Tap Energy, then Pay" });
  });

  test("the payer card isn't resolvable in this game: leaves the step's copy alone", () => {
    expect(
      payingOverrideFor(STEP_WITH_PAY_WITH, SUBJECT_INSTANCE, null, { subject: SUBJECT_INSTANCE, paid: 0 }, false),
    ).toBeNull();
  });

  test("something's been paid: TRY THIS moves to Pay, whatever the payer card is", () => {
    expect(
      payingOverrideFor(
        STEP_WITH_PAY_WITH,
        SUBJECT_INSTANCE,
        PAYER_INSTANCE,
        { subject: SUBJECT_INSTANCE, paid: 2 },
        false,
      ),
    ).toEqual({ anchor: { kind: "control", id: "payment:pay" }, doThis: "Tap Pay" });
  });
});
