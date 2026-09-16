import { describe, expect, test } from "vitest";
import { ListScroll, thumbOf } from "./list-scroll.js";

describe("ListScroll", () => {
  test("starts at the top and shows as many rows as fit, plus one row of overscan below", () => {
    const scroll = new ListScroll();
    expect(scroll.windowFor(10, 20, 80)).toEqual({ start: 0, end: 5 });
  });

  test("an empty list or a panel with no room shows nothing", () => {
    expect(new ListScroll().windowFor(0, 20, 80)).toEqual({ start: 0, end: 0 });
    expect(new ListScroll().windowFor(10, 20, 0)).toEqual({ start: 0, end: 0 });
  });

  test("a panel taller than a multiple of the row height still clamps to the true bottom — no dead gap", () => {
    const scroll = new ListScroll();
    // 10 rows of 20px = 200px content in a 90px panel: max offset is 110.
    scroll.scrollByPx(10_000, 10, 20, 90);
    expect(scroll.offsetPx).toBe(110);
  });

  test("scrolling by a pixel delta moves smoothly, not by whole rows", () => {
    const scroll = new ListScroll();
    expect(scroll.scrollByPx(7, 10, 20, 80)).toBe(true);
    expect(scroll.offsetPx).toBe(7);
    expect(scroll.rowTop(0, 20)).toBe(-7);
    expect(scroll.rowTop(1, 20)).toBe(13);
  });

  test("scrolling stops at the end and reports no movement past it", () => {
    const scroll = new ListScroll();
    scroll.scrollByPx(10_000, 10, 20, 80);
    expect(scroll.offsetPx).toBe(120);
    expect(scroll.scrollByPx(50, 10, 20, 80)).toBe(false);
  });

  test("scrolling up never goes negative", () => {
    const scroll = new ListScroll();
    expect(scroll.scrollByPx(-50, 10, 20, 80)).toBe(false);
    expect(scroll.offsetPx).toBe(0);
  });

  test("a list shrinking below the current offset (a filter narrowing) clamps rather than going out of range", () => {
    const scroll = new ListScroll();
    scroll.scrollByPx(1000, 20, 20, 80);
    scroll.clamp(5, 20, 80); // 5 rows of 20px = 100px content in an 80px panel: max offset 20.
    expect(scroll.offsetPx).toBe(20);
  });

  test("reset returns to the top", () => {
    const scroll = new ListScroll();
    scroll.scrollByPx(200, 20, 20, 80);
    scroll.reset();
    expect(scroll.offsetPx).toBe(0);
  });

  test("scrollByRows moves by whole rows", () => {
    const scroll = new ListScroll();
    expect(scroll.scrollByRows(2, 10, 20, 80)).toBe(true);
    expect(scroll.offsetPx).toBe(40);
  });

  test("scrollByPage moves a panel's height less one row of overlap", () => {
    const scroll = new ListScroll();
    // 80px panel / 20px rows = 4 rows visible; a page is 3 rows = 60px.
    expect(scroll.scrollByPage(1, 20, 20, 80)).toBe(true);
    expect(scroll.offsetPx).toBe(60);
    expect(scroll.scrollByPage(-1, 20, 20, 80)).toBe(true);
    expect(scroll.offsetPx).toBe(0);
  });

  test("scrollToStart and scrollToEnd jump to the ends", () => {
    const scroll = new ListScroll();
    expect(scroll.scrollToEnd(10, 20, 80)).toBe(true);
    expect(scroll.offsetPx).toBe(120);
    expect(scroll.scrollToStart(10, 20, 80)).toBe(true);
    expect(scroll.offsetPx).toBe(0);
    // Already there: no movement.
    expect(scroll.scrollToStart(10, 20, 80)).toBe(false);
  });

  describe("scrollIntoView", () => {
    test("a row already fully visible doesn't move the view", () => {
      const scroll = new ListScroll();
      scroll.scrollByPx(40, 10, 20, 80); // rows 2..5 visible (40..120px)
      expect(scroll.scrollIntoView(2, 10, 20, 80)).toBe(false);
      expect(scroll.offsetPx).toBe(40);
    });

    test("a row above the view scrolls up to align its top with the view's top", () => {
      const scroll = new ListScroll();
      scroll.scrollByPx(100, 10, 20, 80);
      expect(scroll.scrollIntoView(1, 10, 20, 80)).toBe(true);
      expect(scroll.offsetPx).toBe(20);
    });

    test("a row below the view scrolls down to align its bottom with the view's bottom", () => {
      const scroll = new ListScroll();
      expect(scroll.scrollIntoView(5, 10, 20, 80)).toBe(true);
      // Row 5's bottom is at 120px; an 80px view must end there, so it starts at 40px.
      expect(scroll.offsetPx).toBe(40);
    });
  });
});

describe("thumbOf", () => {
  test("null when every row is already on screen", () => {
    expect(thumbOf(0, 4, 20, 80)).toBeNull();
    expect(thumbOf(0, 0, 20, 80)).toBeNull();
  });

  test("a fraction of the track otherwise", () => {
    // 10 rows of 20px = 200px content, 40px viewport: thumb covers 20%, offset 40px is 20% down.
    expect(thumbOf(40, 10, 20, 40)).toEqual({ top: 0.2, size: 0.2 });
  });
});
