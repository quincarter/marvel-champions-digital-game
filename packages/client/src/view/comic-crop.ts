/**
 * Cover-fits a `RunPageCrop` (`view/campaign-run-model.ts`) into a target rect, biasing the crop window toward the
 * union's own constituent panels rather than its bare geometric center. A plain centered cover-fit is fine when a
 * page's content fills its whole bounding box (GMW's `01-badoon`), but a page split across two issues (`02-museum`,
 * "the alarm cutting the lights") has a genuinely blank/blacked-out gap between the two panels an issue actually
 * wants shown — center it blind and a narrow target column crops straight into that gap instead of either panel.
 *
 * Pure so `scenes/campaign/run.ts`'s `drawPageCrop` (the only caller so far) stays thin and this stays Vitest-
 * tested without a scene.
 */
import { coverFit } from "../art/pictures.js";
import type { ComicPanelRect } from "../campaign/story.js";
import type { RunPageCrop } from "./campaign-run-model.js";

export interface CoverCrop {
  readonly scale: number;
  /** Page-pixel space (absolute, not relative to `crop.rect`). */
  readonly cropX: number;
  readonly cropY: number;
  readonly cropWidth: number;
  readonly cropHeight: number;
}

interface Interval {
  readonly start: number;
  readonly end: number;
}

function overlap(a: Interval, b: Interval): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

/**
 * The offset (0 to `axisMax - windowSize`) for a `windowSize`-wide window along one axis that covers the most
 * total length of `intervals` — tried at a handful of candidate offsets (each interval's own start, end, and
 * center, clamped into range) rather than every integer offset, since the true optimum for a set of intervals
 * always sits at one of a interval's own edges.
 */
function bestOffset(intervals: readonly Interval[], windowSize: number, axisMax: number): number {
  const maxOffset = Math.max(0, axisMax - windowSize);
  if (intervals.length === 0 || maxOffset === 0) return maxOffset / 2;
  const clamp = (v: number): number => Math.max(0, Math.min(maxOffset, v));
  const candidates = new Set<number>([0, maxOffset]);
  for (const interval of intervals) {
    candidates.add(clamp(interval.start));
    candidates.add(clamp(interval.end - windowSize));
    candidates.add(clamp((interval.start + interval.end) / 2 - windowSize / 2));
  }
  const center = maxOffset / 2;
  let best = center;
  let bestScore = -1;
  for (const candidate of candidates) {
    const window: Interval = { start: candidate, end: candidate + windowSize };
    const score = intervals.reduce((sum, interval) => sum + overlap(interval, window), 0);
    // A tie (e.g. one beat spanning the whole union, every offset covering it equally) keeps whichever candidate
    // sits closest to plain center — same result a bare centered cover-fit would give when there's no real gap to
    // dodge, rather than an arbitrary sideways nudge that only ties happened to reach first.
    if (score > bestScore || (score === bestScore && Math.abs(candidate - center) < Math.abs(best - center))) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

/** `crop.rect` cover-fit into `target`, its crop window nudged toward `crop.beats` on whichever axis has slack. */
export function coverCropFavoringBeats(
  crop: RunPageCrop,
  target: { readonly width: number; readonly height: number },
): CoverCrop {
  const fit = coverFit({ width: crop.rect.w, height: crop.rect.h }, target);
  const xSlack = crop.rect.w - fit.cropWidth > 0.5;
  const ySlack = crop.rect.h - fit.cropHeight > 0.5;
  const toLocalX = (rect: ComicPanelRect): Interval => ({
    start: rect.x - crop.rect.x,
    end: rect.x + rect.w - crop.rect.x,
  });
  const toLocalY = (rect: ComicPanelRect): Interval => ({
    start: rect.y - crop.rect.y,
    end: rect.y + rect.h - crop.rect.y,
  });
  const localX = xSlack ? bestOffset(crop.beats.map(toLocalX), fit.cropWidth, crop.rect.w) : fit.cropX;
  const localY = ySlack ? bestOffset(crop.beats.map(toLocalY), fit.cropHeight, crop.rect.h) : fit.cropY;
  return {
    scale: fit.scale,
    cropX: crop.rect.x + localX,
    cropY: crop.rect.y + localY,
    cropWidth: fit.cropWidth,
    cropHeight: fit.cropHeight,
  };
}
