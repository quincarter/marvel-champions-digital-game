/**
 * The comic reader's "guided view" (`art/README.md`) camera pan for a **spotlight** (unlettered) page whose current
 * panel doesn't fit inside the reading area at the page's own cover-fit scale (`ui/comic-reader.ts`'s
 * `drawSpotlightStep`) — a dense painted spread (MTS's `art/campaigns/mts/pages/`) with break-out figures can be
 * proportioned nothing like the reading area, so cover-fitting the *whole page* and centering on the panel still
 * crops the panel's own art (a head above the throne's own crop window, say). Rather than crop, this covers the
 * *panel itself* to fill the reading area (so the frame never opens up to show blank space) and pans the excess
 * along whichever single axis overflows, from one end of the panel to the other, so every part of the panel is
 * shown at some point over the beat — a "Ken Burns" pan/zoom, not a static crop.
 *
 * Pure so `scenes/campaign/opener.ts` (the only caller driving an actual animation) and `drawSpotlightStep` stay
 * thin and this stays Vitest-tested without a scene.
 */
import type { ComicPanelRect } from "../campaign/story.js";

export interface PanDim {
  readonly width: number;
  readonly height: number;
}

/** Which end of the overflowing axis the pan starts at — "down" starts at the panel's own top, "right" its own left. */
export type PanDirection = "down" | "up" | "left" | "right";

export interface PanPlan {
  readonly scale: number;
  readonly axis: "x" | "y" | "none";
  /** `cropWidth`/`cropHeight` (page-pixel space) fed the target exactly, so the panel always fills the frame. */
  readonly cropWidth: number;
  readonly cropHeight: number;
  /** The overflowing axis's own crop-origin range, in the panel's own local pixel space (0 at the panel's own edge) — equal `from`/`to` when `axis` is `"none"`. */
  readonly from: number;
  readonly to: number;
}

/**
 * Cover-fit scale + crop window size for fitting `outer` into `target` (`art/pictures.ts`'s own `coverFit`,
 * inlined so this module stays free of a `Phaser`-adjacent import for its own sake — it only ever needs the numbers).
 */
function coverFitDims(outer: PanDim, target: PanDim): { scale: number; cropWidth: number; cropHeight: number } {
  const scale = Math.max(target.width / Math.max(1, outer.width), target.height / Math.max(1, outer.height));
  return { scale, cropWidth: target.width / scale, cropHeight: target.height / scale };
}

/**
 * Whether `panel` fits inside `page`'s own cover-fit crop window into `target` — the page-context draw is used
 * as-is (just clamped, never blindly centered past the panel) when it does; the panel is panned to fill `target`
 * on its own when it doesn't (`drawSpotlightStep`'s two branches).
 *
 * Deliberately narrow: only a panel that spans the page's *full width or height* — a full-bleed strip, the actual
 * shape of the MTS bug this module exists for (`01-p1-titan` beat 0, `w: 1500` on a 1500-wide page) — can trigger
 * the pan/full-bleed path, and only on the axis it doesn't already span. Any other panel (an ordinary bordered
 * sub-panel positioned within the page, however tall or narrow — GMW's own `02-p2-order`-style insets) always
 * counts as fitting, even where the page's own crop window is geometrically smaller than it, and keeps the
 * page-context draw's plain clamped-centered crop instead.
 *
 * This is a narrower condition than "the panel's content never gets cropped" would call for — a sub-panel
 * positioned within the page can still lose part of itself to the page-level crop the same way a full-bleed strip
 * can. But *where* a sub-panel's own content actually sits (a GMW inset with dead space at the top of a tall
 * panel, its figures lower down, already reads fine center-clamped) isn't something this module can see, only the
 * page-based `stories/*.ts` rects were already visually checked against. Widening this to every panel that
 * geometrically doesn't fit was tried and it panned GMW's own tall `01-badoon` insets straight past their own
 * figures onto a bare corridor ceiling — worse than the plain crop it replaced. Scoping to the MTS bug's own shape
 * (a full-width or full-height strip) fixes the reported crop without touching any panel whose own page-context
 * draw was already correct.
 */
export function panelFitsInPageCrop(panel: ComicPanelRect, page: PanDim, target: PanDim): boolean {
  const spansWidth = panel.w >= page.width - 0.5;
  const spansHeight = panel.h >= page.height - 0.5;
  // A panel that spans the page on *both* axes (a full-bleed background panel, e.g. GMW's `01-badoon` beat 0)
  // always fits: cover-fitting the page is cover-fitting a panel that equals it, and the crop that a mismatched
  // reading-area aspect then cuts into is atmospheric background, not a figure — the intended, pre-existing look.
  if (spansWidth && spansHeight) return true;
  const { cropWidth, cropHeight } = coverFitDims(page, target);
  if (spansHeight && panel.w > cropWidth + 0.5) return false;
  if (spansWidth && panel.h > cropHeight + 0.5) return false;
  return true;
}

/**
 * The pan plan for covering `target` with `panel`'s own content: cover-fit scale (the larger of the two axis
 * ratios, so the panel always fills the frame, cropping only the overflowing axis), and the crop-origin range the
 * overflowing axis travels across a beat, defaulting to a start at the panel's own top/left. `dir` overrides the
 * direction only when it names the axis that's actually overflowing (a beat that asks to pan "left" on a panel
 * that overflows vertically is a story-authoring mismatch — starting top/left is the safer fallback than ignoring
 * the request outright).
 */
export function planPan(panel: ComicPanelRect, target: PanDim, dir?: PanDirection): PanPlan {
  const { scale, cropWidth, cropHeight } = coverFitDims({ width: panel.w, height: panel.h }, target);
  const xSlack = panel.w - cropWidth > 0.5;
  const ySlack = panel.h - cropHeight > 0.5;
  if (ySlack) {
    const max = panel.h - cropHeight;
    const reversed = dir === "up";
    return { scale, axis: "y", cropWidth, cropHeight, from: reversed ? max : 0, to: reversed ? 0 : max };
  }
  if (xSlack) {
    const max = panel.w - cropWidth;
    const reversed = dir === "left";
    return { scale, axis: "x", cropWidth, cropHeight, from: reversed ? max : 0, to: reversed ? 0 : max };
  }
  return { scale, axis: "none", cropWidth, cropHeight, from: 0, to: 0 };
}

/**
 * The reduced-motion fallback: fit (never cover-cropped) `panel` inside `target`, letterboxed on whichever axis
 * doesn't match — `drawSpotlightContain`'s own geometry, pulled out here so it's covered by this module's own
 * "never crops" tests rather than only exercised through a scene.
 */
export function containFit(
  panel: ComicPanelRect,
  target: PanDim,
): { readonly scale: number; readonly drawWidth: number; readonly drawHeight: number } {
  const scale = Math.min(target.width / Math.max(1, panel.w), target.height / Math.max(1, panel.h));
  return { scale, drawWidth: panel.w * scale, drawHeight: panel.h * scale };
}

/** The absolute page-pixel crop rect for `plan` at progress `t` (0 at `from`, 1 at `to`) — `t` is clamped. */
export function panCropAt(
  panel: ComicPanelRect,
  plan: PanPlan,
  t: number,
): { readonly cropX: number; readonly cropY: number; readonly cropWidth: number; readonly cropHeight: number } {
  const clamped = Math.max(0, Math.min(1, t));
  const local = plan.from + (plan.to - plan.from) * clamped;
  return {
    cropX: panel.x + (plan.axis === "x" ? local : 0),
    cropY: panel.y + (plan.axis === "y" ? local : 0),
    cropWidth: plan.cropWidth,
    cropHeight: plan.cropHeight,
  };
}
