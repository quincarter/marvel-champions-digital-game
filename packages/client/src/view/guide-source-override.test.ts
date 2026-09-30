import { describe, expect, test } from "vitest";
import { cardId } from "@mc/content";
import type { LessonStep } from "./lesson-model.js";
import { sourceFocusKey, sourceOverrideFor } from "./guide-source-override.js";

const CAT = "instance:cat";
const HERO = "instance:hero";

const STEP: LessonStep = {
  id: "attack-with-black-cat",
  anchor: { kind: "action", id: "attack" },
  copy: {
    title: "Attack Rhino",
    body: "…",
    doThis: "Press Attack",
    pickSource: { code: cardId("01002"), doThis: "Pick Black Cat" },
  },
  mode: "await",
};

describe("sourceOverrideFor", () => {
  test("rings the suggested character's picker button while the picker lists it", () => {
    expect(sourceOverrideFor(STEP, CAT, [HERO, CAT])).toEqual({
      anchor: { kind: "control", id: sourceFocusKey(CAT) },
      doThis: "Pick Black Cat",
    });
  });

  test("leaves the step alone while the picker is closed", () => {
    expect(sourceOverrideFor(STEP, CAT, null)).toBeNull();
  });

  test("leaves the step alone when the picker doesn't offer the suggestion", () => {
    expect(sourceOverrideFor(STEP, CAT, [HERO, "instance:other"])).toBeNull();
    expect(sourceOverrideFor(STEP, null, [HERO, CAT])).toBeNull();
  });

  test("a step with no pickSource never overrides", () => {
    const { pickSource: _, ...copy } = STEP.copy;
    expect(sourceOverrideFor({ ...STEP, copy }, CAT, [HERO, CAT])).toBeNull();
    expect(sourceOverrideFor(null, CAT, [HERO, CAT])).toBeNull();
  });
});
