import type { Rect } from "./layout.js";

/** One axis: `min` long around `rect`'s centre, shifted to stay inside [lo, hi] (and no longer than it when it cannot fit). */
function spanOf(start: number, length: number, min: number, lo: number, hi: number): readonly [number, number] {
  if (hi - lo <= min) return [lo, hi - lo];
  const size = Math.max(length, min);
  const from = Math.min(Math.max(start + length / 2 - size / 2, lo), hi - size);
  return [from, size];
}

/**
 * The press area for a small drawn control (a close ✕): at least `min` x `min` (the design's touch target), centered
 * on `rect` and shifted to stay inside `bounds` (a header, never a scrolling region). `avoid` lists neighbouring
 * controls: the area stops halfway across the gap to each, so two small controls side by side split the space between
 * them and never overlap. The drawn control and its focus ring stay `rect`; only the press area grows. A rect already
 * `min` wide or tall keeps that size.
 */
export function hitRectAround(rect: Rect, min: number, bounds: Rect, avoid: readonly Rect[] = []): Rect {
  let left = bounds.x;
  let right = bounds.x + bounds.width;
  let top = bounds.y;
  let bottom = bounds.y + bounds.height;
  for (const other of avoid) {
    const rows = other.y < rect.y + rect.height && other.y + other.height > rect.y;
    const columns = other.x < rect.x + rect.width && other.x + other.width > rect.x;
    if (rows && other.x >= rect.x + rect.width) right = Math.min(right, (rect.x + rect.width + other.x) / 2);
    else if (rows && other.x + other.width <= rect.x) left = Math.max(left, (other.x + other.width + rect.x) / 2);
    else if (columns && other.y >= rect.y + rect.height)
      bottom = Math.min(bottom, (rect.y + rect.height + other.y) / 2);
    else if (columns && other.y + other.height <= rect.y) top = Math.max(top, (other.y + other.height + rect.y) / 2);
  }
  const [x, width] = spanOf(rect.x, rect.width, min, left, right);
  const [y, height] = spanOf(rect.y, rect.height, min, top, bottom);
  return { x, y, width, height };
}
