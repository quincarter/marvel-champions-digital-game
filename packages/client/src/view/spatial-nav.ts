/**
 * Spatial focus movement: an arrow key or a d-pad press moves focus to the stop that is actually in that direction
 * on screen, from wherever the ring is now (issue #206). Tab and Shift+Tab still walk each screen's stated route
 * (`focus.ts`, `screen-focus.ts`), which stays the predictable, accessible order; the arrows stop following it.
 *
 * Pure over rects, so every screen (the shared `FocusRoute`, the Board, the choice sheet, the mulligan) asks the
 * same question the same way, and the rule is testable without a canvas.
 */

import type { Rect } from "./layout.js";

export type FocusDirection = "up" | "down" | "left" | "right";

export interface SpatialCandidate<K> {
  readonly key: K;
  readonly rect: Rect;
}

/**
 * How much a stop's sideways distance counts against it, relative to its distance straight ahead. Heavier than 1 so
 * the next card in the same row beats a nearer-looking card a row away, which is what a player pressing Right means.
 */
const OFF_AXIS_WEIGHT = 3;

/** Larger than any on-screen distance, so it only ranks stops in the same row or column ahead of every other. */
const OFF_ROW_PENALTY = 100_000;

/**
 * The key of the stop nearest `from` in `direction`, or null when nothing lies that way (focus then stays put: the
 * arrows never wrap, so a press at the edge of the screen does nothing rather than jumping across it).
 *
 * A candidate counts only when its centre is past `from`'s centre in that direction, and its gap across that
 * direction is no larger than how far ahead it is (a 90° cone). Stops that share `from`'s row
 * (or column, for Up and Down) come first; within each group the score is the gap between the two rects along the
 * direction (0 when they overlap) plus `OFF_AXIS_WEIGHT` times the gap across it; ties go to the nearer centre, then to the earlier candidate, so the route order
 * still decides between two stops at the same spot.
 */
export function spatialPick<K>(
  candidates: readonly SpatialCandidate<K>[],
  from: Rect,
  direction: FocusDirection,
): K | null {
  const horizontal = direction === "left" || direction === "right";
  const sign = direction === "right" || direction === "down" ? 1 : -1;
  const fromCentre = centreOf(from);
  let best: { key: K; score: number; centre: number } | null = null;
  for (const candidate of candidates) {
    const rect = candidate.rect;
    const centre = centreOf(rect);
    const ahead = horizontal ? (centre.x - fromCentre.x) * sign : (centre.y - fromCentre.y) * sign;
    if (ahead < 1) continue;
    const along = horizontal
      ? gapBetween(from.x, from.x + from.width, rect.x, rect.x + rect.width)
      : gapBetween(from.y, from.y + from.height, rect.y, rect.y + rect.height);
    const across = horizontal
      ? gapBetween(from.y, from.y + from.height, rect.y, rect.y + rect.height)
      : gapBetween(from.x, from.x + from.width, rect.x, rect.x + rect.width);
    // Outside a 90° cone it is not "that way": Down from a short button must not land on a taller one far across.
    if (across > ahead) continue;
    // A stop that shares the row (or column) always beats one that doesn't: Right means "along this row" first.
    const score = (across > 0 ? OFF_ROW_PENALTY : 0) + along + across * OFF_AXIS_WEIGHT;
    const centreDistance = Math.hypot(centre.x - fromCentre.x, centre.y - fromCentre.y);
    if (!best || score < best.score - 0.5 || (Math.abs(score - best.score) <= 0.5 && centreDistance < best.centre)) {
      best = { key: candidate.key, score, centre: centreDistance };
    }
  }
  return best?.key ?? null;
}

/**
 * One arrow press over a keyed route: the stop `spatialPick` finds from the focused one. With nothing focused yet (or
 * a focused key whose rect is gone), the press lands on the route's first stop, the same place Tab would.
 */
export function spatialStep<K>(
  order: readonly K[],
  rectOf: (key: K) => Rect | null | undefined,
  current: K | null,
  direction: FocusDirection,
): K | null {
  const from = current === null ? null : rectOf(current);
  if (current === null || !from || !order.includes(current)) return order[0] ?? null;
  const candidates: SpatialCandidate<K>[] = [];
  for (const key of order) {
    if (key === current) continue;
    const rect = rectOf(key);
    if (rect) candidates.push({ key, rect });
  }
  return spatialPick(candidates, from, direction) ?? current;
}

function centreOf(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** The empty space between two ranges on one axis; 0 when they overlap. */
function gapBetween(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, bStart - aEnd, aStart - bEnd);
}
