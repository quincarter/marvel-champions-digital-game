import { describe, expect, it } from "vitest";
import { maskHeld, stillHeld, type LivePad } from "./gamepad-live.js";

const down = { value: 1, pressed: true };
const up = { value: 0, pressed: false };
const pad = (buttons: LivePad["buttons"]): LivePad => ({ buttons, axes: [0, 0], timestamp: 5 });

describe("stillHeld", () => {
  it("starts with every button down on the first update", () => {
    expect([...stillHeld(null, [down, up, down])]).toEqual([0, 2]);
  });
  it("drops a button once it is released, and never takes a new press in", () => {
    const first = stillHeld(null, [down, up]);
    const second = stillHeld(first, [up, down]);
    expect([...second]).toEqual([]);
    expect([...stillHeld(second, [down, down])]).toEqual([]);
  });
});

describe("maskHeld", () => {
  it("reads held buttons as up and leaves the rest", () => {
    const masked = maskHeld(pad([down, down]), new Set([0]));
    expect(masked.buttons).toEqual([up, down]);
    expect(masked.axes).toEqual([0, 0]);
  });
  it("hands the pad back unchanged when nothing is held", () => {
    const live = pad([down]);
    expect(maskHeld(live, new Set())).toBe(live);
  });
});
