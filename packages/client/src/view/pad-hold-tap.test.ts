import { describe, expect, it } from "vitest";
import { createHoldTap } from "./pad-hold-tap.js";

describe("hold / tap split", () => {
  it("a quick release is a tap and never a hold", () => {
    const h = createHoldTap(400);
    h.press(1000);
    expect(h.poll(1200)).toBeNull();
    expect(h.release(1250)).toBe("tap");
    expect(h.poll(2000)).toBeNull();
  });

  it("a long press fires the hold once, and its release is not a tap", () => {
    const h = createHoldTap(400);
    h.press(1000);
    expect(h.poll(1399)).toBeNull();
    expect(h.poll(1400)).toBe("hold");
    expect(h.poll(1500)).toBeNull();
    expect(h.release(1600)).toBeNull();
  });

  it("a release with no press does nothing", () => {
    expect(createHoldTap().release(5)).toBeNull();
  });

  it("a release past the threshold that was never polled is not a tap", () => {
    const h = createHoldTap(400);
    h.press(0);
    expect(h.release(500)).toBeNull();
  });

  it("cancel forgets the press", () => {
    const h = createHoldTap(400);
    h.press(0);
    h.cancel();
    expect(h.release(100)).toBeNull();
  });
});
