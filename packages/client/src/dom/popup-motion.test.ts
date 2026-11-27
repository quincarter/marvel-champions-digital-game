import { describe, expect, it } from "vitest";
import { slideDistance, swipeOutcome } from "./popup-motion.js";

describe("slideDistance", () => {
  it("brings the box's top from the screen's bottom edge", () => {
    expect(slideDistance(800, 300)).toBe(500);
  });
  it("falls back to the screen's height when the box is unknown", () => {
    expect(slideDistance(800, null)).toBe(800);
  });
  it("never reaches zero", () => {
    expect(slideDistance(800, 900)).toBe(1);
  });
});

describe("swipeOutcome", () => {
  const base = { boxHeight: 200, velocity: 0, canDismiss: true };
  it("dismisses past a quarter of the box's height", () => {
    expect(swipeOutcome({ ...base, dy: 50 })).toBe("dismiss");
  });
  it("springs back short of it", () => {
    expect(swipeOutcome({ ...base, dy: 49 })).toBe("snap");
  });
  it("dismisses a fast flick over a short distance", () => {
    expect(swipeOutcome({ ...base, dy: 30, velocity: 1 })).toBe("dismiss");
  });
  it("does not take a fast twitch for a flick", () => {
    expect(swipeOutcome({ ...base, dy: 10, velocity: 2 })).toBe("snap");
  });
  it("never dismisses an upward drag", () => {
    expect(swipeOutcome({ ...base, dy: -100, velocity: 2 })).toBe("snap");
  });
  it("springs back when the pop-up has no way out", () => {
    expect(swipeOutcome({ ...base, dy: 190, velocity: 2, canDismiss: false })).toBe("snap");
  });
});
