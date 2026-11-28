import { describe, expect, it } from "vitest";
import { NARROW_BAR, TAB_GAP, titleClearance } from "./title-clearance.js";
import { onThemeTabChange, setThemeTab, themeTab } from "./theme-tab.js";

/** The tab press area on a 1024px screen: centred, 44 wide, 38 tall. */
const TAB = { left: 490, right: 534, bottom: 38 };
const wide = { barWidth: 1024, titleLeft: 140, rowRight: 1000, tab: TAB };

describe("titleClearance", () => {
  it("keeps a wide bar title in the first row when the whole of it ends before the tab", () => {
    expect(titleClearance({ ...wide, titleWidth: 300 })).toEqual({ dropped: false, firstRow: 0 });
    expect(titleClearance({ ...wide, titleWidth: TAB.left - TAB_GAP - wide.titleLeft })).toMatchObject({
      dropped: false,
    });
  });

  it("drops a wide bar title under the tab, whole, when it would reach the tab", () => {
    const result = titleClearance({ ...wide, titleWidth: 400 });
    expect(result).toEqual({ dropped: true, firstRow: TAB.bottom + TAB_GAP });
  });

  it("drops the title when it starts under the tab", () => {
    expect(titleClearance({ ...wide, titleLeft: 500, titleWidth: 80 }).dropped).toBe(true);
  });

  it("lets a title that starts clear to the right of the tab stay in the row", () => {
    expect(titleClearance({ ...wide, titleLeft: 560, titleWidth: 200 }).dropped).toBe(false);
  });

  it("always drops on a narrow bar while the tab is up, however short the title", () => {
    const phone = { barWidth: NARROW_BAR - 1, titleLeft: 68, titleWidth: 40, rowRight: 360 };
    expect(titleClearance({ ...phone, tab: { left: 168, right: 212, bottom: 32 } })).toEqual({
      dropped: true,
      firstRow: 32 + TAB_GAP,
    });
  });

  it("with no tab, drops only a title that does not fit the row, and needs no first row", () => {
    const base = { barWidth: 375, titleLeft: 68, rowRight: 360, tab: null };
    expect(titleClearance({ ...base, titleWidth: 100 })).toEqual({ dropped: false, firstRow: 0 });
    expect(titleClearance({ ...base, titleWidth: 400 })).toEqual({ dropped: true, firstRow: 0 });
  });

  it("ignores a tab that ends above the bar", () => {
    expect(titleClearance({ ...wide, tab: { left: 140, right: 534, bottom: -20 }, titleWidth: 400 }).dropped).toBe(
      false,
    );
  });

  it("drops a title that would run into the caption or the end slot, tab or not", () => {
    expect(titleClearance({ ...wide, tab: null, rowRight: 300, titleWidth: 200 }).dropped).toBe(true);
  });
});

describe("the shared theme tab", () => {
  it("publishes its box, tells listeners once per change and ignores an identical box", () => {
    let calls = 0;
    const off = onThemeTabChange(() => (calls += 1));
    setThemeTab(TAB);
    setThemeTab({ ...TAB });
    expect(themeTab()).toEqual(TAB);
    expect(calls).toBe(1);
    setThemeTab(null);
    expect(themeTab()).toBeNull();
    expect(calls).toBe(2);
    off();
    setThemeTab(TAB);
    expect(calls).toBe(2);
    setThemeTab(null);
  });
});
