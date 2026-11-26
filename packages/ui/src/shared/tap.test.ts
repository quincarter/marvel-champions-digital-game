import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOLD_MS, onHold, onTap } from "./tap.js";

const pointer = (type: string, x = 10, y = 10): PointerEvent =>
  new PointerEvent(type, { bubbles: true, composed: true, clientX: x, clientY: y, pointerId: 1, button: 0 });

describe("onHold", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires after the press has lasted, and the release that ends it is not a tap", () => {
    const element = document.createElement("div");
    const held = vi.fn();
    const tapped = vi.fn();
    onHold(element, held);
    onTap(element, tapped);
    element.dispatchEvent(pointer("pointerdown"));
    vi.advanceTimersByTime(HOLD_MS + 1);
    expect(held).toHaveBeenCalledTimes(1);
    element.dispatchEvent(pointer("pointerup"));
    expect(tapped).not.toHaveBeenCalled();
  });

  it("never taps on the release of a hold, however long the press lasts after the hold fires", () => {
    const element = document.createElement("div");
    const held = vi.fn();
    const tapped = vi.fn();
    onHold(element, held);
    onTap(element, tapped);
    element.dispatchEvent(pointer("pointerdown"));
    vi.advanceTimersByTime(HOLD_MS + 5000);
    element.dispatchEvent(pointer("pointerup"));
    expect(held).toHaveBeenCalledTimes(1);
    expect(tapped).not.toHaveBeenCalled();
    // The next press is its own: a quick one taps.
    element.dispatchEvent(pointer("pointerdown"));
    element.dispatchEvent(pointer("pointerup"));
    expect(tapped).toHaveBeenCalledTimes(1);
  });

  it("holds when a rolling fingertip wandered and came back before the timer fired", () => {
    const element = document.createElement("div");
    const held = vi.fn();
    onHold(element, held);
    element.dispatchEvent(pointer("pointerdown"));
    element.dispatchEvent(pointer("pointermove", 10, 60));
    element.dispatchEvent(pointer("pointermove", 12, 12));
    vi.advanceTimersByTime(HOLD_MS + 1);
    expect(held).toHaveBeenCalledTimes(1);
  });

  it("leaves a quick press to the tap", () => {
    const element = document.createElement("div");
    const held = vi.fn();
    const tapped = vi.fn();
    onHold(element, held);
    onTap(element, tapped);
    element.dispatchEvent(pointer("pointerdown"));
    vi.advanceTimersByTime(HOLD_MS - 50);
    element.dispatchEvent(pointer("pointerup"));
    vi.advanceTimersByTime(HOLD_MS);
    expect(held).not.toHaveBeenCalled();
    expect(tapped).toHaveBeenCalledTimes(1);
  });

  it("is no hold when the press is away from where it began when the timer fires (a scroll)", () => {
    const element = document.createElement("div");
    const held = vi.fn();
    onHold(element, held);
    element.dispatchEvent(pointer("pointerdown"));
    element.dispatchEvent(pointer("pointermove", 10, 60));
    vi.advanceTimersByTime(HOLD_MS + 1);
    expect(held).not.toHaveBeenCalled();
  });

  it("answers a right-click, and stops listening when told", () => {
    const element = document.createElement("div");
    const held = vi.fn();
    const stop = onHold(element, held);
    const menu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    element.dispatchEvent(menu);
    expect(held).toHaveBeenCalledTimes(1);
    expect(menu.defaultPrevented).toBe(true);
    stop();
    element.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    expect(held).toHaveBeenCalledTimes(1);
  });
});
