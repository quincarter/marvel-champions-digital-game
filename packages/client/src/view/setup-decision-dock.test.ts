import { describe, expect, test } from "vitest";
import type { Rect } from "./layout.js";
import { setupDecisionDock } from "./setup-decision-dock.js";
import { setupWalkthroughLayout } from "./setup-walkthrough-layout.js";
import { setupMetrics } from "./setup-metrics.js";

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("setupDecisionDock", () => {
  test.each([
    [1440, 900, 3],
    [1440, 900, 0],
    [1280, 720, 1],
    [768, 1024, 1],
  ])("%ix%i with %i other seats: the dock is clear of the hand, seats, setup card and checklist", (w, h, others) => {
    const layout = setupWalkthroughLayout({ width: w, height: h, otherSeatCount: others, seatCount: others + 1 });
    const { pad, gap } = setupMetrics(w, h);
    const dock = setupDecisionDock(layout, h - pad, gap);
    if (!dock) return;
    for (const other of [
      layout.checklist,
      layout.handLabel,
      layout.handRow,
      layout.commitRow,
      layout.otherSeatsLabel,
      ...layout.otherSeats,
      layout.revealedPanel!,
    ]) {
      expect(overlaps(dock, other), JSON.stringify([dock, other])).toBe(false);
    }
    expect(dock.x).toBeGreaterThanOrEqual(0);
    expect(dock.x + dock.width).toBeLessThanOrEqual(w);
    expect(dock.y + dock.height).toBeLessThanOrEqual(h);
  });

  test("a desktop has a dock under the revealed card", () => {
    const layout = setupWalkthroughLayout({ width: 1440, height: 900, otherSeatCount: 0, seatCount: 1 });
    const { pad, gap } = setupMetrics(1440, 900);
    const dock = setupDecisionDock(layout, 900 - pad, gap)!;
    expect(dock).not.toBeNull();
    expect(dock.y).toBeGreaterThan(layout.revealedPanel!.y + layout.revealedPanel!.height - 1);
  });

  test("a phone and a landscape tablet have no dock: the sheet stays centered", () => {
    for (const [w, h] of [
      [390, 844],
      [1024, 768],
    ] as const) {
      const layout = setupWalkthroughLayout({ width: w, height: h, otherSeatCount: 1, seatCount: 2 });
      const { pad, gap } = setupMetrics(w, h);
      expect(setupDecisionDock(layout, h - pad, gap)).toBeNull();
    }
  });
});
