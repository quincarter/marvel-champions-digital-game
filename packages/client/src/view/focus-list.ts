/**
 * Pure helpers for a focus ring that walks the rows or stops of a scrolling column (Trophy Room, Credits, the aspect
 * lessons): where the ring sits, how far to scroll to reveal a stop, and where the page and family jumps land.
 */
import type { Rect } from "./layout.js";

/**
 * A stop's ring rect inside a scrolling `view`: clipped to it while partly in view, so the ring never floats over what
 * sits above or below the column. Wholly out of view it keeps its true place (above or below the column), so the arrow
 * keys still find the neighbour in that direction instead of a 1px sliver at the column's edge.
 */
export function clipToView(rect: Rect, view: Rect): Rect {
  const top = Math.max(rect.y, view.y);
  const bottom = Math.min(rect.y + rect.height, view.y + view.height);
  if (bottom <= top) return rect;
  return { x: rect.x, y: top, width: rect.width, height: bottom - top };
}

/** Pixels to scroll (positive down) to bring `rect` fully into `view`; a stop taller than the view aligns its top. */
export function revealDelta(rect: Rect, view: Rect): number {
  if (rect.y < view.y || rect.height > view.height) return rect.y - view.y;
  const overshoot = rect.y + rect.height - (view.y + view.height);
  return overshoot > 0 ? overshoot : 0;
}

/** PageUp / PageDown: the row `step` places on from `at` (or from the matching end with nothing focused), clamped. */
export function pageTarget(
  rows: readonly number[],
  at: number | null,
  direction: 1 | -1,
  step: number,
): number | undefined {
  if (rows.length === 0) return undefined;
  const here = at === null ? (direction === 1 ? -1 : rows.length) : rows.indexOf(at);
  return rows[Math.min(rows.length - 1, Math.max(0, here + direction * step))];
}

/**
 * LB / RB: forward goes to the first family start after `at` (the last one at the end); back goes to the nearest start
 * before `at` (the first one at the beginning), so from inside a family it goes to that family's own start.
 */
export function familyTarget(starts: readonly number[], at: number | null, direction: 1 | -1): number | undefined {
  const from = at ?? -1;
  if (direction === 1) return starts.find((i) => i > from) ?? starts.at(-1);
  return [...starts].reverse().find((i) => i < from) ?? starts[0];
}
