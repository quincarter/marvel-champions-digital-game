/**
 * Where a tab strip's LB / RB glyphs may not go: the labels at its two ends. An evenly divided strip centres each
 * label in its cell, so the middle 60% of the first and last cells is kept clear and the margins around them are free.
 */

import type { Rect } from "./layout.js";

export function tabEndLabels(strip: Rect, count: number): readonly Rect[] {
  if (count <= 0) return [];
  const cell = strip.width / count;
  const inner = cell * 0.6;
  const at = (index: number): Rect => ({
    x: strip.x + index * cell + (cell - inner) / 2,
    y: strip.y,
    width: inner,
    height: strip.height,
  });
  return count === 1 ? [at(0)] : [at(0), at(count - 1)];
}
