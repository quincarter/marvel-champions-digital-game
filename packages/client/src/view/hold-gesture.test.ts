import { describe, expect, it } from "vitest";
import { HOLD_SLOP_PX, HoldGesture } from "./hold-gesture.js";

const card = (): HoldGesture => new HoldGesture({ canInspect: true, canDrag: false });
const handCard = (): HoldGesture => new HoldGesture({ canInspect: true, canDrag: true });

describe("HoldGesture", () => {
  it("a press and a release is a tap", () => {
    const gesture = card();
    expect(gesture.down(100, 100, false)).toBe("arm");
    expect(gesture.up(false)).toBe(true);
  });

  it("a press still down and still when the timer fires is a hold, and its release is not also a tap", () => {
    const gesture = card();
    gesture.down(100, 100, false);
    expect(gesture.holdElapsed(100, 100, true)).toBe(true);
    expect(gesture.up(false)).toBe(false);
  });

  it("a right-click inspects at once and its release is not a tap", () => {
    const gesture = card();
    expect(gesture.down(100, 100, true)).toBe("inspect");
    expect(gesture.holdElapsed(100, 100, true)).toBe(false);
    expect(gesture.up(false)).toBe(false);
  });

  // The phone bug: a thumb rolls while it holds, and that used to cancel the hold for good.
  it("a hold survives a finger that wobbles inside the slop, in a scrollable row too", () => {
    for (const gesture of [card(), handCard()]) {
      gesture.down(100, 100, false);
      expect(gesture.move(100 + HOLD_SLOP_PX - 2)).toBe(false);
      expect(gesture.move(100 - (HOLD_SLOP_PX - 2))).toBe(false);
      expect(gesture.holdElapsed(104, 97, true)).toBe(true);
    }
  });

  it("a wobble that leaves the slop and comes back is still a hold on a card that does not scroll", () => {
    const gesture = card();
    gesture.down(100, 100, false);
    gesture.move(100 + HOLD_SLOP_PX * 2);
    expect(gesture.holdElapsed(101, 101, true)).toBe(true);
  });

  it("a press that has wandered off when the timer fires is not a hold, but its release is still a tap", () => {
    const gesture = card();
    gesture.down(100, 100, false);
    expect(gesture.holdElapsed(100, 100 + HOLD_SLOP_PX + 1, true)).toBe(false);
    expect(gesture.up(false)).toBe(true);
  });

  it("sideways travel past the slop in a scrollable row is a drag for the rest of the press: no hold, no tap", () => {
    const gesture = handCard();
    gesture.down(100, 100, false);
    expect(gesture.move(100 + HOLD_SLOP_PX)).toBe(true);
    // Back where it started: still a drag.
    expect(gesture.move(100)).toBe(true);
    expect(gesture.holdElapsed(100, 100, true)).toBe(false);
    expect(gesture.up(false)).toBe(false);
  });

  it("sideways travel never becomes a drag on a card outside a scrollable row", () => {
    const gesture = card();
    gesture.down(100, 100, false);
    expect(gesture.move(300)).toBe(false);
  });

  it("a press released off the control does not inspect when the timer fires", () => {
    const gesture = card();
    gesture.down(100, 100, false);
    expect(gesture.holdElapsed(100, 100, false)).toBe(false);
    expect(gesture.active).toBe(false);
  });

  it("a touch the system cancelled is not a tap", () => {
    const gesture = card();
    gesture.down(100, 100, false);
    expect(gesture.up(true)).toBe(false);
  });

  it("a release with no press behind it — a control drawn under a finger already down — is not a tap", () => {
    expect(card().up(false)).toBe(false);
  });

  it("a control with nothing to inspect never arms a hold; its press is only a tap", () => {
    const gesture = new HoldGesture({ canInspect: false, canDrag: false });
    expect(gesture.down(100, 100, false)).toBe("none");
    expect(gesture.down(100, 100, true)).toBe("none");
    expect(gesture.up(false)).toBe(true);
  });

  it("knows when a press is still undecided", () => {
    const gesture = handCard();
    expect(gesture.undecided).toBe(false);
    gesture.down(100, 100, false);
    expect(gesture.undecided).toBe(true);
    gesture.move(200);
    expect(gesture.undecided).toBe(false);
    expect(gesture.active).toBe(true);
  });
});
