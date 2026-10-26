import { describe, expect, it } from "vitest";
import { activationTarget, primaryGlyphShown } from "./primary-activation.js";

describe("activationTarget", () => {
  it("presses the focused control when there is one", () => {
    expect(activationTarget("option:a", "confirm", true)).toBe("option:a");
    expect(activationTarget("decline", "confirm", false)).toBe("decline");
  });

  it("presses the primary when nothing is focused and it is enabled", () => {
    expect(activationTarget(null, "confirm", true)).toBe("confirm");
  });

  it("presses nothing when nothing is focused and the primary is not ready or there is none", () => {
    expect(activationTarget(null, "confirm", false)).toBeNull();
    expect(activationTarget(null, null, true)).toBeNull();
  });
});

describe("primaryGlyphShown", () => {
  it("shows while focus is null or on the primary, and the primary is enabled", () => {
    expect(primaryGlyphShown(null, "confirm", true)).toBe(true);
    expect(primaryGlyphShown("confirm", "confirm", true)).toBe(true);
  });

  it("hides when another control has focus, or the primary is disabled", () => {
    expect(primaryGlyphShown("decline", "confirm", true)).toBe(false);
    expect(primaryGlyphShown(null, "confirm", false)).toBe(false);
    expect(primaryGlyphShown("confirm", "confirm", false)).toBe(false);
    expect(primaryGlyphShown(null, null, true)).toBe(false);
  });
});
