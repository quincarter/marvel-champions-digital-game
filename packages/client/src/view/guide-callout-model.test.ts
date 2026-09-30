import { describe, expect, it } from "vitest";
import { hit } from "../tokens.js";
import {
  guideCalloutExitsLayoutOf,
  guideCalloutLayoutOf,
  guideCalloutStopConfirmLayoutOf,
} from "./guide-callout-model.js";

const PHONE = { x: 0, y: 0, width: 390, height: 844 };
const TABLET_PORTRAIT = { x: 0, y: 0, width: 768, height: 1024 };

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

/**
 * `scenes/board/guide-mount.ts` (G11 fix wave 2) shrinks the viewport it hands to `guideCalloutLayoutOf` down
 * to stop just above the hand/action bar, which sit at the bottom of every phone/tablet-portrait tab regardless
 * of which tab is active — these tests exercise that same shape directly on the pure layout function, proving
 * the callout's own math (not just the mount's wiring) keeps it clear of those controls at both sizes named in
 * `docs/guided-mode.md` §4 G11. Found in QA: the waiting-state callout ("Next: The villain phase...") sat flush
 * against the bottom on 390×844, covering End Turn — the very button it was telling the player to press.
 */
describe("guideCalloutLayoutOf — clipped above the hand/action bar", () => {
  it("stays above a 390×844 hand-clipped viewport with no anchor (the waiting/complete callout)", () => {
    const handTop = PHONE.height - 190; // a representative hand + action-bar band
    const clipped = { x: 0, y: 0, width: PHONE.width, height: handTop };
    const layout = guideCalloutLayoutOf({
      viewport: clipped,
      anchor: null,
      width: 358,
      height: 180,
      preferredSide: "below",
    });
    expect(layout.rect.y + layout.rect.height).toBeLessThanOrEqual(handTop);
  });

  it("stays above a 768×1024 tablet-portrait hand-clipped viewport with no anchor", () => {
    const handTop = TABLET_PORTRAIT.height - 220;
    const clipped = { x: 0, y: 0, width: TABLET_PORTRAIT.width, height: handTop };
    const layout = guideCalloutLayoutOf({
      viewport: clipped,
      anchor: null,
      width: 400,
      height: 180,
      preferredSide: "below",
    });
    expect(layout.rect.y + layout.rect.height).toBeLessThanOrEqual(handTop);
  });

  it("flips an anchor that sits inside the hand/action bar itself above the clipped viewport, not over it", () => {
    const handTop = PHONE.height - 190;
    const clipped = { x: 0, y: 0, width: PHONE.width, height: handTop };
    // A step anchored on the action bar (e.g. "Tap End Turn") sits below the clip line entirely.
    const anchor = { x: 20, y: handTop + 20, width: 200, height: 48 };
    const layout = guideCalloutLayoutOf({
      viewport: clipped,
      anchor,
      width: 358,
      height: 220,
      preferredSide: "below",
    });
    expect(layout.side).toBe("above");
    expect(layout.rect.y + layout.rect.height).toBeLessThanOrEqual(handTop);
  });
});

/** Two rects overlap if they share any area — used below to assert the two §3.10 exits never collide. */
function overlaps(a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

describe("guideCalloutExitsLayoutOf", () => {
  const CALLOUT_PAD = 20;
  // 390px phone: `MAX_WIDTH` (400) clamped to `viewport.width - 32`.
  const width = Math.min(400, PHONE.width - 32);
  const rect = { x: (PHONE.width - width) / 2, y: 100, width, height: 260 };
  const rowCenterY = rect.y + 30;

  it("gives both exits a hit area at least hit.target on a side, at the tight 390px phone width", () => {
    const layout = guideCalloutExitsLayoutOf({
      rect,
      pad: CALLOUT_PAD,
      rowCenterY,
      skipLabelWidth: 90,
      stopLabelWidth: 14,
    });
    expect(layout.stop.width).toBeGreaterThanOrEqual(hit.target);
    expect(layout.stop.height).toBeGreaterThanOrEqual(hit.target);
    expect(layout.skip.width).toBeGreaterThanOrEqual(hit.target);
    expect(layout.skip.height).toBeGreaterThanOrEqual(hit.target);
  });

  it("never overlaps Skip and Stop, even at their widest measured label", () => {
    // Widest plausible "Skip this step" rendering at STAMP_TYPE size 10, well within the 390px callout.
    const layout = guideCalloutExitsLayoutOf({
      rect,
      pad: CALLOUT_PAD,
      rowCenterY,
      skipLabelWidth: 110,
      stopLabelWidth: 14,
    });
    expect(overlaps(layout.skip, layout.stop)).toBe(false);
  });

  it("keeps both exits inside the callout's own width", () => {
    const layout = guideCalloutExitsLayoutOf({
      rect,
      pad: CALLOUT_PAD,
      rowCenterY,
      skipLabelWidth: 90,
      stopLabelWidth: 14,
    });
    expect(layout.stop.x + layout.stop.width).toBeLessThanOrEqual(rect.x + rect.width - CALLOUT_PAD + 0.001);
    expect(layout.skip.x).toBeGreaterThanOrEqual(rect.x);
  });

  it("keeps Stop's own rect the same whether or not Skip is measured", () => {
    const withSkip = guideCalloutExitsLayoutOf({
      rect,
      pad: CALLOUT_PAD,
      rowCenterY,
      skipLabelWidth: 90,
      stopLabelWidth: 14,
    });
    const withoutSkip = guideCalloutExitsLayoutOf({
      rect,
      pad: CALLOUT_PAD,
      rowCenterY,
      skipLabelWidth: 0,
      stopLabelWidth: 14,
    });
    expect(withSkip.stop).toEqual(withoutSkip.stop);
  });
});

/** The inline "Stop the tutorial? [Stop] [Keep going]" confirm row (G11 fix wave 2) that replaces the top row
 * once the × has been tapped once — `ui/guide-callout.ts`'s own header. */
describe("guideCalloutStopConfirmLayoutOf", () => {
  const CALLOUT_PAD = 20;
  // 390px phone: `MAX_WIDTH` (400) clamped to `viewport.width - 32`, same as the exits' own tests above.
  const width = Math.min(400, PHONE.width - 32);
  const rect = { x: (PHONE.width - width) / 2, y: 100, width, height: 260 };
  const rowCenterY = rect.y + 30;
  // Representative measured widths for "STOP" and "KEEP GOING" at the callout's own STAMP_TYPE (size 10, all
  // caps) — short enough that this widget never needs to wrap either label.
  const STOP_WIDTH = 30;
  const KEEP_GOING_WIDTH = 68;

  it("gives both buttons a hit area at least hit.target on a side, at the tight 390px phone width", () => {
    const layout = guideCalloutStopConfirmLayoutOf({
      rect,
      pad: CALLOUT_PAD,
      rowCenterY,
      stopLabelWidth: STOP_WIDTH,
      keepGoingLabelWidth: KEEP_GOING_WIDTH,
    });
    expect(layout.stop.width).toBeGreaterThanOrEqual(hit.target);
    expect(layout.stop.height).toBeGreaterThanOrEqual(hit.target);
    expect(layout.keepGoing.width).toBeGreaterThanOrEqual(hit.target);
    expect(layout.keepGoing.height).toBeGreaterThanOrEqual(hit.target);
  });

  it("never overlaps Stop and Keep going", () => {
    const layout = guideCalloutStopConfirmLayoutOf({
      rect,
      pad: CALLOUT_PAD,
      rowCenterY,
      stopLabelWidth: STOP_WIDTH,
      keepGoingLabelWidth: KEEP_GOING_WIDTH,
    });
    expect(overlaps(layout.stop, layout.keepGoing)).toBe(false);
  });

  it("keeps both buttons inside the callout's own width", () => {
    const layout = guideCalloutStopConfirmLayoutOf({
      rect,
      pad: CALLOUT_PAD,
      rowCenterY,
      stopLabelWidth: STOP_WIDTH,
      keepGoingLabelWidth: KEEP_GOING_WIDTH,
    });
    expect(layout.stop.x + layout.stop.width).toBeLessThanOrEqual(rect.x + rect.width - CALLOUT_PAD + 0.001);
    expect(layout.keepGoing.x).toBeGreaterThanOrEqual(rect.x);
  });

  it("leaves enough width for the 'Stop the tutorial?' question at the tight 390px phone width", () => {
    const layout = guideCalloutStopConfirmLayoutOf({
      rect,
      pad: CALLOUT_PAD,
      rowCenterY,
      stopLabelWidth: STOP_WIDTH,
      keepGoingLabelWidth: KEEP_GOING_WIDTH,
    });
    // "Stop the tutorial?" measures well under 150px at the callout's own 12px label type — this asserts the
    // confirm row actually fits on a 390px phone, not just that the two buttons don't collide.
    expect(layout.questionWidth).toBeGreaterThanOrEqual(150);
  });

  it("never returns a negative question width even with unrealistically wide button labels", () => {
    const layout = guideCalloutStopConfirmLayoutOf({
      rect,
      pad: CALLOUT_PAD,
      rowCenterY,
      stopLabelWidth: 200,
      keepGoingLabelWidth: 200,
    });
    expect(layout.questionWidth).toBeGreaterThanOrEqual(0);
  });
});
