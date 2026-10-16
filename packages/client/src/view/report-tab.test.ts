import { describe, expect, test } from "vitest";
import { DEFAULT_REPORT_TAB_Y, parseReportTabFraction, reportTabFractionAt, reportTabGeometry } from "./report-tab.js";

describe("reportTabGeometry", () => {
  test("phone: a slim tab flush with the right edge, its press area reaching a little further in", () => {
    const { tab, hit } = reportTabGeometry({ width: 390, height: 844 }, "phone", DEFAULT_REPORT_TAB_Y);
    expect(tab.x + tab.width).toBe(390);
    expect(tab.width).toBeLessThan(hit.width);
    expect(hit.x + hit.width).toBe(390);
    expect(tab.y + tab.height / 2).toBeCloseTo(844 * DEFAULT_REPORT_TAB_Y, 0);
  });

  test("tablet and desktop draw a larger tab", () => {
    const phone = reportTabGeometry({ width: 390, height: 844 }, "phone", 0.5);
    const desktop = reportTabGeometry({ width: 1440, height: 980 }, "desktop", 0.5);
    expect(desktop.tab.height).toBeGreaterThan(phone.tab.height);
    expect(desktop.labelSize).toBeGreaterThan(phone.labelSize);
  });

  test("dragged to either end, it stops short of the top chrome and the bottom action row", () => {
    const top = reportTabGeometry({ width: 1024, height: 768 }, "tabletLandscape", 0);
    const bottom = reportTabGeometry({ width: 1024, height: 768 }, "tabletLandscape", 1);
    expect(top.tab.y).toBe(60);
    expect(bottom.tab.y + bottom.tab.height).toBe(768 - 72);
  });

  test("a screen too short for the margins still keeps the tab on screen", () => {
    const { tab } = reportTabGeometry({ width: 700, height: 120 }, "phoneLandscape", 1);
    expect(tab.y).toBeGreaterThanOrEqual(0);
    expect(tab.y + tab.height).toBeLessThanOrEqual(120);
  });
});

test("a drag saves where the tab's centre ended, as a fraction of the height", () => {
  expect(reportTabFractionAt(422, 844)).toBe(0.5);
  expect(reportTabFractionAt(-50, 844)).toBe(0);
  expect(reportTabFractionAt(100, 0)).toBe(DEFAULT_REPORT_TAB_Y);
});

test.each([
  [null, DEFAULT_REPORT_TAB_Y],
  ["", DEFAULT_REPORT_TAB_Y],
  ["0.25", 0.25],
  ["1.5", DEFAULT_REPORT_TAB_Y],
  ["nope", DEFAULT_REPORT_TAB_Y],
])("a saved place of %j reads as %d", (saved, expected) => {
  expect(parseReportTabFraction(saved)).toBe(expected);
});
