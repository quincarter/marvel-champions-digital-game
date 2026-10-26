import { describe, expect, it } from "vitest";
import { createBumperHold } from "./pick-bumper.js";

describe("bumper held as a pick modifier", () => {
  it("a quick tap alone fires its own meaning on release", () => {
    const hold = createBumperHold();
    expect(hold.press(0, 5, "rb", 0)).toBe("held");
    expect(hold.held()).toBe("rb");
    expect(hold.release(0, 5, 100, true)).toEqual({ released: true, tap: true });
    expect(hold.held()).toBeNull();
  });

  it("a face button under it picks and the release does not fire", () => {
    const hold = createBumperHold();
    hold.press(0, 5, "rb", 0);
    expect(hold.face()).toBe("rb");
    expect(hold.release(0, 5, 300, true)).toEqual({ released: true, tap: false });
  });

  it("a face button with no bumper held is not a combo", () => {
    expect(createBumperHold().face()).toBeNull();
  });

  it("swallows a second bumper and ignores its release", () => {
    const hold = createBumperHold();
    hold.press(0, 5, "rb", 0);
    expect(hold.press(0, 4, "lb", 10)).toBe("swallowed");
    expect(hold.release(0, 4, 20, true)).toEqual({ released: false, tap: false });
    expect(hold.held()).toBe("rb");
  });

  it("a trigger combo made while it is held marks it used", () => {
    const hold = createBumperHold();
    hold.press(0, 5, "rb", 0);
    hold.markUsed();
    expect(hold.release(0, 5, 50, true).tap).toBe(false);
  });

  it("a long hold fires only while the pick is still open", () => {
    const open = createBumperHold();
    open.press(0, 5, "rb", 0);
    expect(open.release(0, 5, 5000, true).tap).toBe(true);
    const closed = createBumperHold();
    closed.press(0, 5, "rb", 0);
    expect(closed.release(0, 5, 5000, false).tap).toBe(false);
    const quick = createBumperHold();
    quick.press(0, 5, "rb", 0);
    expect(quick.release(0, 5, 100, false).tap).toBe(true);
  });

  it("is dropped when input is blocked, and another pad's release does nothing", () => {
    const hold = createBumperHold();
    hold.press(0, 5, "rb", 0);
    expect(hold.release(1, 5, 10, true).released).toBe(false);
    expect(hold.cancel()).toBe(true);
    expect(hold.release(0, 5, 20, true)).toEqual({ released: false, tap: false });
    expect(hold.cancel()).toBe(false);
  });
});
