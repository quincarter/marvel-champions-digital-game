import { describe, expect, it } from "vitest";
import { createInspectHold, zoomPlacement, zoomCardOf, ZOOM_HOLD_MS } from "./inspect-hold.js";

describe("inspect hold", () => {
  it("a quick release is an Inspect", () => {
    const h = createInspectHold();
    expect(h.press("pad", 0)).toBe(true);
    expect(h.poll(100)).toBeNull();
    expect(h.release("pad", 150)).toBe("inspect");
  });

  it("a hold zooms once, and its release closes without Inspect", () => {
    const h = createInspectHold();
    h.press("key", 0);
    expect(h.poll(ZOOM_HOLD_MS)).toBe("zoom");
    expect(h.zooming).toBe(true);
    expect(h.poll(ZOOM_HOLD_MS + 50)).toBeNull();
    expect(h.release("key", 900)).toBe("close");
    expect(h.zooming).toBe(false);
  });

  it("a release after the hold with no poll in between still does not Inspect", () => {
    const h = createInspectHold();
    h.press("pad", 0);
    expect(h.release("pad", 800)).toBeNull();
  });

  it("key repeat while held neither restarts the hold nor reopens Inspect", () => {
    const h = createInspectHold();
    expect(h.press("key", 0)).toBe(true);
    expect(h.press("key", 40)).toBe(false);
    expect(h.press("key", 80)).toBe(false);
    expect(h.poll(ZOOM_HOLD_MS)).toBe("zoom");
    expect(h.press("key", 400)).toBe(false);
    expect(h.release("key", 500)).toBe("close");
  });

  it("the first input owns the hold: the other's press and release are ignored", () => {
    const h = createInspectHold();
    h.press("pad", 0);
    expect(h.press("key", 10)).toBe(false);
    expect(h.release("key", 20)).toBeNull();
    expect(h.release("pad", 30)).toBe("inspect");
  });

  it("can be pressed again after a release", () => {
    const h = createInspectHold();
    h.press("pad", 0);
    h.poll(400);
    h.release("pad", 500);
    expect(h.press("pad", 600)).toBe(true);
    expect(h.release("pad", 650)).toBe("inspect");
  });

  it("cancel closes a showing zoom and forgets a press", () => {
    const h = createInspectHold();
    h.press("pad", 0);
    h.poll(400);
    expect(h.cancel()).toBe("close");
    expect(h.release("pad", 500)).toBeNull();
    h.press("key", 600);
    expect(h.cancel()).toBeNull();
  });
});

describe("zoom target", () => {
  const card = { kind: "card", instanceId: "c1" } as const;
  it("follows the focused card only while zooming", () => {
    expect(zoomCardOf(true, card, false)).toBe(card);
    expect(zoomCardOf(false, card, false)).toBeNull();
    expect(zoomCardOf(true, { kind: "undo" }, false)).toBeNull();
    expect(zoomCardOf(true, null, false)).toBeNull();
    expect(zoomCardOf(true, card, true)).toBeNull();
  });

  it("sits beside the card: right when it fits, else left, clamped in the area", () => {
    const area = { x: 0, y: 0, width: 1000, height: 600 };
    const size = { width: 168, height: 240 };
    expect(zoomPlacement({ x: 100, y: 100, width: 60, height: 80 }, size, area)).toEqual({ x: 182, y: 20 });
    expect(zoomPlacement({ x: 900, y: 100, width: 60, height: 80 }, size, area)).toEqual({ x: 710, y: 20 });
    expect(zoomPlacement({ x: 100, y: 5, width: 60, height: 80 }, size, area).y).toBe(8);
  });
});
