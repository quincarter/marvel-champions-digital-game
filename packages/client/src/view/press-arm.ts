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
 */
export class PressArm {
  #down = false;

  /** Call from the control's own `pointerdown`. */
  down(): void {
    this.#down = true;
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
  up(): boolean {
    const clicked = this.#down;
    this.#down = false;
    return clicked;
  }
}
