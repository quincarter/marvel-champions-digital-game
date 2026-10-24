/**
 * A button that does one thing on a tap and another on a hold (the Board's View: tap reopens the villain phase recap,
 * hold opens the game log; `docs/controller-support.md` decision 11).
 *
 * A hold fires once, the moment `HOLD_MS` has passed with the button still down; a release before then is a tap. A
 * release after the hold fired is neither. Pure, with the clock passed in.
 */

export const HOLD_MS = 400;

export interface HoldTap {
  press(now: number): void;
  /** Call each frame: "hold" once when the press has lasted `HOLD_MS`, else null. */
  poll(now: number): "hold" | null;
  /** The release: "tap" when it came before the hold fired, else null. */
  release(now: number): "tap" | null;
  /** Forget a press in progress (the screen was blocked meanwhile). */
  cancel(): void;
}

export function createHoldTap(holdMs: number = HOLD_MS): HoldTap {
  let downAt: number | null = null;
  let fired = false;
  return {
    press(now) {
      downAt = now;
      fired = false;
    },
    poll(now) {
      if (downAt === null || fired || now - downAt < holdMs) return null;
      fired = true;
      return "hold";
    },
    release(now) {
      const wasDown = downAt !== null;
      const tap = wasDown && !fired && now - downAt! < holdMs;
      downAt = null;
      fired = false;
      return tap ? "tap" : null;
    },
    cancel() {
      downAt = null;
      fired = false;
    },
  };
}
