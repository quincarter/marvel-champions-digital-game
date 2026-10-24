import { describe, expect, it } from "vitest";
import {
  PAD_REPEAT_EVERY_MS,
  PAD_REPEAT_FIRST_MS,
  SCROLL_DEADZONE,
  createPadRepeater,
  scrollDelta,
  scrollVector,
  stickDirection,
} from "./pad-repeat.js";

/** A repeater past its first frame: one that has seen nothing held, as after a scene has been up a moment. */
function fresh() {
  const r = createPadRepeater();
  r.update(null, -1, true);
  return r;
}

describe("createPadRepeater", () => {
  it("fires at once, waits the first delay, then repeats on the interval", () => {
    const r = fresh();
    expect(r.update("down", 0, true)).toBe("down");
    expect(r.update("down", PAD_REPEAT_FIRST_MS - 1, true)).toBeNull();
    expect(r.update("down", PAD_REPEAT_FIRST_MS, true)).toBe("down");
    expect(r.update("down", PAD_REPEAT_FIRST_MS + PAD_REPEAT_EVERY_MS - 1, true)).toBeNull();
    expect(r.update("down", PAD_REPEAT_FIRST_MS + PAD_REPEAT_EVERY_MS, true)).toBe("down");
  });

  it("restarts on release and on a change of direction", () => {
    const r = fresh();
    r.update("left", 0, true);
    expect(r.update(null, 100, true)).toBeNull();
    expect(r.update("left", 200, true)).toBe("left");
    expect(r.update("up", 300, true)).toBe("up");
    expect(r.update("up", 300 + PAD_REPEAT_FIRST_MS - 1, true)).toBeNull();
  });

  it("does not fire for a direction already held on the first frame, until it is released", () => {
    const r = createPadRepeater();
    expect(r.update("down", 0, true)).toBeNull();
    expect(r.update("down", 1000, true)).toBeNull();
    expect(r.update(null, 1100, true)).toBeNull();
    expect(r.update("down", 1200, true)).toBe("down");
  });

  it("fires once after a long frame, not once per missed interval", () => {
    const r = fresh();
    r.update("right", 0, true);
    expect(r.update("right", 2000, true)).toBe("right");
    expect(r.update("right", 2001, true)).toBeNull();
    expect(r.update("right", 2000 + PAD_REPEAT_EVERY_MS, true)).toBe("right");
  });

  it("never fires while blocked, and a press begun under the block does not repeat after it", () => {
    const r = fresh();
    expect(r.update("down", 0, false)).toBeNull();
    expect(r.update("down", 1000, true)).toBeNull();
    expect(r.update("down", 2000, true)).toBeNull();
    expect(r.update(null, 2100, true)).toBeNull();
    expect(r.update("down", 2200, true)).toBe("down");
  });

  it("treats a different direction pressed after the block lifts as a new press", () => {
    const r = fresh();
    r.update("down", 0, false);
    expect(r.update("left", 10, true)).toBe("left");
  });

  it("stops a repeat the moment the block starts", () => {
    const r = fresh();
    r.update("up", 0, true);
    expect(r.update("up", 500, false)).toBeNull();
    expect(r.update("up", 520, true)).toBeNull();
  });
});

describe("stickDirection", () => {
  it("is null inside the engage deadzone", () => {
    expect(stickDirection(0.49, 0, null)).toBeNull();
    expect(stickDirection(0, -0.3, null)).toBeNull();
  });

  it("reads the dominant axis", () => {
    expect(stickDirection(0.9, 0.2, null)).toBe("right");
    expect(stickDirection(-0.9, 0.2, null)).toBe("left");
    expect(stickDirection(0.1, -0.8, null)).toBe("up");
    expect(stickDirection(0.1, 0.8, null)).toBe("down");
  });

  it("stays engaged down to the release threshold, then lets go", () => {
    expect(stickDirection(0.4, 0, null)).toBeNull();
    expect(stickDirection(0.4, 0, "right")).toBe("right");
    expect(stickDirection(0.34, 0, "right")).toBeNull();
  });

  it("does not flip axes on a near-diagonal", () => {
    expect(stickDirection(0.7, 0.72, "right")).toBe("right");
    expect(stickDirection(0.7, 0.72, "down")).toBe("down");
    expect(stickDirection(0.4, 0.9, "right")).toBe("down");
  });
});

describe("right stick scroll", () => {
  it("is null in the deadzone and ramps from its edge", () => {
    expect(scrollVector(SCROLL_DEADZONE - 0.01, 0)).toBeNull();
    expect(scrollVector(1, 0)).toEqual({ x: 1, y: 0 });
    const half = scrollVector(0, 0.575);
    expect(half?.y).toBeGreaterThan(0.4);
    expect(half?.y).toBeLessThan(0.6);
  });

  it("scales the delta by frame time and keeps the sign", () => {
    const a = scrollDelta(0, -1, 16);
    const b = scrollDelta(0, -1, 32);
    expect(a?.dy).toBeLessThan(0);
    expect(b!.dy).toBeCloseTo(a!.dy * 2);
    expect(scrollDelta(0, 0, 16)).toBeNull();
  });
});
