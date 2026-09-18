/**
 * The card gesture every card-shaped control shares: a tap acts, a
 * press-and-hold or a right-click inspects, and — in a scrollable row — a
 * sideways drag scrolls.
 *
 * Framework-free so the rules can be tested without a canvas. `ui/hold-target.ts`
 * drives one instance per control from Phaser's pointer events and owns the
 * timer; this class only answers "what does that event mean?".
 *
 * **Why a slop radius rather than "any movement cancels".** A finger is not a
 * mouse. Over a 420 ms hold a fingertip rolls as it flattens and a phone
 * reports that as `touchmove`s a few pixels apart — more on a small, dense
 * screen held in one hand. The first version of this gesture cancelled the
 * hold for good on 8 px of sideways travel (it read as a scroll) and on any
 * `pointerout`, so on a phone a long press on a hand card near its edge, or
 * with an ordinarily unsteady thumb, never opened Inspect at all. iOS allows
 * 10 pt of travel in its own long-press recognizer and Android's touch slop is
 * 8 dp *per axis*; `HOLD_SLOP_PX` sits just above both, measured as a distance
 * from where the press began, and is checked when the timer fires rather than
 * on every event — a wobble that leaves the slop and comes back is still a hold.
 */

/**
 * How long a press has to last before it inspects instead of acting. Below
 * this, a tap is a tap; above it, the player clearly meant to look.
 */
export const INSPECT_HOLD_MS = 420;

/** How far, in CSS pixels, a press may wander from where it began and still be a tap or a hold. */
export const HOLD_SLOP_PX = 12;

export interface HoldGestureOptions {
  /** A control with nothing to inspect never arms a hold; its press is only ever a tap. */
  readonly canInspect: boolean;
  /** Only a control inside a scrollable row turns sideways travel into a drag. */
  readonly canDrag: boolean;
}

type Phase = "idle" | "pressed" | "inspected" | "dragging";

export class HoldGesture {
  readonly #options: HoldGestureOptions;
  #phase: Phase = "idle";
  #downX = 0;
  #downY = 0;

  constructor(options: HoldGestureOptions) {
    this.#options = options;
  }

  /**
   * A press began on the control. `"inspect"`: inspect now (a right-click).
   * `"arm"`: start the hold timer. `"none"`: nothing to inspect, just wait for the release.
   */
  down(x: number, y: number, rightButton: boolean): "inspect" | "arm" | "none" {
    this.#downX = x;
    this.#downY = y;
    this.#phase = "pressed";
    if (!this.#options.canInspect) return "none";
    if (rightButton) {
      this.#phase = "inspected";
      return "inspect";
    }
    return "arm";
  }

  /**
   * The pressed pointer moved. True when this movement is part of a drag —
   * once a gesture reads as a drag it stays one for its whole length, so a
   * hold can't open Inspect out from under a scroll the player is mid-way through.
   */
  move(x: number): boolean {
    if (this.#phase === "dragging") return true;
    if (this.#phase !== "pressed" || !this.#options.canDrag) return false;
    if (Math.abs(x - this.#downX) < HOLD_SLOP_PX) return false;
    this.#phase = "dragging";
    return true;
  }

  /**
   * The hold timer fired. True when the press is still a hold: the same press
   * is still down, it never became a drag, and it is still within the slop of
   * where it began — wherever it wandered in between.
   */
  holdElapsed(x: number, y: number, stillDown: boolean): boolean {
    if (this.#phase !== "pressed") return false;
    if (!stillDown) {
      // Released somewhere this control never heard about (off its edge).
      this.#phase = "idle";
      return false;
    }
    if (Math.hypot(x - this.#downX, y - this.#downY) > HOLD_SLOP_PX) return false;
    this.#phase = "inspected";
    return true;
  }

  /**
   * The press was released on the control. True when that release is a tap:
   * not a hold, not a right-click, not a drag, and not a touch the system took
   * away (`touchcancel` — a notification shade, a native long-press menu),
   * which the player never meant as anything.
   */
  up(canceled: boolean): boolean {
    const tapped = this.#phase === "pressed" && !canceled;
    this.#phase = "idle";
    return tapped;
  }

  /**
   * True while the press is still undecided — it could yet be a tap, a hold or
   * a drag. Once it has resolved (inspected, dragging) it belongs to whatever
   * it became, wherever the pointer is released.
   */
  get undecided(): boolean {
    return this.#phase === "pressed";
  }

  /** True between `down` and `up`. */
  get active(): boolean {
    return this.#phase !== "idle";
  }
}
