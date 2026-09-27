import { describe, expect, it } from "vitest";
import { guideCalloutLayoutOf } from "./guide-callout-model.js";

const PHONE = { x: 0, y: 0, width: 390, height: 844 };

describe("guideCalloutLayoutOf", () => {
  it("places the callout below the anchor when it fits and preferred is below, arrow pointing up", () => {
    const anchor = { x: 16, y: 120, width: 358, height: 90 };
    const layout = guideCalloutLayoutOf({
      viewport: PHONE,
      anchor,
      width: 358,
      height: 220,
      preferredSide: "below",
    });
    expect(layout.side).toBe("below");
    expect(layout.rect.y).toBeGreaterThan(anchor.y + anchor.height);
    expect(layout.arrowX).not.toBeNull();
  });

  it("places the callout above the anchor when preferred is above and it fits", () => {
    const anchor = { x: 16, y: 700, width: 358, height: 60 };
    const layout = guideCalloutLayoutOf({
      viewport: PHONE,
      anchor,
      width: 358,
      height: 220,
      preferredSide: "above",
    });
    expect(layout.side).toBe("above");
    expect(layout.rect.y + layout.rect.height).toBeLessThanOrEqual(anchor.y);
  });

  it("flips from below to above when below doesn't fit", () => {
    const anchor = { x: 16, y: 750, width: 358, height: 60 };
    const layout = guideCalloutLayoutOf({
      viewport: PHONE,
      anchor,
      width: 358,
      height: 220,
      preferredSide: "below",
    });
    expect(layout.side).toBe("above");
  });

  it("flips from above to below when above doesn't fit", () => {
    const anchor = { x: 16, y: 40, width: 358, height: 60 };
    const layout = guideCalloutLayoutOf({
      viewport: PHONE,
      anchor,
      width: 358,
      height: 220,
      preferredSide: "above",
    });
    expect(layout.side).toBe("below");
  });

  it("clamps to the 16px gutter on every edge", () => {
    const anchor = { x: 370, y: 10, width: 10, height: 10 };
    const layout = guideCalloutLayoutOf({
      viewport: PHONE,
      anchor,
      width: 358,
      height: 220,
      preferredSide: "below",
    });
    expect(layout.rect.x).toBeGreaterThanOrEqual(16);
    expect(layout.rect.x + layout.rect.width).toBeLessThanOrEqual(390 - 16 + 0.001);
    expect(layout.rect.y).toBeGreaterThanOrEqual(16);
    expect(layout.rect.y + layout.rect.height).toBeLessThanOrEqual(844 - 16 + 0.001);
  });

  it("keeps the arrow within the callout's inner width even when the anchor is near an edge", () => {
    const anchor = { x: -20, y: 120, width: 40, height: 40 };
    const layout = guideCalloutLayoutOf({
      viewport: PHONE,
      anchor,
      width: 358,
      height: 220,
      preferredSide: "below",
    });
    expect(layout.arrowX).not.toBeNull();
    expect(layout.arrowX!).toBeGreaterThanOrEqual(layout.rect.x + 20);
    expect(layout.arrowX!).toBeLessThanOrEqual(layout.rect.x + layout.rect.width - 20);
  });

  it("centers near the bottom of the viewport with no arrow when there's no anchor", () => {
    const layout = guideCalloutLayoutOf({
      viewport: PHONE,
      anchor: null,
      width: 358,
      height: 180,
      preferredSide: "below",
    });
    expect(layout.side).toBe("center");
    expect(layout.arrowX).toBeNull();
    expect(layout.rect.x).toBeCloseTo((390 - 358) / 2, 0);
    expect(layout.rect.y + layout.rect.height).toBeLessThanOrEqual(844 - 16 + 0.001);
  });

  it("matches the P03 spotlight-threat shape: callout below a scheme panel anchor", () => {
    const anchor = { x: 16, y: 110, width: 358, height: 96 };
    const layout = guideCalloutLayoutOf({
      viewport: PHONE,
      anchor,
      width: 358,
      height: 260,
      preferredSide: "below",
    });
    expect(layout.side).toBe("below");
  });

  it("matches the P04 paying-for-cards shape: callout above a payment bar anchor", () => {
    const anchor = { x: 0, y: 620, width: 390, height: 60 };
    const layout = guideCalloutLayoutOf({
      viewport: PHONE,
      anchor,
      width: 358,
      height: 200,
      preferredSide: "above",
    });
    expect(layout.side).toBe("above");
  });

  it("still fits within the viewport width when both sides are tight (tall content on a small viewport)", () => {
    const anchor = { x: 100, y: 400, width: 40, height: 40 };
    const layout = guideCalloutLayoutOf({
      viewport: PHONE,
      anchor,
      width: 358,
      height: 700,
      preferredSide: "below",
    });
    expect(layout.rect.width).toBe(358);
    expect(layout.rect.x).toBeGreaterThanOrEqual(16);
  });
});
