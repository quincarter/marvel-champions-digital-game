import { describe, expect, test } from "vitest";
import { DragGesture, Momentum, pointInRect } from "./drag-gesture.js";
import { ListScroll } from "./list-scroll.js";

describe("DragGesture", () => {
  test("a small movement below the threshold is a tap", () => {
    const g = new DragGesture({ tapThresholdPx: 6 });
    expect(g.start(1, 100, 0)).toBe(true);
    g.move(1, 103, 16); // 3px, under threshold
    const result = g.end(1, 32);
    expect(result).toEqual({ wasTap: true, velocityPxPerMs: expect.any(Number) });
  });

  test("movement past the threshold is a drag, not a tap", () => {
    const g = new DragGesture({ tapThresholdPx: 6 });
    g.start(1, 100, 0);
    g.move(1, 90, 16); // 10px, over threshold
    const result = g.end(1, 32);
    expect(result!.wasTap).toBe(false);
  });

  test("movedPastThreshold reflects the running gesture, not just at end", () => {
    const g = new DragGesture({ tapThresholdPx: 6 });
    g.start(1, 100, 0);
    expect(g.movedPastThreshold).toBe(false);
    g.move(1, 80, 16);
    expect(g.movedPastThreshold).toBe(true);
  });

  test("move() reports a scroll delta opposite the finger's own direction — dragging up scrolls forward", () => {
    const g = new DragGesture();
    g.start(1, 100, 0);
    const delta = g.move(1, 80, 16); // finger moved up 20px
    expect(delta).toBe(20); // scroll forward by 20
  });

  test("a second pointer while one is already tracked is ignored", () => {
    const g = new DragGesture();
    expect(g.start(1, 100, 0)).toBe(true);
    expect(g.start(2, 200, 0)).toBe(false);
    // The second pointer's move/end report nothing — it was never tracked.
    expect(g.move(2, 150, 10)).toBeNull();
    expect(g.end(2, 20)).toBeNull();
    // The first pointer is still the one being tracked.
    expect(g.move(1, 90, 10)).not.toBeNull();
  });

  test("move()/end() for an untracked pointer (no drag at all) report nothing", () => {
    const g = new DragGesture();
    expect(g.move(1, 100, 0)).toBeNull();
    expect(g.end(1, 0)).toBeNull();
  });

  test("end() releases the pointer, so a later start() with the same id works again", () => {
    const g = new DragGesture();
    g.start(1, 100, 0);
    g.end(1, 10);
    expect(g.isDragging).toBe(false);
    expect(g.start(1, 50, 20)).toBe(true);
  });

  test("cancel() drops the tracked pointer without a result", () => {
    const g = new DragGesture();
    g.start(1, 100, 0);
    g.cancel();
    expect(g.isDragging).toBe(false);
    expect(g.end(1, 10)).toBeNull();
  });

  test("a fast flick reports a release velocity in the direction of the flick", () => {
    const g = new DragGesture();
    g.start(1, 500, 0);
    g.move(1, 400, 16); // moved up fast: 100px in 16ms
    const result = g.end(1, 16);
    // Moving up (finger decreasing y) scrolls forward (positive).
    expect(result!.velocityPxPerMs).toBeGreaterThan(0);
  });
});

describe("Momentum", () => {
  test("inactive with no velocity", () => {
    const m = new Momentum();
    expect(m.active).toBe(false);
    expect(m.tick(16)).toBe(0);
  });

  test("a velocity below the minimum never starts", () => {
    const m = new Momentum({ minVelocityPxPerMs: 0.1 });
    m.start(0.05);
    expect(m.active).toBe(false);
  });

  test("ticks produce a decaying delta and eventually stop", () => {
    const m = new Momentum({ decayPerMs: 0.01, minVelocityPxPerMs: 0.02 });
    m.start(1); // 1 px/ms
    const first = m.tick(16);
    expect(first).toBeCloseTo(16, 0);
    let ticks = 0;
    while (m.active && ticks < 10_000) {
      m.tick(16);
      ticks++;
    }
    expect(m.active).toBe(false);
    expect(ticks).toBeGreaterThan(0);
    expect(ticks).toBeLessThan(10_000);
  });

  test("stop() ends momentum immediately — the clamp-at-an-end case", () => {
    const m = new Momentum();
    m.start(1);
    expect(m.active).toBe(true);
    m.stop();
    expect(m.active).toBe(false);
    expect(m.tick(16)).toBe(0);
  });

  test("momentum can run in either direction", () => {
    const m = new Momentum({ decayPerMs: 0.01 });
    m.start(-1);
    expect(m.tick(10)).toBeLessThan(0);
  });
});

describe("Momentum composed with ListScroll — the clamp-at-an-end contract `ui/virtual-list.ts#onUpdate` relies on", () => {
  /** What `McVirtualList#onUpdate` does each frame: apply one momentum tick to the scroll, and stop momentum the instant the scroll reports no movement (an end was hit). */
  function runToStop(scroll: ListScroll, momentum: Momentum, count: number, rowHeight: number, viewportHeight: number, frameMs = 16, maxTicks = 100_000): number {
    let ticks = 0;
    while (momentum.active && ticks < maxTicks) {
      const delta = momentum.tick(frameMs);
      if (delta === 0) break;
      const moved = scroll.scrollByPx(delta, count, rowHeight, viewportHeight);
      if (!moved) {
        momentum.stop();
        break;
      }
      ticks++;
    }
    return ticks;
  }

  test("flicking toward the top stops exactly at 0, never negative", () => {
    const scroll = new ListScroll();
    scroll.scrollByPx(50, 10, 20, 80); // start partway down
    const momentum = new Momentum({ decayPerMs: 0.002 });
    momentum.start(-3); // fast flick toward the top
    runToStop(scroll, momentum, 10, 20, 80);
    expect(momentum.active).toBe(false);
    expect(scroll.offsetPx).toBe(0);
  });

  test("flicking toward the bottom stops exactly at the max offset, never past it", () => {
    const scroll = new ListScroll();
    const momentum = new Momentum({ decayPerMs: 0.002 });
    momentum.start(3); // fast flick toward the end
    runToStop(scroll, momentum, 10, 20, 80);
    expect(momentum.active).toBe(false);
    // 10 rows * 20px = 200px content in an 80px viewport: max offset 120.
    expect(scroll.offsetPx).toBe(120);
  });

  test("momentum too gentle to reach an end just decays to a stop mid-list", () => {
    const scroll = new ListScroll();
    scroll.scrollByPx(50, 10, 20, 80);
    const momentum = new Momentum({ decayPerMs: 0.05 }); // decays fast, won't travel far
    momentum.start(0.3);
    runToStop(scroll, momentum, 10, 20, 80);
    expect(momentum.active).toBe(false);
    expect(scroll.offsetPx).toBeGreaterThan(50);
    expect(scroll.offsetPx).toBeLessThan(120);
  });
});

describe("pointInRect", () => {
  const rect = { x: 10, y: 20, width: 100, height: 50 };

  test("a point inside is in the rect", () => {
    expect(pointInRect(50, 40, rect)).toBe(true);
  });

  test("a point on the edge counts as inside", () => {
    expect(pointInRect(10, 20, rect)).toBe(true);
    expect(pointInRect(110, 70, rect)).toBe(true);
  });

  test("a point outside is rejected — this is the clip-rect guard", () => {
    expect(pointInRect(5, 40, rect)).toBe(false);
    expect(pointInRect(50, 15, rect)).toBe(false);
    expect(pointInRect(200, 200, rect)).toBe(false);
  });

  test("null clip means nothing is clipped — callers check for null themselves before calling this", () => {
    // Documented via the type signature (no rect argument accepted as null); this test just
    // pins the contract that pointInRect itself always needs a concrete rect.
    expect(pointInRect(0, 0, { x: 0, y: 0, width: 0, height: 0 })).toBe(true);
  });
});
