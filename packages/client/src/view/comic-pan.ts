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

/**
 * Whether `SpotlightAutoPan` (`ui/comic-reader.ts`) actually has anything to animate for `panel` at `target`: it
 * never does when the page-context draw is used (`panelFitsInPageCrop` true — the panel's crop never reads `t`) or
 * when the panel-fill cover-fit has no overflow on either axis (`planPan`'s `axis: "none"` — every frame of the
 * "pan" would be identical). Gates the tween itself so a beat that never actually moves doesn't still run one: a
 * running tween redraws the whole scene every frame for its own full duration, and a scene that rebuilds its own
 * buttons every frame (`opener.ts`'s `#draw`) can drop a tap that lands between two of those frames — a beat with
 * nothing to animate must never cost a player a working "NEXT ▸".
 */
export function needsSpotlightPan(panel: ComicPanelRect, page: PanDim, target: PanDim, dir?: PanDirection): boolean {
  if (panelFitsInPageCrop(panel, page, target)) return false;
  return planPan(panel, target, dir).axis !== "none";
}

/** A camera's own framing over a page: `cx`/`cy` the page-pixel point centered in the viewport, `scale` the
 * page-to-screen zoom. Lerping this directly (rather than a crop rect) always keeps the viewport's own aspect
 * ratio exact at every intermediate frame — the standard "Ken Burns" camera parameterization. */
export interface CameraFrame {
  readonly cx: number;
  readonly cy: number;
  readonly scale: number;
}

/** The camera frame for `panel`'s own pan `plan` at progress `t` (0 at `from`, 1 at `to`) — `frameAt(..., 0)` is
 * where a beat's camera starts, `frameAt(..., 1)` where its own slow reveal (`axis !== "none"`) ends. */
export function frameAt(panel: ComicPanelRect, plan: PanPlan, t: number): CameraFrame {
  const crop = panCropAt(panel, plan, t);
  return { cx: crop.cropX + crop.cropWidth / 2, cy: crop.cropY + crop.cropHeight / 2, scale: plan.scale };
}

/** Linear interpolation between two camera frames — the cinematic reader's own beat-to-beat camera move. */
export function lerpFrame(from: CameraFrame, to: CameraFrame, t: number): CameraFrame {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    cx: from.cx + (to.cx - from.cx) * clamped,
    cy: from.cy + (to.cy - from.cy) * clamped,
    scale: from.scale + (to.scale - from.scale) * clamped,
  };
}

/** The page-pixel crop rect `frame` sees through a `target`-sized viewport into a `source`-sized page, clamped so
 * the crop window never runs past the page's own edges. */
export function cropForFrame(
  frame: CameraFrame,
  target: PanDim,
  source: PanDim,
): { readonly cropX: number; readonly cropY: number; readonly cropWidth: number; readonly cropHeight: number } {
  // Phaser's own `Image.setCrop` reads the *display* height/width off the frame's own full size once a crop
  // dimension reaches it exactly (verified against Phaser 4.2.1 — a crop as wide as the source frame renders at
  // the frame's own *height* too, ignoring a shorter `cropHeight`, a real bug this hit once the page-cover-scale
  // floor below made a wide panel's own crop exactly as wide as the page). A hair under the source's own edge
  // side-steps it without a visible difference — `crop{Width,Height}` are always at least 1px inside their axis.
  const cropWidth = Math.min(source.width - 0.5, target.width / frame.scale);
  const cropHeight = Math.min(source.height - 0.5, target.height / frame.scale);
  const cropX = Math.max(0, Math.min(source.width - cropWidth, frame.cx - cropWidth / 2));
  const cropY = Math.max(0, Math.min(source.height - cropHeight, frame.cy - cropHeight / 2));
  return { cropX, cropY, cropWidth, cropHeight };
}

/**
 * How far past a panel's own "contain" scale (`containFit` — the zoom that fits the whole panel with no crop on
 * either axis) the cinematic camera (`ui/comic-reader.ts`'s `CinematicDriver`) is ever allowed to zoom in. A panel
 * whose own aspect ratio already reads close to the reading area's (MTS p1's throne-room beat, cover scale barely
 * past contain) is untouched by this — it only bites once cover-fitting a panel proportioned nothing like the
 * frame (a narrow party-photo inset on a wide desktop reading area) would zoom in far enough to read as a crop
 * rather than a close-up. Tuned so p1's own beat 0 (cover/contain ratio ~1.10) stays exactly as it already reads,
 * while p4's party-photo and Hela-throne insets (cover/contain ratio ~1.6) pull back to show real margin around
 * the figures instead. A capped beat still pans (`axis` below) if some overflow remains after the pull-back —
 * just a shorter, gentler one than an uncapped cover-fit would have needed.
 */
export const CINEMATIC_MAX_ZOOM_RATIO = 1.15;

export interface CinematicCameraPlan {
  readonly start: CameraFrame;
  readonly end: CameraFrame;
  readonly axis: "x" | "y" | "none";
}

/**
 * The cinematic reader's own camera plan for `panel` on `page` into `target`: cover-fits the panel same as
 * `planPan`, but caps the zoom at `CINEMATIC_MAX_ZOOM_RATIO` times the panel's own contain scale first. Uncapped,
 * an axis that already matched the panel's own bounds exactly (`planPan`'s "no slack" axis) stays pinned to the
 * panel's own edges the same way; capped, that axis gains real margin instead — centered on the panel, clamped so
 * the crop window never opens past the *page's* own edges (not just the panel's) since the camera may now show
 * more page than the panel alone. `dir` overrides which end of the (still-)overflowing axis, if any, the beat
 * starts at, the same convention as `planPan`.
 */
/**
 * How much of a slack axis's own crop a neighbor is ever allowed to fill, relative to the target panel's own size
 * on that axis — 0.5 means a neighbor may take up at most a third of the frame (the panel occupies at least
 * two-thirds). A panel whose own aspect is nothing like the page's (a portrait sliver near a page edge —
 * `03-absorbing-man`'s own red-flash panel) can otherwise pull the frame so far toward a page edge, chasing a huge
 * contain-derived margin, that the *neighbor* panel ends up filling most of the frame and the target panel reads
 * as an afterthought off to one side, even though it's technically still "in frame." A panel close to a page edge
 * on the side its own slack has to go (`05-taskmaster`'s own left column, 75px from the page's left edge) still
 * has to push most of that slack into the neighbor on its *other* side — this can't fully undo that, only bound
 * how much of it there is; kept tight enough that a lettered neighbor's own printed caption rarely fits whole in
 * the leftover strip.
 */
const CINEMATIC_MAX_NEIGHBOR_RATIO = 0.5;

export function cinematicCameraPlan(
  panel: ComicPanelRect,
  page: PanDim,
  target: PanDim,
  dir?: PanDirection,
): CinematicCameraPlan {
  const coverScale = coverFitDims({ width: panel.w, height: panel.h }, target).scale;
  const containScale = Math.min(target.width / Math.max(1, panel.w), target.height / Math.max(1, panel.h));
  // Never zoom out further than the *page's* own cover-fit scale — the least zoom that can still fill `target`
  // from this page's own pixels at all. A narrow panel's contain scale can fall below that (a tall sliver panel on
  // a squarer page), and pulling back past it would ask for a crop wider/taller than the page itself has, which
  // `cropForFrame`'s own page-edge clamp then answers by simply not filling the frame — a blank margin down one
  // side, the very "box" this reader exists to never show.
  const pageCoverScale = coverFitDims(page, target).scale;
  // A panel that already spans the *whole page* on an axis (a full-width strip, `05-taskmaster` beat 0 — not
  // merely the axis `containScale` happens to be bound by) has nothing left to gain from `CINEMATIC_MAX_ZOOM_RATIO`
  // on that axis: `containScale` being bound there means it's already the exact scale that fits it with zero
  // overflow, and multiplying by the ratio only overshoots into cropping the page's own edge on that axis — the
  // panel spanning the whole width *is* the context, there's no page beyond it to reveal by zooming in further.
  const exactFitCap = Math.min(
    panel.w >= page.width - 0.5 ? target.width / panel.w : Infinity,
    panel.h >= page.height - 0.5 ? target.height / panel.h : Infinity,
  );
  const capScale = Math.min(coverScale, containScale * CINEMATIC_MAX_ZOOM_RATIO, exactFitCap);
  let scale = Math.max(pageCoverScale, capScale);

  // The cap above can still leave an axis with far more slack than `CINEMATIC_MAX_NEIGHBOR_RATIO` allows — the
  // whole point of the contain-derived cap is to *not* zoom in as tight as `coverScale` would, but for a panel
  // whose own aspect is extremely mismatched from the target's, that same cap can ask for a crop several times the
  // panel's own size on the axis contain didn't bind. Zoom in past the cap (never past `coverScale`, which by
  // definition has zero slack on at least one axis) just enough to bring each axis's own slack back under the
  // limit — but only when the *cap* is what picked `scale`. A panel the page-cover floor governs instead (a tall
  // panel spanning nearly the page's own full height, `01-siege` beat 0) is already at the least zoom that avoids
  // a blank margin; zooming in past that to satisfy a "neighbor ratio" would just crop needlessly into a panel
  // that was never competing with a neighbor for attention in the first place — it *is* most of the page.
  if (capScale > pageCoverScale + 1e-9) {
    for (const [panelSize, targetSize] of [
      [panel.w, target.width],
      [panel.h, target.height],
    ] as const) {
      const cropSize = targetSize / scale;
      if (cropSize - panelSize > panelSize * CINEMATIC_MAX_NEIGHBOR_RATIO) {
        const required = targetSize / (panelSize * (1 + CINEMATIC_MAX_NEIGHBOR_RATIO));
        scale = Math.min(coverScale, exactFitCap, Math.max(scale, required));
      }
    }
  }

  const cropWidth = target.width / scale;
  const cropHeight = target.height / scale;

  const axisRange = (
    panelStart: number,
    panelSize: number,
    cropSize: number,
    pageSize: number,
    reversed: boolean,
  ): { readonly lo: number; readonly hi: number; readonly overflow: boolean } => {
    const overflow = panelSize - cropSize > 0.5;
    if (overflow) {
      const lo = panelStart + cropSize / 2;
      const hi = panelStart + panelSize - cropSize / 2;
      return reversed ? { lo: hi, hi: lo, overflow } : { lo, hi, overflow };
    }
    // No overflow: center the crop on the panel, clamped to the *page's* own bounds — the camera may now show
    // more of the page than just the panel, so it must stay inside the page, not the (smaller) panel.
    const center = Math.max(cropSize / 2, Math.min(pageSize - cropSize / 2, panelStart + panelSize / 2));
    return { lo: center, hi: center, overflow };
  };

  const x = axisRange(panel.x, panel.w, cropWidth, page.width, dir === "left");
  const y = axisRange(panel.y, panel.h, cropHeight, page.height, dir === "up");
  const axis = x.overflow ? "x" : y.overflow ? "y" : "none";
  return {
    start: { cx: x.lo, cy: y.lo, scale },
    end: { cx: x.hi, cy: y.hi, scale },
    axis,
  };
}
