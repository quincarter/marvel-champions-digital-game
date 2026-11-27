/**
 * The pure numbers behind a pop-up's slide (`dom/popup-sheet.ts`): how far its box travels to be off the screen, and
 * what a drag of its grab handle means when the finger lifts.
 */

/** A drag that has not moved this far (game px) is a tap on the handle, not a drag. */
export const SWIPE_SLOP = 8;
/** The share of the box's height a drag must pass to dismiss it. */
export const DISMISS_SHARE = 0.25;
/** A flick at least this fast (game px per ms), past `FLICK_MIN_DISTANCE`, dismisses at any distance. */
export const FLICK_SPEED = 0.6;
export const FLICK_MIN_DISTANCE = 24;
/** The grab handle's touch target is at least this tall (game px). */
export const HANDLE_TARGET_HEIGHT = 44;
/** The springing back of a released drag. */
export const SNAP_BACK_MS = 160;

/** How far the box slides from its place to have its top at the bottom edge of the screen. */
export function slideDistance(screenHeight: number, boxTop: number | null): number {
  const distance = boxTop === null ? screenHeight : screenHeight - boxTop;
  return Math.max(1, distance);
}

export type SwipeOutcome = "dismiss" | "snap";

/**
 * What a downward drag of `dy` (game px) that lifted at `velocity` (game px per ms, downward positive) does to a box
 * `boxHeight` tall. A pop-up with no back-out path (`canDismiss` false) always springs back.
 */
export function swipeOutcome(options: {
  readonly dy: number;
  readonly boxHeight: number;
  readonly velocity: number;
  readonly canDismiss: boolean;
}): SwipeOutcome {
  const { dy, boxHeight, velocity, canDismiss } = options;
  if (!canDismiss || dy <= 0) return "snap";
  if (dy >= boxHeight * DISMISS_SHARE) return "dismiss";
  if (velocity >= FLICK_SPEED && dy >= FLICK_MIN_DISTANCE) return "dismiss";
  return "snap";
}
