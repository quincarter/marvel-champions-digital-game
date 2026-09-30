/**
 * How far a press may travel and still be a tap, in CSS pixels: roughly the touch slop iOS (10 pt) and Android
 * (8 dp) use before a touch becomes a scroll.
 */
export const TAP_SLOP_PX = 10;

/** True when a release at `to` is close enough to the press at `from` to still be a tap. */
export function withinTapSlop(
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) <= TAP_SLOP_PX;
}

/**
 * Whether a pointer-up counts as a click, for a control that might have just
 * appeared under an already-down pointer.
 *
 * The bug this exists to prevent: the Inspect sheet (and any other overlay
 * launched from a right-click or a press-and-hold, `board/tap-target.ts`,
 * `ui/widgets.ts`'s `McCardTile`, `scenes/choice.ts`'s option rows) is drawn
 * *while the opening gesture's pointer is still down* — a right-click fires
 * on `pointerdown`, and a hold fires from a timer while the finger or button
 * is still down. The sheet's buttons are new Phaser game objects created at
 * whatever screen position the pointer happens to be. Phaser hit-tests the
 * matching `pointerup` against whatever is under the pointer *right now*, not
 * whatever was under it when the gesture began — so the very release that
 * opened the sheet can also register as a click on a button that only exists
 * because the sheet just opened, e.g. playing a hand card the player only
 * meant to inspect.
 *
 * A `PressArm` fixes this the way a real button does: a click is a
 * pointer-down *and* a pointer-up, both observed by this control. A button
 * that appears mid-gesture never sees the down half of that gesture (it
 * wasn't there yet), so its first `up()` is correctly not a click. A normal
 * click that begins after the control exists sees both halves and fires
 * normally — including a fresh click on the very sheet that just opened.
 *
 * Framework-free on purpose, so it can be tested without a canvas or a
 * Phaser scene; every pointer-driven control drives one instance from its own
 * pointerdown/pointerup/pointerout(or leave) handlers.
 *
 * **Tap slop.** A control that also passes the pointer's position to `down`
 * and `up` only counts a release within `TAP_SLOP_PX` of where the press
 * began. A touch pointer rarely fires `pointerout` mid-swipe, so without this
 * a finger scrolling the screen that happened to start and lift on the same
 * control read as a tap on it (reported 2026-09-30: the phone's Scenario
 * stages bar opened at the end of a scroll).
 */
export class PressArm {
  #down = false;
  #at: { readonly x: number; readonly y: number } | null = null;

  /** Call from the control's own `pointerdown`, with the pointer's position to enforce the tap slop. */
  down(x?: number, y?: number): void {
    this.#down = true;
    this.#at = x !== undefined && y !== undefined ? { x, y } : null;
  }

  /**
   * Call from the control's own `pointerout` (mouse) or an equivalent
   * "the press left without releasing here" signal. A press that wanders off
   * the control and comes back must not count as a click on release.
   */
  cancel(): void {
    this.#down = false;
  }

  /**
   * Call from the control's own `pointerup`. Returns whether this pointer-up
   * completes a click, i.e. whether `down()` was called for this same press
   * and not since cancelled or already consumed.
   */
  up(x?: number, y?: number): boolean {
    const at = this.#at;
    const clicked = this.#down && (!at || x === undefined || y === undefined || withinTapSlop(at, { x, y }));
    this.#down = false;
    this.#at = null;
    return clicked;
  }
}
