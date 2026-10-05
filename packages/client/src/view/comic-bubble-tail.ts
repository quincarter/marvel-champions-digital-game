/**
 * How far a placed speech bubble's tail may reach (`ui/comic-reader.ts`'s `drawPlacedBubble`). A bubble's tail points
 * at its speaker, but a bubble set well away from them would otherwise draw a spike across the picture, so the tail is
 * capped at a proportion of the bubble's own height and keeps its direction: it points at the speaker and stops short.
 * Pure so the geometry is Vitest-tested.
 */
export interface TailRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TailPoint {
  readonly x: number;
  readonly y: number;
}

/** A tail is at most this many bubble heights long, measured from the bubble's edge, and never under `MIN_TAIL`. */
export const MAX_TAIL_HEIGHTS = 0.9;
export const MIN_TAIL = 28;

export function maxTailLength(rect: TailRect): number {
  return Math.max(MIN_TAIL, rect.height * MAX_TAIL_HEIGHTS);
}

/**
 * `target` itself when the tail from `rect`'s edge to it is within `maxTailLength`; otherwise the point that far
 * along the same ray from the edge (the ray runs from the bubble's center to `target`).
 */
export function cappedTailTarget(rect: TailRect, target: TailPoint): TailPoint {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;
  const tx = Math.abs(dx) > 1e-6 ? rect.width / 2 / Math.abs(dx) : Infinity;
  const ty = Math.abs(dy) > 1e-6 ? rect.height / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  // Inside or touching the bubble: no tail is drawn at all, nothing to cap.
  if (!Number.isFinite(t) || t >= 1) return target;
  const edge = { x: cx + dx * t, y: cy + dy * t };
  const length = Math.hypot(target.x - edge.x, target.y - edge.y);
  const cap = maxTailLength(rect);
  if (length <= cap) return target;
  const k = cap / length;
  return { x: edge.x + (target.x - edge.x) * k, y: edge.y + (target.y - edge.y) * k };
}
