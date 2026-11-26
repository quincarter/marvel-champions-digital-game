import { afterEach, describe, expect, it, vi } from "vitest";
import { onTap } from "./tap";

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
