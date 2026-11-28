import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cancelPressesWithin, HOLD_MS, onHold, onTap } from "./tap.js";

const rect = (left: number, top: number, right: number, bottom: number): DOMRect =>
  ({ left, top, right, bottom, width: right - left, height: bottom - top, x: left, y: top }) as DOMRect;

function fire(target: EventTarget, type: string, x: number, y: number): void {
  const event = new Event(type, { bubbles: true, composed: true }) as Event & Record<string, unknown>;
  Object.assign(event, { pointerId: 1, button: 0, clientX: x, clientY: y });
  target.dispatchEvent(event);
}

function setup(): { button: HTMLElement; scroller: HTMLElement; handler: ReturnType<typeof vi.fn>; stop: () => void } {
  const scroller = document.createElement("div");
  scroller.style.overflowY = "auto";
  scroller.style.overflowX = "hidden";
  const button = document.createElement("button");
  scroller.append(button);
  document.body.append(scroller);
  button.getBoundingClientRect = () => rect(0, 0, 100, 40);
  scroller.getBoundingClientRect = () => rect(0, 0, 100, 200);
  const handler = vi.fn();
  return { button, scroller, handler, stop: onTap(button, handler) };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("cancelPressesWithin", () => {
  it("disarms a tap armed inside the host (through a shadow root), so its release presses nothing", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const shadow = host.attachShadow({ mode: "open" });
    const button = document.createElement("button");
    shadow.append(button);
    button.getBoundingClientRect = () => rect(0, 0, 100, 40);
    const handler = vi.fn();
    onTap(button, handler);
    fire(button, "pointerdown", 50, 20);
    cancelPressesWithin(host);
    fire(button, "pointerup", 50, 20);
    expect(handler).not.toHaveBeenCalled();
    // A fresh press afterwards taps again.
    fire(button, "pointerdown", 50, 20);
    fire(button, "pointerup", 50, 20);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("leaves a press outside the host armed", () => {
    const { button, handler } = setup();
    const other = document.createElement("div");
    document.body.append(other);
    fire(button, "pointerdown", 50, 20);
    cancelPressesWithin(other);
    fire(button, "pointerup", 50, 20);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("onTap", () => {
  it("taps when the release is on the element", () => {
    const { button, handler } = setup();
    fire(button, "pointerdown", 50, 20);
    fire(button, "pointerup", 52, 22);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not tap when a captured release lands just outside the edge, within the slop", () => {
    const { button, handler } = setup();
    fire(button, "pointerdown", 97, 20);
    fire(button, "pointerup", 103, 20);
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not tap when the release is inside the element but outside its clipping scroller", () => {
    const { button, scroller, handler } = setup();
    scroller.getBoundingClientRect = () => rect(0, 0, 100, 30);
    fire(button, "pointerdown", 50, 25);
    fire(button, "pointerup", 50, 32);
    expect(handler).not.toHaveBeenCalled();
  });

  it("is disarmed by lostpointercapture", () => {
    const { button, handler } = setup();
    fire(button, "pointerdown", 50, 20);
    fire(button, "lostpointercapture", 50, 20);
    fire(button, "pointerup", 50, 20);
    expect(handler).not.toHaveBeenCalled();
  });

  it("is disarmed by pointercancel", () => {
    const { button, handler } = setup();
    fire(button, "pointerdown", 50, 20);
    fire(button, "pointercancel", 50, 20);
    fire(button, "pointerup", 50, 20);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("onTap on an element with no box", () => {
  it("still taps: a box it can't measure doesn't refuse the release", () => {
    const element = document.createElement("div");
    document.body.append(element);
    const handler = vi.fn();
    onTap(element, handler);
    fire(element, "pointerdown", 10, 10);
    fire(element, "pointerup", 10, 10);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

const pointer = (type: string, x = 10, y = 10): PointerEvent =>
  new PointerEvent(type, { bubbles: true, composed: true, clientX: x, clientY: y, pointerId: 1, button: 0 });

describe("onHold", () => {
  // A release must land on the element (onTap): give every element a box round the presses these tests make.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(rect(0, 0, 100, 100));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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

  it("is no hold when the mouse leaves the element and is released elsewhere before the timer fires", () => {
    const element = document.createElement("div");
    const held = vi.fn();
    onHold(element, held);
    element.dispatchEvent(pointer("pointerdown"));
    element.dispatchEvent(pointer("pointerleave"));
    document.body.dispatchEvent(pointer("pointerup", 300, 300));
    vi.advanceTimersByTime(HOLD_MS + 1);
    expect(held).not.toHaveBeenCalled();
    // Left and still held down past the timeout: still nothing.
    element.dispatchEvent(pointer("pointerdown"));
    element.dispatchEvent(pointer("pointerleave"));
    vi.advanceTimersByTime(HOLD_MS + 1);
    expect(held).not.toHaveBeenCalled();
  });

  it("is no hold when an ancestor scrolls under a pointer that never moves", () => {
    const list = document.createElement("div");
    const element = document.createElement("div");
    list.append(element);
    document.body.append(list);
    const held = vi.fn();
    onHold(element, held);
    element.dispatchEvent(pointer("pointerdown"));
    list.scrollTop = 40;
    vi.advanceTimersByTime(HOLD_MS + 1);
    expect(held).not.toHaveBeenCalled();
    // Nothing scrolled: still a hold.
    element.dispatchEvent(pointer("pointerdown"));
    vi.advanceTimersByTime(HOLD_MS + 1);
    expect(held).toHaveBeenCalledTimes(1);
    list.remove();
  });

  it("is no hold when the element loses pointer capture before the timer fires", () => {
    const element = document.createElement("div");
    const held = vi.fn();
    onHold(element, held);
    element.dispatchEvent(pointer("pointerdown"));
    element.dispatchEvent(pointer("lostpointercapture"));
    vi.advanceTimersByTime(HOLD_MS + 1);
    expect(held).not.toHaveBeenCalled();
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

  it("is no hold when a captured finger sits just outside the element's edge at the timer, within the slop", () => {
    const element = document.createElement("div");
    const held = vi.fn();
    onHold(element, held);
    element.dispatchEvent(pointer("pointerdown", 98, 50));
    element.dispatchEvent(pointer("pointermove", 105, 50));
    vi.advanceTimersByTime(HOLD_MS + 1);
    expect(held).not.toHaveBeenCalled();
    // Back inside at the timer: a hold.
    element.dispatchEvent(pointer("pointerdown", 98, 50));
    element.dispatchEvent(pointer("pointermove", 105, 50));
    element.dispatchEvent(pointer("pointermove", 99, 50));
    vi.advanceTimersByTime(HOLD_MS + 1);
    expect(held).toHaveBeenCalledTimes(1);
  });

  it("is no hold when a captured finger sits outside the scroll viewport that clips the element", () => {
    const scroller = document.createElement("div");
    scroller.style.overflowY = "auto";
    const element = document.createElement("div");
    scroller.append(element);
    document.body.append(scroller);
    element.getBoundingClientRect = () => rect(0, 0, 100, 100);
    scroller.getBoundingClientRect = () => rect(0, 0, 100, 60);
    const held = vi.fn();
    onHold(element, held);
    element.dispatchEvent(pointer("pointerdown", 50, 55));
    element.dispatchEvent(pointer("pointermove", 50, 64));
    vi.advanceTimersByTime(HOLD_MS + 1);
    expect(held).not.toHaveBeenCalled();
    // Still inside the viewport: a hold.
    element.dispatchEvent(pointer("pointerdown", 50, 55));
    vi.advanceTimersByTime(HOLD_MS + 1);
    expect(held).toHaveBeenCalledTimes(1);
  });

  it("holds an element with no measurable box", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(rect(0, 0, 0, 0));
    const element = document.createElement("div");
    const held = vi.fn();
    onHold(element, held);
    element.dispatchEvent(pointer("pointerdown", 50, 50));
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

describe("onActivate", () => {
  it("presses on a click with no pointer behind it (the focus route's click()), not on a pointer's own click", async () => {
    const { onActivate } = await import("./tap.js");
    const button = document.createElement("div");
    document.body.append(button);
    const handler = vi.fn();
    const stop = onActivate(button, handler);
    button.click();
    expect(handler).toHaveBeenCalledTimes(1);
    button.dispatchEvent(new MouseEvent("click", { detail: 1, bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    stop();
    button.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
