import { describe, expect, test } from "vitest";
import { DRAG_SLOP_PX, TableDrag, clampScroll, fullyInWindow, revealScroll, wheelPixels } from "./table-scroll.js";

const win = { x: 0, y: 44, width: 1000, height: 500 };

describe("revealScroll", () => {
  test("leaves a card that is already in view where it is", () => {
    expect(revealScroll(100, { x: 10, y: 100, width: 80, height: 120 }, win, 400)).toBe(100);
  });
  test("scrolls down for a card below the window, just far enough", () => {
    // Bottom at 600; the window's bottom edge less the margin is 536.
    expect(revealScroll(0, { x: 0, y: 480, width: 80, height: 120 }, win, 400)).toBe(64);
  });
  test("scrolls up for a card above the window", () => {
    expect(revealScroll(200, { x: 0, y: 10, width: 80, height: 120 }, win, 400)).toBe(200 - (52 - 10));
  });
  test("lines up the top of a card taller than the window", () => {
    expect(revealScroll(0, { x: 0, y: 300, width: 80, height: 700 }, win, 900)).toBe(300 - 52);
  });
  test("stays inside 0..max", () => {
    expect(revealScroll(0, { x: 0, y: -900, width: 80, height: 120 }, win, 400)).toBe(0);
    expect(revealScroll(0, { x: 0, y: 5000, width: 80, height: 120 }, win, 400)).toBe(400);
  });
});

describe("wheel and clamp", () => {
  test("a line-mode wheel is scaled to pixels, a pixel-mode one is not", () => {
    expect(wheelPixels(3, 1)).toBe(120);
    expect(wheelPixels(53, 0)).toBe(53);
  });
  test("clamps and rounds", () => {
    expect(clampScroll(-5, 100)).toBe(0);
    expect(clampScroll(150.4, 100)).toBe(100);
    expect(clampScroll(10.6, 100)).toBe(11);
    expect(clampScroll(10, 0)).toBe(0);
  });
  test("fullyInWindow", () => {
    expect(fullyInWindow({ x: 0, y: 50, width: 10, height: 10 }, win)).toBe(true);
    expect(fullyInWindow({ x: 0, y: 40, width: 10, height: 10 }, win)).toBe(false);
  });
});

describe("TableDrag", () => {
  test("a tap-sized move scrolls nothing", () => {
    const drag = new TableDrag();
    drag.down(1, 100, 100);
    expect(drag.move(1, 103, 106)).toBe(0);
    expect(drag.scrolling).toBe(false);
  });
  test("a vertical drag scrolls with the finger: pulling up moves the content up", () => {
    const drag = new TableDrag();
    drag.down(1, 100, 200);
    expect(drag.move(1, 101, 200 - DRAG_SLOP_PX - 4)).toBe(DRAG_SLOP_PX + 4);
    expect(drag.scrolling).toBe(true);
    expect(drag.move(1, 101, 150)).toBe(200 - DRAG_SLOP_PX - 4 - 150);
    drag.up(1);
    expect(drag.scrolling).toBe(false);
  });
  test("a horizontal drag is never ours, even if it later turns vertical", () => {
    const drag = new TableDrag();
    drag.down(1, 100, 200);
    expect(drag.move(1, 140, 204)).toBe(0);
    expect(drag.move(1, 140, 300)).toBe(0);
    expect(drag.scrolling).toBe(false);
  });
  test("another finger is ignored", () => {
    const drag = new TableDrag();
    drag.down(1, 100, 200);
    expect(drag.move(2, 100, 100)).toBe(0);
  });
});
