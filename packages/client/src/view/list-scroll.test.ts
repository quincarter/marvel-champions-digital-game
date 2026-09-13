import { describe, expect, test } from "vitest";
import { ListScroll, thumbOf } from "./list-scroll.js";

describe("ListScroll", () => {
  test("starts at the top and shows as many rows as fit", () => {
    const scroll = new ListScroll();
    expect(scroll.windowFor(10, 4)).toEqual({ start: 0, end: 4 });
  });

  test("an empty list or a panel with no room shows nothing", () => {
    const scroll = new ListScroll();
    expect(scroll.windowFor(0, 4)).toEqual({ start: 0, end: 0 });
    expect(scroll.windowFor(10, 0)).toEqual({ start: 0, end: 0 });
  });

  test("scrolling down moves the window and stops at the end", () => {
    const scroll = new ListScroll();
    expect(scroll.scrollBy(2, 10, 4)).toBe(true);
    expect(scroll.windowFor(10, 4)).toEqual({ start: 2, end: 6 });
    expect(scroll.scrollBy(100, 10, 4)).toBe(true);
    expect(scroll.windowFor(10, 4)).toEqual({ start: 6, end: 10 });
    // Already at the end: nothing moves.
    expect(scroll.scrollBy(1, 10, 4)).toBe(false);
  });

  test("scrolling up stops at the top and never goes negative", () => {
    const scroll = new ListScroll();
    expect(scroll.scrollBy(-1, 10, 4)).toBe(false);
  });

  test("a list shrinking below the current offset (a filter narrowing) clamps rather than going out of range", () => {
    const scroll = new ListScroll();
    scroll.scrollBy(8, 20, 4);
    expect(scroll.windowFor(5, 4)).toEqual({ start: 1, end: 5 });
  });

  test("reset returns to the top", () => {
    const scroll = new ListScroll();
    scroll.scrollBy(5, 20, 4);
    scroll.reset();
    expect(scroll.windowFor(20, 4)).toEqual({ start: 0, end: 4 });
  });
});

describe("thumbOf", () => {
  test("null when every row is already on screen", () => {
    expect(thumbOf({ start: 0, end: 4 }, 4)).toBeNull();
    expect(thumbOf({ start: 0, end: 0 }, 0)).toBeNull();
  });

  test("a fraction of the track otherwise", () => {
    expect(thumbOf({ start: 2, end: 6 }, 10)).toEqual({ top: 0.2, size: 0.4 });
  });
});
