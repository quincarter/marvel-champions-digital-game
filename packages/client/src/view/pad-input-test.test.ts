import { describe, expect, it } from "vitest";
import { padInputNow, padInputTestLine, type RawPad } from "./pad-input-test.js";

const raw = (pressed: number[], axes: number[] = [0, 0, 0, 0]): RawPad => ({
  connected: true,
  mapping: "standard",
  buttons: [0, 1, 2, 3].map((index) => ({ pressed: pressed.includes(index) })),
  axes,
});

describe("padInputNow", () => {
  it("names the pressed buttons and pushed axes of the first connected pad", () => {
    expect(padInputNow([null, raw([0, 3], [0, -0.9, 0, 0])])).toBe("button 0, button 3, axis 1");
  });
  it("is null with nothing pressed, a stick inside the deadzone, or no pad", () => {
    expect(padInputNow([raw([], [0.2, 0, 0, 0])])).toBeNull();
    expect(padInputNow([null])).toBeNull();
  });
});

describe("padInputTestLine", () => {
  it("asks for a press until one is seen, then keeps the last one", () => {
    expect(padInputTestLine(null, "standard")).toBe("Press a button to test it");
    expect(padInputTestLine("button 0", "standard")).toBe("Last input: button 0");
  });
  it("says when the pad's layout is not the standard one", () => {
    expect(padInputTestLine("button 2", "")).toBe('Last input: button 2 · layout "" is not standard');
  });
});
