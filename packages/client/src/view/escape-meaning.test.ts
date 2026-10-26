import { describe, expect, it } from "vitest";
import { escapeMeaning, type EscapeState } from "./escape-meaning.js";

const idle: EscapeState = {
  guideGateOpen: false,
  guideStepActive: false,
  logFocused: false,
  tipShown: false,
  selectionIdle: true,
};

describe("escapeMeaning", () => {
  it("opens Pause on an idle board", () => {
    expect(escapeMeaning(idle)).toBe("pause");
  });

  it.each([
    ["a guide gate", { guideGateOpen: true }],
    ["a guide step", { guideStepActive: true }],
    ["log focus", { logFocused: true }],
    ["a tip toast", { tipShown: true }],
    ["a selection in progress", { selectionIdle: false }],
  ] as const)("backs out of %s first", (_name, patch) => {
    expect(escapeMeaning({ ...idle, ...patch })).toBe("back");
  });
});
