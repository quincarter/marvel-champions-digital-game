import { describe, expect, test } from "vitest";
import { LogScroll, thumbOf, windowEndingAt, windowStartingAt, type LogMeasure } from "./log-view.js";

/** `count` lines of `height` px each, ids line-1…line-N, in a view of `viewHeight`. */
const measure = (count: number, height: number, viewHeight: number, firstId = 1): LogMeasure => ({
  ids: Array.from({ length: count }, (_unused, index) => `line-${firstId + index}`),
  heights: Array.from({ length: count }, () => height),
  viewHeight,
});

describe("log windows", () => {
  test("a window ending at a line reaches up as far as the view allows", () => {
    expect(windowEndingAt([20, 20, 20, 20, 20], 60, 4)).toEqual({ start: 2, end: 5 });
    // Mixed heights: a tall line takes the room of several short ones.
    expect(windowEndingAt([20, 20, 50, 20], 75, 3)).toEqual({ start: 2, end: 4 });
  });

  test("a line taller than the view is still shown, alone", () => {
    expect(windowEndingAt([20, 90, 20], 60, 1)).toEqual({ start: 1, end: 2 });
  });

  test("a window starting at a line reaches down as far as the view allows", () => {
    expect(windowStartingAt([20, 20, 20, 20], 50, 0)).toEqual({ start: 0, end: 2 });
  });

  test("an empty log has an empty window", () => {
    expect(windowEndingAt([], 100, 0)).toEqual({ start: 0, end: 0 });
    expect(new LogScroll().windowFor(measure(0, 20, 100))).toEqual({ start: 0, end: 0 });
  });
});

describe("log scroll", () => {
  test("follows the newest line until the player scrolls", () => {
    const scroll = new LogScroll();
    expect(scroll.windowFor(measure(10, 20, 60))).toEqual({ start: 7, end: 10 });
    expect(scroll.windowFor(measure(12, 20, 60))).toEqual({ start: 9, end: 12 });
    expect(scroll.following).toBe(true);
  });

  test("scrolling up anchors the view, so new lines arrive below without moving it", () => {
    const scroll = new LogScroll();
    expect(scroll.scrollBy(-2, measure(10, 20, 60))).toBe(true);
    expect(scroll.windowFor(measure(10, 20, 60))).toEqual({ start: 5, end: 8 });
    // Three more lines land while the player reads.
    expect(scroll.windowFor(measure(13, 20, 60))).toEqual({ start: 5, end: 8 });
    expect(scroll.newerThanView(measure(13, 20, 60))).toBe(5);
  });

  test("scrolling back to the bottom follows again", () => {
    const scroll = new LogScroll();
    scroll.scrollBy(-3, measure(10, 20, 60));
    scroll.scrollBy(3, measure(10, 20, 60));
    expect(scroll.following).toBe(true);
    expect(scroll.newerThanView(measure(10, 20, 60))).toBe(0);
  });

  test("cannot scroll above the first line, and a stuck wheel tick reports no movement", () => {
    const scroll = new LogScroll();
    scroll.scrollBy(-100, measure(10, 20, 60));
    expect(scroll.windowFor(measure(10, 20, 60))).toEqual({ start: 0, end: 3 });
    expect(scroll.scrollBy(-1, measure(10, 20, 60))).toBe(false);
  });

  test("a log that fits never leaves follow mode", () => {
    const scroll = new LogScroll();
    expect(scroll.scrollBy(-1, measure(2, 20, 100))).toBe(false);
    expect(scroll.following).toBe(true);
  });

  test("an anchor trimmed off the front of the log falls back to the oldest lines still held", () => {
    const scroll = new LogScroll();
    scroll.scrollBy(-100, measure(10, 20, 60));
    // The log capped and dropped line-1…line-5.
    expect(scroll.windowFor(measure(10, 20, 60, 6))).toEqual({ start: 0, end: 3 });
  });

  test("jump to latest", () => {
    const scroll = new LogScroll();
    scroll.scrollBy(-4, measure(10, 20, 60));
    expect(scroll.follow()).toBe(true);
    expect(scroll.follow()).toBe(false);
    expect(scroll.windowFor(measure(10, 20, 60))).toEqual({ start: 7, end: 10 });
  });
});

describe("scroll thumb", () => {
  test("is absent when every line is on screen", () => {
    expect(thumbOf({ start: 0, end: 4 }, 4)).toBeNull();
  });

  test("covers the share of the log in view, at its place in the log", () => {
    expect(thumbOf({ start: 5, end: 10 }, 20)).toEqual({ top: 0.25, size: 0.25 });
  });
});
