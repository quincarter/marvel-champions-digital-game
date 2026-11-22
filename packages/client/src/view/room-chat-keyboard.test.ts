import { describe, expect, it } from "vitest";
import { chatRectAboveKeyboard, coveredBottom, coveredHeight, KEYBOARD_MIN_PX } from "./room-chat-keyboard.js";

describe("coveredBottom", () => {
  it("is the strip the visual viewport leaves uncovered at the bottom", () => {
    expect(coveredBottom({ layoutHeight: 667, visibleHeight: 400, offsetTop: 0 })).toBe(267);
  });

  it("is 0 with no keyboard, with browser chrome sliding, and when the page itself was scrolled up to the field", () => {
    expect(coveredBottom({ layoutHeight: 667, visibleHeight: 667, offsetTop: 0 })).toBe(0);
    expect(coveredBottom({ layoutHeight: 667, visibleHeight: 667 - (KEYBOARD_MIN_PX - 1), offsetTop: 0 })).toBe(0);
    expect(coveredBottom({ layoutHeight: 667, visibleHeight: 400, offsetTop: 267 })).toBe(0);
  });
});

describe("coveredHeight", () => {
  const shrunk = { layoutHeight: 667, visibleHeight: 400, offsetTop: 0 };
  const whole = { layoutHeight: 667, visibleHeight: 667, offsetTop: 0 };
  it("reads the visual viewport on the web and iOS, where the app reports nothing", () => {
    expect(coveredHeight({ native: null, viewport: shrunk })).toBe(267);
    expect(coveredHeight({ native: null, viewport: null })).toBe(0);
  });
  it("trusts the Android app's keyboard height when it has reported, even with a viewport that never shrinks", () => {
    expect(coveredHeight({ native: 310.4, viewport: whole })).toBe(310);
    expect(coveredHeight({ native: 0, viewport: shrunk })).toBe(0);
    expect(coveredHeight({ native: KEYBOARD_MIN_PX - 1, viewport: whole })).toBe(0);
  });
});

describe("chatRectAboveKeyboard", () => {
  it("runs from the top to just above the keyboard, so the field is on screen", () => {
    const rect = chatRectAboveKeyboard({ top: 100, x: 8, width: 359, layoutHeight: 667, covered: 267 });
    expect(rect).toEqual({ x: 8, y: 100, width: 359, height: 667 - 267 - 4 - 100 });
    expect(rect.y + rect.height).toBeLessThan(667 - 267);
  });

  it("never has a negative height when almost nothing is visible", () => {
    expect(chatRectAboveKeyboard({ top: 300, x: 0, width: 300, layoutHeight: 400, covered: 250 }).height).toBe(0);
  });

  it("leaves a usable chat on an iPhone SE with the keyboard up", () => {
    // 375x667, keyboard about 260 px: the top bar and the tab strip take about 100.
    expect(
      chatRectAboveKeyboard({ top: 100, x: 8, width: 359, layoutHeight: 667, covered: 260 }).height,
    ).toBeGreaterThan(150);
  });
});
