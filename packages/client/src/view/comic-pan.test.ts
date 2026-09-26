import { describe, expect, it } from "vitest";
import { storyFor } from "../campaign/story.js";
import {
  cinematicCameraPlan,
  containFit,
  cropForFrame,
  frameAt,
  lerpFrame,
  needsSpotlightPan,
  panCropAt,
  panelFitsInPageCrop,
  planPan,
} from "./comic-pan.js";

describe("panelFitsInPageCrop", () => {
  it("is true for a panel narrower/shorter than the page's own cover-fit crop window", () => {
    // 1500x1500 page cover-fit into a 1440x718 desktop reading area (the wide/short strip that caused the bug):
    // scale = max(1440/1500, 718/1500) = 0.96, crop window 1500x747.9.
    expect(
      panelFitsInPageCrop(
        { x: 0, y: 355, w: 1500, h: 400 },
        { width: 1500, height: 1500 },
        { width: 1440, height: 718 },
      ),
    ).toBe(true);
  });

  it("is false for MTS p1 beat 1 (h 820) against the same desktop reading area — the actual crop bug", () => {
    expect(
      panelFitsInPageCrop({ x: 0, y: 0, w: 1500, h: 820 }, { width: 1500, height: 1500 }, { width: 1440, height: 718 }),
    ).toBe(false);
  });

  it("is true for a panel spanning the whole page even when the page's own cover-fit crop is smaller than the page — GMW's own full-bleed background panels", () => {
    // 01-badoon beat 0 (`stories/gmw.ts`): the full-bleed starfield behind the bordered insets, panel === page.
    // At the desktop reading area, the page's own cover-fit crop is only 747.9px tall against a 1500px-tall page —
    // smaller than the panel on that axis — but this must still read as "fits," or every GMW full-bleed background
    // panel would wrongly pan across empty sky instead of holding its usual plain centered crop.
    expect(
      panelFitsInPageCrop(
        { x: 0, y: 0, w: 1500, h: 1500 },
        { width: 1500, height: 1500 },
        { width: 1440, height: 718 },
      ),
    ).toBe(true);
  });
});

describe("planPan", () => {
  it("covers the target exactly on the binding axis with no overflow when the panel's own aspect matches", () => {
    const plan = planPan({ x: 0, y: 0, w: 1000, h: 500 }, { width: 800, height: 400 });
    expect(plan.axis).toBe("none");
    expect(plan.cropWidth).toBeCloseTo(1000, 0);
    expect(plan.cropHeight).toBeCloseTo(500, 0);
  });

  it("pans vertically, starting at the panel's own top by default, when width binds and height overflows", () => {
    // MTS p1 beat 0 at the desktop reading area: width binds (scale 0.96), height overflows by ~72px.
    const panel = { x: 0, y: 0, w: 1500, h: 820 };
    const plan = planPan(panel, { width: 1440, height: 718 });
    expect(plan.axis).toBe("y");
    expect(plan.from).toBe(0);
    expect(plan.to).toBeGreaterThan(0);
    expect(plan.to).toBeCloseTo(panel.h - plan.cropHeight, 1);

    const atStart = panCropAt(panel, plan, 0);
    const atEnd = panCropAt(panel, plan, 1);
    // The pan's own start frame includes the panel's very top edge (the head on the throne) — the bug this fixes.
    expect(atStart.cropY).toBe(panel.y);
    // The end frame's own crop bottom reaches the panel's bottom edge (the throne's base).
    expect(atEnd.cropY + atEnd.cropHeight).toBeCloseTo(panel.y + panel.h, 1);
  });

  it("honors an explicit reverse direction that matches the overflowing axis", () => {
    const panel = { x: 0, y: 0, w: 1500, h: 820 };
    const plan = planPan(panel, { width: 1440, height: 718 }, "up");
    expect(plan.from).toBeGreaterThan(plan.to);
    expect(plan.to).toBe(0);
  });

  it("falls back to the axis's own top/left start when the requested direction doesn't match the overflowing axis", () => {
    const panel = { x: 0, y: 0, w: 1500, h: 820 };
    const plan = planPan(panel, { width: 1440, height: 718 }, "left");
    expect(plan.axis).toBe("y");
    expect(plan.from).toBe(0);
  });

  it("pans horizontally, starting at the panel's own left by default, when height binds and width overflows", () => {
    const panel = { x: 0, y: 0, w: 1500, h: 820 };
    // A tall, narrow target: height binds this time.
    const plan = planPan(panel, { width: 300, height: 700 });
    expect(plan.axis).toBe("x");
    expect(plan.from).toBe(0);
    expect(plan.to).toBeGreaterThan(0);
  });
});

describe("panCropAt", () => {
  it("clamps t into 0..1", () => {
    const panel = { x: 10, y: 20, w: 1500, h: 820 };
    const plan = planPan(panel, { width: 1440, height: 718 });
    const beforeStart = panCropAt(panel, plan, -1);
    const afterEnd = panCropAt(panel, plan, 2);
    expect(beforeStart.cropY).toBe(panCropAt(panel, plan, 0).cropY);
    expect(afterEnd.cropY).toBe(panCropAt(panel, plan, 1).cropY);
  });

  it("keeps the non-overflowing axis pinned to the panel's own edge, matching exactly (no drift)", () => {
    const panel = { x: 5, y: 0, w: 1500, h: 820 };
    const plan = planPan(panel, { width: 1440, height: 718 });
    const crop = panCropAt(panel, plan, 0.5);
    expect(crop.cropX).toBe(panel.x);
  });
});

describe("containFit", () => {
  it("never exceeds the target on either axis — the reduced-motion fallback's own 'never crop' guarantee", () => {
    const panel = { x: 0, y: 0, w: 1500, h: 820 };
    const target = { width: 1440, height: 718 };
    const { drawWidth, drawHeight } = containFit(panel, target);
    expect(drawWidth).toBeLessThanOrEqual(target.width + 0.01);
    expect(drawHeight).toBeLessThanOrEqual(target.height + 0.01);
  });
});

// Every unlettered (spotlight) page's own panel, over a beat's pan (or reduced motion's static contain-fit), at
// two representative reading-area sizes (`opener.ts`'s desktop and phone layouts once the header/action bar/dots
// are subtracted). TRORS is excluded: every one of its pages is `lettered` (`story.test.ts` already checks that),
// so it never reaches this module at all — it pans panel-to-panel over `ui/comic-reader.ts`'s own `ComicReaderTween`
// instead, fitting (never cropping) by construction.
const READING_AREAS = [
  { name: "desktop", width: 1440, height: 718 },
  { name: "phone", width: 390, height: 664 },
];

describe("every gmw/mts panel, panned (or reduced-motion contained), shows its own full self", () => {
  for (const campaignId of ["gmw", "mts"]) {
    const story = storyFor(campaignId)!;
    for (const page of story.pages ?? []) {
      for (const [beatIndex, beat] of page.beats.entries()) {
        for (const area of READING_AREAS) {
          const label = `${campaignId}/${page.file}#${beatIndex} @ ${area.name}`;
          const target = { width: area.width, height: area.height };

          it(`${label}: reduced motion never crops (contain-fit stays within the reading area)`, () => {
            const { drawWidth, drawHeight } = containFit(beat.panel, target);
            expect(drawWidth, label).toBeLessThanOrEqual(target.width + 0.01);
            expect(drawHeight, label).toBeLessThanOrEqual(target.height + 0.01);
          });

          if (!panelFitsInPageCrop(beat.panel, { width: page.width, height: page.height }, target)) {
            it(`${label}: the pan's own start/end frames together cover the panel's full overflowing axis`, () => {
              const plan = planPan(beat.panel, target);
              const start = panCropAt(beat.panel, plan, 0);
              const end = panCropAt(beat.panel, plan, 1);
              if (plan.axis === "y") {
                expect(start.cropY, label).toBeCloseTo(beat.panel.y, 1);
                expect(end.cropY + end.cropHeight, label).toBeCloseTo(beat.panel.y + beat.panel.h, 1);
              } else if (plan.axis === "x") {
                expect(start.cropX, label).toBeCloseTo(beat.panel.x, 1);
                expect(end.cropX + end.cropWidth, label).toBeCloseTo(beat.panel.x + beat.panel.w, 1);
              }
              // Every frame of the pan stays within the panel's own bounds (never opens onto blank space past it).
              for (const t of [0, 0.25, 0.5, 0.75, 1]) {
                const crop = panCropAt(beat.panel, plan, t);
                expect(crop.cropX, label).toBeGreaterThanOrEqual(beat.panel.x - 0.5);
                expect(crop.cropY, label).toBeGreaterThanOrEqual(beat.panel.y - 0.5);
                expect(crop.cropX + crop.cropWidth, label).toBeLessThanOrEqual(beat.panel.x + beat.panel.w + 0.5);
                expect(crop.cropY + crop.cropHeight, label).toBeLessThanOrEqual(beat.panel.y + beat.panel.h + 0.5);
              }
            });
          }
        }
      }
    }
  }
});

describe("needsSpotlightPan", () => {
  // The actual "NEXT ▸ stays disabled" bug: `SpotlightAutoPan` (`ui/comic-reader.ts`) used to start a 3.2s tween
  // for *every* beat change regardless of whether the beat had anything to animate, and a tween that redraws the
  // whole scene (including rebuilding the CTA button) every frame for its own full duration could drop a tap that
  // landed between two of those frames. `needsSpotlightPan` is the gate that stops the tween from starting at all
  // once there's nothing for it to do.
  const desktop = { width: 1440, height: 718 };

  it("is false once the page-context draw handles the beat (GMW's own ordinary panel)", () => {
    // 01-badoon beat 2 (`stories/gmw.ts`): fits the page's own crop, so `drawSpotlightPageContext` never reads a
    // pan progress at all.
    expect(needsSpotlightPan({ x: 73, y: 1088, w: 1351, h: 336 }, { width: 1500, height: 1500 }, desktop)).toBe(false);
  });

  it("is false for a full-bleed panel that fills the reading area exactly (no overflow on either axis)", () => {
    const panel = { x: 0, y: 0, w: 1440, h: 718 };
    expect(needsSpotlightPan(panel, { width: panel.w, height: panel.h }, desktop)).toBe(false);
  });

  it("is true for the actual MTS bug shape — a full-width panel taller than the page's own crop window", () => {
    expect(needsSpotlightPan({ x: 0, y: 0, w: 1500, h: 820 }, { width: 1500, height: 1500 }, desktop)).toBe(true);
  });
});

describe("frameAt / lerpFrame / cropForFrame — the cinematic reader's own camera math", () => {
  const target = { width: 1440, height: 718 };
  const source = { width: 1500, height: 1500 };

  it("frameAt(..., 0) and frameAt(..., 1) bracket a panel's own overflow the same way panCropAt's start/end do", () => {
    const panel = { x: 0, y: 0, w: 1500, h: 820 };
    const plan = planPan(panel, target);
    const start = frameAt(panel, plan, 0);
    const end = frameAt(panel, plan, 1);
    const startCrop = cropForFrame(start, target, source);
    const endCrop = cropForFrame(end, target, source);
    expect(startCrop.cropY).toBeCloseTo(panel.y, 1);
    expect(endCrop.cropY + endCrop.cropHeight).toBeCloseTo(panel.y + panel.h, 1);
  });

  it("cropForFrame never opens past the source page's own edges", () => {
    const frame = { cx: -500, cy: -500, scale: 2 };
    const crop = cropForFrame(frame, target, source);
    expect(crop.cropX).toBeGreaterThanOrEqual(0);
    expect(crop.cropY).toBeGreaterThanOrEqual(0);
    expect(crop.cropX + crop.cropWidth).toBeLessThanOrEqual(source.width + 0.01);
    expect(crop.cropY + crop.cropHeight).toBeLessThanOrEqual(source.height + 0.01);
  });

  it("lerpFrame(a, b, 0) is a, lerpFrame(a, b, 1) is b, and it's linear in between", () => {
    const a = { cx: 100, cy: 200, scale: 0.5 };
    const b = { cx: 300, cy: 100, scale: 1.5 };
    expect(lerpFrame(a, b, 0)).toEqual(a);
    expect(lerpFrame(a, b, 1)).toEqual(b);
    const mid = lerpFrame(a, b, 0.5);
    expect(mid.cx).toBeCloseTo(200, 5);
    expect(mid.cy).toBeCloseTo(150, 5);
    expect(mid.scale).toBeCloseTo(1, 5);
  });
});

describe("cinematicCameraPlan", () => {
  const desktop = { width: 1440, height: 718 };

  it("leaves an already-close-to-frame-aspect panel uncapped — MTS p1 beat 0's own 'perfect' pan is unchanged", () => {
    const panel = { x: 0, y: 0, w: 1500, h: 820 };
    const page = { width: 1500, height: 1500 };
    const uncapped = planPan(panel, desktop);
    const plan = cinematicCameraPlan(panel, page, desktop);
    expect(plan.start.scale).toBeCloseTo(uncapped.scale, 5);
    expect(plan.axis).toBe("y");
    // Same start/end y as the uncapped plan: panel top, then panel bottom.
    expect(plan.start.cy).toBeCloseTo(panel.y + uncapped.cropHeight / 2, 1);
    expect(plan.end.cy).toBeCloseTo(panel.y + panel.h - uncapped.cropHeight / 2, 1);
  });

  it("caps a severely mismatched panel's zoom and shows real margin instead of a tight crop", () => {
    // MTS p4-hel's party-photo inset: a near-square panel on a wide desktop reading area covers at 2.4x, over
    // 1.6x its own contain scale — this must pull back rather than zoom in that far.
    const panel = { x: 1320, y: 0, w: 600, h: 480 };
    const page = { width: 1920, height: 960 };
    const uncapped = planPan(panel, desktop);
    const plan = cinematicCameraPlan(panel, page, desktop);
    expect(plan.start.scale).toBeLessThan(uncapped.scale);
    // The capped crop is wider than the panel on the axis that used to match it exactly (no more tight crop there).
    const cappedCropWidth = desktop.width / plan.start.scale;
    expect(cappedCropWidth).toBeGreaterThan(panel.w);
  });

  it("never opens the crop past the page's own edges even when centering a capped, margin-gaining axis", () => {
    // A panel hard against the page's own left edge: centering it with a wide margin must clamp inward, not
    // request page-pixel x < 0.
    const panel = { x: 0, y: 0, w: 300, h: 900 };
    const page = { width: 1920, height: 960 };
    const plan = cinematicCameraPlan(panel, page, { width: 1440, height: 900 });
    const cropWidth = 1440 / plan.start.scale;
    expect(plan.start.cx - cropWidth / 2).toBeGreaterThanOrEqual(-0.01);
  });

  it("honors an explicit reverse direction on whichever axis still overflows after capping", () => {
    const panel = { x: 0, y: 0, w: 1500, h: 820 };
    const page = { width: 1500, height: 1500 };
    const plan = cinematicCameraPlan(panel, page, desktop, "up");
    expect(plan.start.cy).toBeGreaterThan(plan.end.cy);
  });

  it("never pulls back past the page's own cover-fit scale — the actual TRORS bug (a narrow tall panel's own contain scale asked for a crop wider than the page itself, leaving a blank margin)", () => {
    // 01-siege beat 0 (`stories/trors.ts`): a 470×1195 sliver on an 1800×1800 page. Its own contain scale (~0.6)
    // sits below the page's own cover-fit scale (0.8 at this desktop size) — capping to the panel's own contain
    // scale would leave the frame narrower than `target.width`, a visible gap down one side.
    const panel = { x: 0, y: 0, w: 470, h: 1195 };
    const page = { width: 1800, height: 1800 };
    const plan = cinematicCameraPlan(panel, page, desktop);
    const pageCoverScale = Math.max(desktop.width / page.width, desktop.height / page.height);
    expect(plan.start.scale).toBeGreaterThanOrEqual(pageCoverScale - 1e-9);
    // The crop this scale implies never exceeds the page's own width — cropForFrame would otherwise have to
    // clamp it down and leave a gap.
    const cropWidth = desktop.width / plan.start.scale;
    expect(cropWidth).toBeLessThanOrEqual(page.width + 0.01);
  });

  it("never lets a neighbor panel dominate the frame — the actual TRORS bug (03-absorbing-man's own red-flash panel, near the page's right edge, was framed almost entirely on the panel to its own left)", () => {
    // A 375×855 sliver near the page's own right edge: the contain-derived cap alone asks for a crop over 1500px
    // wide (the panel is barely a quarter of it), and clamping that to the page's own bounds pins nearly all of it
    // to the *left* of the panel — reading as centered on the wrong panel even though the target technically stays
    // inside the frame.
    const panel = { x: 1345, y: 45, w: 375, h: 855 };
    const page = { width: 1800, height: 1800 };
    const plan = cinematicCameraPlan(panel, page, desktop);
    const cropWidth = desktop.width / plan.start.scale;
    // The panel itself must occupy at least half the frame's own width — a neighbor may still show as context on
    // the near side, but it can no longer dominate the shot.
    expect(cropWidth).toBeLessThanOrEqual(panel.w * 2 + 0.5);
    // And the panel must still be fully inside the crop, on both axes, at both ends of whatever pan the other
    // axis needs.
    for (const frame of [plan.start, plan.end]) {
      const cw = desktop.width / frame.scale;
      expect(frame.cx - cw / 2).toBeLessThanOrEqual(panel.x + 0.5);
      expect(frame.cx + cw / 2).toBeGreaterThanOrEqual(panel.x + panel.w - 0.5);
    }
  });

  it("leaves a panel whose slack is already reasonable untouched — MTS p4-hel's own party-photo inset stays at its previously-verified framing", () => {
    const panel = { x: 1320, y: 0, w: 600, h: 480 };
    const page = { width: 1920, height: 960 };
    const plan = cinematicCameraPlan(panel, page, desktop);
    const cropWidth = desktop.width / plan.start.scale;
    // Slack here (~237px) is well under the panel's own width (600px) — the neighbor-ratio cap must not engage.
    expect(cropWidth - panel.w).toBeLessThan(panel.w);
  });

  it("never zooms a full-page-width strip past its own exact fit — the actual TRORS bug (05-taskmaster beat 0 cropped its own left-edge captions)", () => {
    // A 1800×460 strip spanning the whole 1800-wide page: containScale is bound by width (0.8 at this desktop
    // size) and already fits it with zero overflow — `CINEMATIC_MAX_ZOOM_RATIO` alone would still ask for 15% more
    // zoom than that, overflowing the one axis that was never supposed to crop at all (there's no more page beyond
    // a panel that already spans its own full width).
    const panel = { x: 0, y: 0, w: 1800, h: 460 };
    const page = { width: 1800, height: 1800 };
    const plan = cinematicCameraPlan(panel, page, desktop);
    expect(plan.axis).not.toBe("x");
    const cropWidth = desktop.width / plan.start.scale;
    expect(cropWidth).toBeGreaterThanOrEqual(panel.w - 0.5);
  });

  it("a panel wide enough to fall to the page's own cover-fit floor starts already showing content near its own edge — the actual TRORS bug (07-red-skull's balloon, on a phone-sized reading area, never entered the frame during a too-narrow panel's default left-to-right pan)", () => {
    // The real panel border only runs to about x=1724, but on a narrow phone target the panel's own extreme aspect
    // (~2:1 landscape on a ~1:1.75 portrait target) forces the neighbor-ratio cap to zoom in far enough that the
    // resulting crop is too narrow to ever reach a balloon sitting away from the panel's own left edge. Widening the
    // panel to the page's own right edge instead drops the camera to the page's own cover-fit floor — wide enough on
    // this axis that the pan's own *start* (not just some later point mid-reveal) already contains the balloon.
    const panel = { x: 570, y: 1140, w: 1230, h: 570 };
    const page = { width: 1800, height: 1800 };
    const phoneTarget = { width: 390, height: 679 };
    const plan = cinematicCameraPlan(panel, page, phoneTarget);
    const balloon = { x: 1145, y: 1138, w: 205, h: 80 };
    const cropWidth = phoneTarget.width / plan.start.scale;
    const cropX = plan.start.cx - cropWidth / 2;
    expect(cropX).toBeLessThanOrEqual(balloon.x + 0.5);
    expect(cropX + cropWidth).toBeGreaterThanOrEqual(balloon.x + balloon.w - 0.5);
  });
});
