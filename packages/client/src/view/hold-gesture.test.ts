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

describe("HoldGesture drag distances", () => {
  it("reports nothing inside the slop, then starts from where it crossed it — no jump to catch up", () => {
    const gesture = handCard();
    gesture.down(100, 50, false);
    expect(gesture.dragDelta(100 + HOLD_SLOP_PX - 1, 10)).toBeNull();
    expect(gesture.dragDelta(100 + HOLD_SLOP_PX + 3, 20)).toBe(0);
    expect(gesture.dragDelta(100 + HOLD_SLOP_PX + 13, 30)).toBe(10);
  });

  it("left, right and left again in one press: each move is measured from the one before", () => {
    const gesture = handCard();
    gesture.down(200, 50, false);
    gesture.dragDelta(180, 10);
    const deltas = [150, 120, 160, 210, 170, 140].map((x, index) => gesture.dragDelta(x, 20 + index * 10));
    expect(deltas).toEqual([-30, -30, 40, 50, -40, -30]);
    // Back inside the slop of where it began, it is still a drag — it never reverts to a tap or a hold.
    expect(gesture.dragDelta(200, 100)).toBe(60);
  });

  it("several moves in one millisecond are all counted", () => {
    const gesture = handCard();
    gesture.down(200, 50, false);
    gesture.dragDelta(180, 10);
    expect([gesture.dragDelta(170, 20), gesture.dragDelta(165, 20), gesture.dragDelta(150, 20)]).toEqual([
      -10, -5, -15,
    ]);
  });

  it("a flick has a release speed, asked for after the release; a finger that stopped first has none", () => {
    const flick = handCard();
    flick.down(300, 50, false);
    flick.dragDelta(280, 10);
    flick.dragDelta(240, 20);
    flick.dragDelta(200, 30);
    flick.up(false);
    expect(flick.releaseVelocity(35)).toBeCloseTo(-4, 5);

    const placed = handCard();
    placed.down(300, 50, false);
    placed.dragDelta(280, 10);
    placed.dragDelta(240, 20);
    placed.up(false);
    expect(placed.releaseVelocity(400)).toBe(0);

    const tap = handCard();
    tap.down(300, 50, false);
    tap.up(false);
    expect(tap.releaseVelocity(5)).toBe(0);
  });

  it("a card outside a scrollable row never drags", () => {
    const gesture = card();
    gesture.down(100, 50, false);
    expect(gesture.dragDelta(300, 10)).toBeNull();
  });
});
