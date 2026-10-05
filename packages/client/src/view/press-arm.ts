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

/** How long a press may stay down and still be a tap the tracker completes, in ms. */
export const TAP_GESTURE_MS = 1500;

/** What was under a pointer at one moment: the topmost tap control's id, and whether some other object took the hit. */
export interface PressTarget {
  /** The topmost registered tap control at the point, by stable id; null when there is none. */
  readonly id: string | null;
  /**
   * True when the engine's own hit-test returned an object that is not a registered tap control (a scrim, a scroll
   * zone): that object owns the gesture, and the tracker never second-guesses it.
   */
  readonly foreign: boolean;
}

interface Gesture {
  readonly target: PressTarget;
  readonly from: { readonly x: number; readonly y: number };
  readonly at: number;
  readonly touch: boolean;
  readonly stamp: number;
  cancelled: boolean;
  fired: boolean;
}

/**
 * Judges a press by where it went down and came up, not by which game object instance existed at each moment.
 *
 * The bug it exists to prevent: a redraw (a hover, a store update, a resize) destroys and recreates every zone, and
 * Phaser does not hit-test a zone created this frame until the next one. A tap that straddles a redraw therefore
 * reaches a destroyed zone on the way down or no zone on the way up, and is lost, whether the redraw came after the
 * touch began or in the very frame before it. A control is its place and its name, so a gesture is a tap on control
 * X when the pointer went down over X and came up over X, within the tap slop (a touch) and a time limit, whatever
 * zones came and went in between. Framework-free: the caller resolves "what is under this point" from its own
 * registry of controls (`ui/tap.ts`) and passes the answer in.
 *
 * What it will not do: complete a press that began on another control or another screen (the up resolves to a
 * different id, or to none), a press that began over a foreign object, a touch that strayed past the slop (a scroll),
 * a mouse that left the control and came back, or a tap an object handler already completed (`markFired`).
 */
export class TapTracker {
  readonly #gestures = new Map<number, Gesture>();

  /**
   * A pointer went down at `from`. `stamp` is the pointer's own record of that press (Phaser's `pointer.downTime`):
   * a scene that did not see a later press (another scene's overlay took it) must not let its older gesture be
   * completed by that press's release.
   */
  down(
    pointerId: number,
    target: PressTarget,
    from: { x: number; y: number },
    now: number,
    touch: boolean,
    stamp = 0,
  ): void {
    this.#gestures.set(pointerId, { target, from, at: now, touch, stamp, cancelled: false, fired: false });
  }

  /**
   * The pointer moved while down. A touch past the slop is a scroll; a mouse that is no longer over the control it
   * pressed has left it (`PressArm.cancel`'s rule), even if it returns.
   */
  move(pointerId: number, at: { x: number; y: number }, here: PressTarget): void {
    const gesture = this.#gestures.get(pointerId);
    if (!gesture || gesture.cancelled) return;
    if (gesture.touch ? !withinTapSlop(gesture.from, at) : here.id !== gesture.target.id || here.foreign) {
      gesture.cancelled = true;
    }
  }

  /** An object handler completed this pointer's tap itself, so the up must not complete it again. */
  markFired(pointerId: number): void {
    const gesture = this.#gestures.get(pointerId);
    if (gesture) gesture.fired = true;
  }

  /** The pointer came up at `at`. Returns the id of the control to press, or null when this gesture is no tap on one. */
  up(pointerId: number, target: PressTarget, at: { x: number; y: number }, now: number, stamp = 0): string | null {
    const gesture = this.#gestures.get(pointerId);
    this.#gestures.delete(pointerId);
    if (!gesture || gesture.cancelled || gesture.fired || gesture.stamp !== stamp) return null;
    if (gesture.target.foreign || target.foreign) return null;
    if (gesture.target.id === null || target.id !== gesture.target.id) return null;
    if (now - gesture.at > TAP_GESTURE_MS) return null;
    if (gesture.touch && !withinTapSlop(gesture.from, at)) return null;
    return target.id;
  }

  /** Forget a pointer's gesture without completing it. */
  cancel(pointerId: number): void {
    this.#gestures.delete(pointerId);
  }
}
