import { describe, expect, it } from "vitest";
import {
  GUIDE_PANEL_COLLAPSED_WIDTH,
  GUIDE_PANEL_HEADER_HEIGHT,
  GUIDE_PANEL_SECTION_TOP_PAD,
  guidePanelCollapsedRectOf,
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

const RECT: Rect = { x: 0, y: 0, width: 340, height: 900 };

describe("guidePanelLayoutOf", () => {
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
