import { describe, expect, it } from "vitest";
import { hit } from "../tokens.js";
import {
  GUIDE_PANEL_COLLAPSED_WIDTH,
  GUIDE_PANEL_EXITS_ROW_HEIGHT,
  GUIDE_PANEL_HEADER_HEIGHT,
  GUIDE_PANEL_PAD,
  GUIDE_PANEL_SECTION_TOP_PAD,
  guidePanelCollapsedRectOf,
  guidePanelHeaderExitsLayoutOf,
  guidePanelHeaderHeightOf,
  guidePanelLayoutOf,
  guideRailWidthFor,
} from "./guide-panel-model.js";
import type { Rect } from "./layout.js";

describe("guideRailWidthFor", () => {
  it("is ~340 of 1440 at the desktop reference viewport", () => {
    expect(guideRailWidthFor(1440, "desktop")).toBe(340);
  });

  it("is ~300 of 1024 at the tablet-landscape reference viewport", () => {
    expect(guideRailWidthFor(1024, "tabletLandscape")).toBe(300);
  });

  it("scales proportionally on a wider desktop window", () => {
    expect(guideRailWidthFor(1920, "desktop")).toBe(Math.round(1920 * (340 / 1440)));
  });
});

describe("guidePanelHeaderHeightOf", () => {
  it("is the one-row header height with no exits row", () => {
    expect(guidePanelHeaderHeightOf(false)).toBe(GUIDE_PANEL_HEADER_HEIGHT);
  });

  it("adds the exits row's own height when Skip/Stop are shown", () => {
    expect(guidePanelHeaderHeightOf(true)).toBe(GUIDE_PANEL_HEADER_HEIGHT + GUIDE_PANEL_EXITS_ROW_HEIGHT);
  });
});

const RECT: Rect = { x: 0, y: 0, width: 340, height: 900 };

describe("guidePanelLayoutOf", () => {
  it("uses the taller two-row header height when headerHeight is passed (§3.10 exits row)", () => {
    const tall = guidePanelHeaderHeightOf(true);
    const layout = guidePanelLayoutOf({
      rect: RECT,
      hasLessonList: false,
      lessonRowCount: 0,
      bodyContentHeight: 200,
      footerHeight: 140,
      headerHeight: tall,
    });
    expect(layout.header.height).toBe(tall);
    expect(layout.body.y).toBe(tall + GUIDE_PANEL_SECTION_TOP_PAD);
  });

  it("stacks header, lesson list and body, with the footer pinned to the bottom", () => {
    const layout = guidePanelLayoutOf({
      rect: RECT,
      hasLessonList: true,
      lessonRowCount: 5,
      bodyContentHeight: 300,
      footerHeight: 140,
    });

    expect(layout.header).toEqual({ x: 0, y: 0, width: 340, height: GUIDE_PANEL_HEADER_HEIGHT });
    expect(layout.lessonList).not.toBeNull();
    expect(layout.lessonList!.y).toBe(GUIDE_PANEL_HEADER_HEIGHT);
    expect(layout.footer.y + layout.footer.height).toBe(RECT.y + RECT.height);
    expect(layout.footer.height).toBe(140);
    expect(layout.body.y).toBe(layout.lessonList!.y + layout.lessonList!.height + GUIDE_PANEL_SECTION_TOP_PAD);
    expect(layout.body.y + layout.body.height).toBe(layout.footer.y);
    expect(layout.scrollable).toBe(false);
  });

  it("hides the lesson list when hasLessonList is false", () => {
    const layout = guidePanelLayoutOf({
      rect: RECT,
      hasLessonList: false,
      lessonRowCount: 3,
      bodyContentHeight: 200,
      footerHeight: 140,
    });
    expect(layout.lessonList).toBeNull();
    expect(layout.body.y).toBe(GUIDE_PANEL_HEADER_HEIGHT + GUIDE_PANEL_SECTION_TOP_PAD);
  });

  it("hides the lesson list when it has zero rows even if requested", () => {
    const layout = guidePanelLayoutOf({
      rect: RECT,
      hasLessonList: true,
      lessonRowCount: 0,
      bodyContentHeight: 200,
      footerHeight: 140,
    });
    expect(layout.lessonList).toBeNull();
  });

  it("marks the body scrollable once its content exceeds the space left for it", () => {
    const layout = guidePanelLayoutOf({
      rect: RECT,
      hasLessonList: false,
      lessonRowCount: 0,
      bodyContentHeight: 10_000,
      footerHeight: 140,
    });
    expect(layout.scrollable).toBe(true);
    // The viewport itself never grows past what's actually left for it.
    expect(layout.body.height).toBe(RECT.height - GUIDE_PANEL_HEADER_HEIGHT - GUIDE_PANEL_SECTION_TOP_PAD - 140);
  });

  it("never lets the footer rise above the body's own top on an impossibly short rect", () => {
    const shortRect: Rect = { x: 0, y: 0, width: 340, height: 40 };
    const layout = guidePanelLayoutOf({
      rect: shortRect,
      hasLessonList: false,
      lessonRowCount: 0,
      bodyContentHeight: 50,
      footerHeight: 140,
    });
    expect(layout.footer.y).toBeGreaterThanOrEqual(layout.body.y);
    expect(layout.footer.y + layout.footer.height).toBe(shortRect.y + shortRect.height);
  });
});

/** Two rects overlap if they share any area — used below to assert the header's exits never collide. */
function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

describe("guidePanelHeaderExitsLayoutOf", () => {
  // The two rail widths G4b actually draws at (`guideRailWidthFor`'s own reference viewports) — this is
  // the header's own *second* row (`guidePanelHeaderHeightOf`'s own exits row), not row 1 with Collapse.
  const TABLET_RAIL: Rect = { x: 0, y: 0, width: guideRailWidthFor(1024, "tabletLandscape"), height: 768 };
  const DESKTOP_RAIL: Rect = { x: 0, y: 0, width: guideRailWidthFor(1440, "desktop"), height: 900 };
  const rowCenterY = GUIDE_PANEL_HEADER_HEIGHT + GUIDE_PANEL_EXITS_ROW_HEIGHT / 2;

  it.each([
    ["tablet landscape rail (1024x768)", TABLET_RAIL],
    ["desktop rail (1440x900)", DESKTOP_RAIL],
  ])("fits Skip and Stop with no overlap on the %s", (_name, rect) => {
    const layout = guidePanelHeaderExitsLayoutOf({ rect, rowCenterY, skipLabelWidth: 90, stopLabelWidth: 20 });
    expect(layout.skip).not.toBeNull();
    expect(layout.skip!.width).toBeGreaterThanOrEqual(hit.target);
    expect(layout.skip!.height).toBeGreaterThanOrEqual(hit.target);
    expect(layout.stop.width).toBeGreaterThanOrEqual(hit.target);
    expect(layout.stop.height).toBeGreaterThanOrEqual(hit.target);
    expect(overlaps(layout.skip!, layout.stop)).toBe(false);
    expect(layout.skip!.x).toBeGreaterThanOrEqual(rect.x);
    expect(layout.stop.x + layout.stop.width).toBeLessThanOrEqual(rect.x + rect.width - GUIDE_PANEL_PAD + 0.001);
  });

  it("hides Skip when the header has none, keeping Stop in place", () => {
    const layout = guidePanelHeaderExitsLayoutOf({
      rect: DESKTOP_RAIL,
      rowCenterY,
      skipLabelWidth: null,
      stopLabelWidth: 20,
    });
    expect(layout.skip).toBeNull();
    expect(layout.stop.x + layout.stop.width).toBeLessThanOrEqual(
      DESKTOP_RAIL.x + DESKTOP_RAIL.width - GUIDE_PANEL_PAD + 0.001,
    );
  });

  it("keeps Stop flush against the panel's own right padding", () => {
    const layout = guidePanelHeaderExitsLayoutOf({
      rect: DESKTOP_RAIL,
      rowCenterY,
      skipLabelWidth: 90,
      stopLabelWidth: 20,
    });
    expect(layout.stop.x + layout.stop.width).toBeCloseTo(DESKTOP_RAIL.x + DESKTOP_RAIL.width - GUIDE_PANEL_PAD, 0);
  });
});

describe("guidePanelCollapsedRectOf", () => {
  it("sits at the given edge, full height, at the collapsed width", () => {
    const viewport: Rect = { x: 0, y: 0, width: 1440, height: 900 };
    const left = guidePanelCollapsedRectOf(viewport, "left");
    expect(left).toEqual({ x: 0, y: 0, width: GUIDE_PANEL_COLLAPSED_WIDTH, height: 900 });
    const right = guidePanelCollapsedRectOf(viewport, "right");
    expect(right).toEqual({
      x: 1440 - GUIDE_PANEL_COLLAPSED_WIDTH,
      y: 0,
      width: GUIDE_PANEL_COLLAPSED_WIDTH,
      height: 900,
    });
  });
});
