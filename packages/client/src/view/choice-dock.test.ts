import { afterEach, describe, expect, test } from "vitest";
import { choiceDock, choiceDockOptions, setChoiceDock } from "./choice-dock.js";

const rect = { x: 10, y: 20, width: 300, height: 400 };

afterEach(() => {
  setChoiceDock(null);
});

describe("setChoiceDock", () => {
  test("says when the dock changed, so the publisher redraws an open sheet only then", () => {
    expect(setChoiceDock(rect)).toBe(true);
    expect(setChoiceDock({ ...rect })).toBe(false);
    expect(setChoiceDock({ ...rect, width: 320 })).toBe(true);
    expect(setChoiceDock(null)).toBe(true);
    expect(setChoiceDock(null)).toBe(false);
  });

  test("a change of options alone is a change (the villain phase docks on a phone, the setup screen does not)", () => {
    setChoiceDock(rect);
    expect(setChoiceDock(rect, { onPhone: true, sourceStrip: true })).toBe(true);
    expect(choiceDockOptions()).toEqual({ onPhone: true, sourceStrip: true });
    expect(setChoiceDock(rect, { onPhone: true, sourceStrip: true })).toBe(false);
  });

  test("withdrawing the dock drops its options with it", () => {
    setChoiceDock(rect, { onPhone: true });
    setChoiceDock(null, { onPhone: true });
    expect(choiceDock()).toBeNull();
    expect(choiceDockOptions()).toEqual({});
  });
});
