/**
 * Where the coach card goes (`scenes/coach.ts`). It's non-modal, so it must sit clear of what it's pointing at:
 * beside the anchor on a wide screen, above or below it on a narrow one, or in a corner when there's no anchor.
 */
import type { Rect } from "../layout.js";

export const COACH_MARGIN = 16;
export const COACH_MAX_WIDTH = 380;
/** Below this width the card spans the screen and goes above or below its anchor rather than beside it. */
export const COACH_NARROW = 640;
/** The top bar every screen draws; a corner card starts below it. */
const TOP_BAR = 56;

export type CoachCorner = "topRight" | "bottomRight" | "bottomLeft" | "topLeft";

export function coachCardWidth(viewport: Rect): number {
  return Math.min(COACH_MAX_WIDTH, viewport.width - COACH_MARGIN * 2);
}

const clamp = (value: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, value));

export function coachCardRect(
  viewport: Rect,
  height: number,
  anchor: Rect | null,
  corner: CoachCorner = "bottomRight",
): Rect {
  const width = coachCardWidth(viewport);
  const left = viewport.x + COACH_MARGIN;
  const right = viewport.x + viewport.width - COACH_MARGIN - width;
  const top = viewport.y + TOP_BAR;
  const bottom = viewport.y + viewport.height - COACH_MARGIN - height;
  const maxY = Math.max(top, bottom);
  if (!anchor) {
    const x = corner === "topLeft" || corner === "bottomLeft" ? left : right;
    const y = corner === "topLeft" || corner === "topRight" ? top : maxY;
    return { x, y, width, height };
  }
  const narrow = viewport.width < COACH_NARROW;
  const anchorMidY = anchor.y + anchor.height / 2;
  if (narrow) {
    // Above the anchor when it's in the lower half of the screen, below it otherwise.
    const inLowerHalf = anchorMidY > viewport.y + viewport.height / 2;
    const y = inLowerHalf ? anchor.y - COACH_MARGIN / 2 - height : anchor.y + anchor.height + COACH_MARGIN / 2;
    return { x: viewport.x + (viewport.width - width) / 2, y: clamp(y, top, maxY), width, height };
  }
  // Beside the anchor, on whichever side has more room, level with its middle.
  const roomLeft = anchor.x - viewport.x;
  const roomRight = viewport.x + viewport.width - (anchor.x + anchor.width);
  let x: number;
  if (roomRight >= width + COACH_MARGIN * 2 || roomRight >= roomLeft) {
    x = roomRight >= width + COACH_MARGIN * 2 ? anchor.x + anchor.width + COACH_MARGIN : right;
  } else {
    x = roomLeft >= width + COACH_MARGIN * 2 ? anchor.x - COACH_MARGIN - width : left;
  }
  // An anchor as wide as the screen (the hand, the action bar) leaves no side: go above or below instead.
  const overlapsX = x < anchor.x + anchor.width && x + width > anchor.x;
  if (overlapsX) {
    const inLowerHalf = anchorMidY > viewport.y + viewport.height / 2;
    const y = inLowerHalf ? anchor.y - COACH_MARGIN / 2 - height : anchor.y + anchor.height + COACH_MARGIN / 2;
    return { x: right, y: clamp(y, top, maxY), width, height };
  }
  return { x, y: clamp(anchorMidY - height / 2, top, maxY), width, height };
}
