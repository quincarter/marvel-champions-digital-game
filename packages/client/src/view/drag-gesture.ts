/**
 * The pure geometry and timing behind touch/mouse drag-to-scroll —
 * tap-vs-drag discrimination and momentum — kept out of `McVirtualList`
 * (the Phaser class) so it's unit-testable without a canvas, the same
 * boundary `ListScroll` already draws for scroll position.
 *
 * Two small pieces, used together by `ui/virtual-list.ts`:
 * - `DragGesture` tracks one pointer's motion from press to release and
 *   decides "was this a tap or a drag" and the release velocity.
 * - `Momentum` takes that velocity and decays it every frame into a scroll
 *   delta, until it's negligible or the list clamps at an end (the caller
 *   stops it there — see `Momentum.stop`).
 */

export interface DragGestureOptions {
  /** Past this many pixels of total movement, the gesture is a drag, not a tap. RRG has no opinion here; a touch target's own slop is the usual web/mobile default. */
  readonly tapThresholdPx?: number;
}

export interface DragEndResult {
  /** True when the pointer never moved past the tap threshold — the caller should activate whatever was under it. */
  readonly wasTap: boolean;
  /** Signed release velocity, in pixels of scroll per millisecond (matches `Momentum.start`'s input). */
  readonly velocityPxPerMs: number;
}

const DEFAULT_TAP_THRESHOLD_PX = 6;

/**
 * Tracks exactly one pointer at a time. A second pointer going down while the
 * first is still dragging is ignored entirely (`start` returns false) — "a
 * second touch mid-drag shouldn't jump the list."
 */
export class DragGesture {
  readonly #tapThresholdPx: number;
  #active = false;
  #pointerId: number | null = null;
  #startY = 0;
  #lastY = 0;
  #lastTimeMs = 0;
  #velocityPxPerMs = 0;
  #movedPastThreshold = false;

  constructor(options: DragGestureOptions = {}) {
    this.#tapThresholdPx = options.tapThresholdPx ?? DEFAULT_TAP_THRESHOLD_PX;
  }

  get isDragging(): boolean {
    return this.#active;
  }

  /** True once the pointer currently (or most recently) tracked has moved past the tap threshold. */
  get movedPastThreshold(): boolean {
    return this.#movedPastThreshold;
  }

  /** A pointer went down. Returns false (and does nothing) if a different pointer is already being tracked. */
  start(pointerId: number, y: number, timeMs: number): boolean {
    if (this.#active) return false;
    this.#active = true;
    this.#pointerId = pointerId;
    this.#startY = y;
    this.#lastY = y;
    this.#lastTimeMs = timeMs;
    this.#velocityPxPerMs = 0;
    this.#movedPastThreshold = false;
    return true;
  }

  /**
   * The tracked pointer moved. Returns the scroll delta to apply (positive =
   * scroll forward/down — dragging a finger *up* reveals *later* content, the
   * same direction a real scrollbar thumb moves), or null when this isn't the
   * pointer being tracked (including "no drag in progress").
   */
  move(pointerId: number, y: number, timeMs: number): number | null {
    if (!this.#active || pointerId !== this.#pointerId) return null;
    const dy = y - this.#lastY;
    const dt = Math.max(1, timeMs - this.#lastTimeMs);
    this.#velocityPxPerMs = dy / dt;
    this.#lastY = y;
    this.#lastTimeMs = timeMs;
    if (Math.abs(y - this.#startY) > this.#tapThresholdPx) this.#movedPastThreshold = true;
    return -dy;
  }

  /**
   * The tracked pointer was released. Returns null when this isn't the
   * pointer being tracked. Otherwise ends the drag and reports whether it was
   * a tap and the release velocity (for `Momentum.start`).
   */
  end(pointerId: number, _timeMs: number): DragEndResult | null {
    if (!this.#active || pointerId !== this.#pointerId) return null;
    const result: DragEndResult = { wasTap: !this.#movedPastThreshold, velocityPxPerMs: -this.#velocityPxPerMs };
    this.#active = false;
    this.#pointerId = null;
    return result;
  }

  /** Drops the tracked pointer without reporting a result — the pointer left the canvas, or the list was rebuilt mid-drag. */
  cancel(): void {
    this.#active = false;
    this.#pointerId = null;
  }
}

export interface MomentumOptions {
  /** Fraction of velocity shed per millisecond (an exponential-ish decay, applied as `v *= max(0, 1 - decayPerMs*dt)`). Higher decays faster. */
  readonly decayPerMs?: number;
  /** Below this speed (px/ms) momentum is considered stopped. */
  readonly minVelocityPxPerMs?: number;
}

const DEFAULT_DECAY_PER_MS = 0.006;
const DEFAULT_MIN_VELOCITY = 0.02;

/**
 * A decaying scroll velocity after a flick. `tick` is called once per frame
 * with the elapsed time and returns the pixel delta to apply that frame;
 * `stop` is what the caller reaches for the instant a scroll hits an end (a
 * `ListScroll.scrollByPx` that returned false, i.e. clamped) — momentum
 * doesn't keep "pushing on the wall" for its own remaining decay.
 */
export class Momentum {
  readonly #decayPerMs: number;
  readonly #minVelocityPxPerMs: number;
  #velocityPxPerMs = 0;

  constructor(options: MomentumOptions = {}) {
    this.#decayPerMs = options.decayPerMs ?? DEFAULT_DECAY_PER_MS;
    this.#minVelocityPxPerMs = options.minVelocityPxPerMs ?? DEFAULT_MIN_VELOCITY;
  }

  get active(): boolean {
    return Math.abs(this.#velocityPxPerMs) > this.#minVelocityPxPerMs;
  }

  /** Begins coasting at this release velocity (px/ms, signed — `DragGesture.end`'s `velocityPxPerMs`). Below the minimum, momentum simply never starts. */
  start(velocityPxPerMs: number): void {
    this.#velocityPxPerMs = Math.abs(velocityPxPerMs) > this.#minVelocityPxPerMs ? velocityPxPerMs : 0;
  }

  stop(): void {
    this.#velocityPxPerMs = 0;
  }

  /** Advances by `dtMs`, decaying velocity, and returns the scroll delta (px) for this tick — 0 once stopped. */
  tick(dtMs: number): number {
    if (!this.active) {
      this.#velocityPxPerMs = 0;
      return 0;
    }
    const delta = this.#velocityPxPerMs * dtMs;
    const decayFactor = Math.max(0, 1 - this.#decayPerMs * dtMs);
    this.#velocityPxPerMs *= decayFactor;
    if (Math.abs(this.#velocityPxPerMs) <= this.#minVelocityPxPerMs) this.#velocityPxPerMs = 0;
    return delta;
  }
}

export interface AxisDragMove {
  readonly axis: "vertical" | "horizontal";
  /** The scroll delta to apply along the locked axis (same sign convention as `DragGesture.move`: positive = scroll forward). */
  readonly delta: number;
}

export interface AxisDragEndResult {
  readonly wasTap: boolean;
  /** Null when it was a tap — there is no axis to have coasted along. */
  readonly axis: "vertical" | "horizontal" | null;
  readonly velocityPxPerMs: number;
}

/**
 * `DragGesture` generalized to two axes at once — the pack-shelf roster (W2b):
 * a vertical drag over the roster scrolls the shelves, a horizontal drag over
 * one scrolls that shelf, and a diagonal swipe must commit to *one* axis
 * rather than scrolling both, exactly as a real trackpad/touch scroller does.
 *
 * The axis is decided once, from whichever of the total x/y displacement is
 * larger the first time either exceeds the tap threshold, and is locked for
 * the rest of the gesture — the same "decide once, don't re-litigate every
 * frame" rule that keeps a slightly diagonal swipe from juddering between axes.
 * Before that decision, `move` reports nothing to apply (not a guess): the
 * caller simply hasn't started scrolling yet.
 */
export class AxisDragGesture {
  readonly #tapThresholdPx: number;
  #active = false;
  #pointerId: number | null = null;
  #startX = 0;
  #startY = 0;
  #lastX = 0;
  #lastY = 0;
  #lastTimeMs = 0;
  #velocityX = 0;
  #velocityY = 0;
  #axis: "vertical" | "horizontal" | null = null;

  constructor(options: DragGestureOptions = {}) {
    this.#tapThresholdPx = options.tapThresholdPx ?? DEFAULT_TAP_THRESHOLD_PX;
  }

  get isDragging(): boolean {
    return this.#active;
  }

  /** The locked axis, or null before the gesture has moved past the threshold. */
  get axis(): "vertical" | "horizontal" | null {
    return this.#axis;
  }

  start(pointerId: number, x: number, y: number, timeMs: number): boolean {
    if (this.#active) return false;
    this.#active = true;
    this.#pointerId = pointerId;
    this.#startX = x;
    this.#startY = y;
    this.#lastX = x;
    this.#lastY = y;
    this.#lastTimeMs = timeMs;
    this.#velocityX = 0;
    this.#velocityY = 0;
    this.#axis = null;
    return true;
  }

  /** Null when this isn't the tracked pointer, or the axis isn't locked yet (nothing to apply). */
  move(pointerId: number, x: number, y: number, timeMs: number): AxisDragMove | null {
    if (!this.#active || pointerId !== this.#pointerId) return null;
    const dx = x - this.#lastX;
    const dy = y - this.#lastY;
    const dt = Math.max(1, timeMs - this.#lastTimeMs);
    this.#velocityX = dx / dt;
    this.#velocityY = dy / dt;
    this.#lastX = x;
    this.#lastY = y;
    this.#lastTimeMs = timeMs;

    if (this.#axis === null) {
      const totalX = x - this.#startX;
      const totalY = y - this.#startY;
      if (Math.abs(totalX) <= this.#tapThresholdPx && Math.abs(totalY) <= this.#tapThresholdPx) return null;
      this.#axis = Math.abs(totalX) > Math.abs(totalY) ? "horizontal" : "vertical";
    }
    return this.#axis === "horizontal" ? { axis: "horizontal", delta: -dx } : { axis: "vertical", delta: -dy };
  }

  end(pointerId: number, _timeMs: number): AxisDragEndResult | null {
    if (!this.#active || pointerId !== this.#pointerId) return null;
    const axis = this.#axis;
    const velocityPxPerMs = axis === "horizontal" ? -this.#velocityX : axis === "vertical" ? -this.#velocityY : 0;
    this.#active = false;
    this.#pointerId = null;
    this.#axis = null;
    return { wasTap: axis === null, axis, velocityPxPerMs };
  }

  cancel(): void {
    this.#active = false;
    this.#pointerId = null;
    this.#axis = null;
  }
}

/** Whether a point sits inside a rect — the "clip to the viewport" test both the drag/tap logic and `McButton`'s clip option share. */
export function pointInRect(
  x: number,
  y: number,
  rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}
