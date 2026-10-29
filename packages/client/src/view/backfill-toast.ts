/**
 * The "Building your stats" toast (`scenes/backfill-toast.ts`, #529), as plain data: where it sits and what it says
 * while older games have their card numbers filled in (`progression/stats-backfill.ts`).
 *
 * On a wide screen it sits at the bottom left, above the Title's rank badge and clear of the menu column; on a phone
 * it sits along the bottom, over the rank badge, clear of the menu buttons above. It says that closing it does not
 * stop the work.
 */
import type { BackfillProgress } from "../progression/stats-backfill.js";
import type { Rect } from "./layout.js";

export interface BackfillToastText {
  readonly title: string;
  /** "12 of 40 older games · 30%". */
  readonly count: string;
  /** 0 to 1. */
  readonly fraction: number;
  readonly note: string;
}

/** How long the "up to date" line stays before the toast closes itself. */
export const BACKFILL_DONE_HOLD_MS = 3500;

export function backfillToastTextOf(progress: BackfillProgress): BackfillToastText {
  const fraction = progress.total > 0 ? progress.done / progress.total : 1;
  const percent = Math.round(fraction * 100);
  if (!progress.running) {
    return {
      title: "Your stats are up to date",
      count: `${progress.written} older game${progress.written === 1 ? "" : "s"} added`,
      fraction: 1,
      note: "Open Your stats to see them.",
    };
  }
  return {
    title: "Building your stats",
    count: `${progress.done} of ${progress.total} older games · ${percent}%`,
    fraction,
    note: "You can close this: it keeps going in the background.",
  };
}

export function backfillToastRect(width: number, height: number): Rect {
  const phone = width < 600;
  const margin = phone ? 8 : 24;
  const w = Math.min(420, width - 2 * margin);
  const h = phone ? 100 : 92;
  // A phone: above the footer's links. Wider: above the rank badge, at the left edge.
  const bottom = phone ? 52 : 100;
  return {
    x: phone ? Math.round((width - w) / 2) : margin,
    y: Math.max(0, height - bottom - h),
    width: w,
    height: h,
  };
}
