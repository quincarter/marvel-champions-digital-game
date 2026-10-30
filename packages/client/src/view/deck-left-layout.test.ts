import { describe, expect, test } from "vitest";
import { deckLeftLayout } from "./deck-left-layout.js";

describe("deckLeftLayout", () => {
  test.each([
    [1440, 900],
    [812, 375],
    [390, 844],
  ])("at %d x %d nothing overlaps and the list ends inside the panel", (width, height) => {
    const layout = deckLeftLayout(width, height, 24, 2, 40);
    const bottom = layout.panel.y + layout.panel.height;
    expect(layout.tabs).toHaveLength(2);
    expect(layout.tabs[0]!.y).toBeGreaterThanOrEqual(layout.bar.y + layout.bar.height);
    expect(layout.tabs[0]!.x + layout.tabs[0]!.width).toBeLessThan(layout.tabs[1]!.x);
    expect(layout.summary.y).toBeGreaterThanOrEqual(layout.tabs[0]!.y + layout.tabs[0]!.height);
    expect(layout.list.y).toBeGreaterThanOrEqual(layout.summary.y + layout.summary.height);
    expect(layout.list.y + layout.list.height).toBeLessThanOrEqual(bottom);
  });

  test("one tab draws none, and no summary takes no room", () => {
    const layout = deckLeftLayout(1440, 900, 24, 1, 0);
    expect(layout.tabs).toEqual([]);
    expect(layout.list.y).toBe(layout.summary.y);
  });
});
