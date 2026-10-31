/**
 * Where the guide's highlight is on screen right now (#552): the ring and the `TRY THIS` stamp glide to each new
 * target rather than jump. Plain state, no Phaser, because every Board draw rebuilds the highlight's own widgets
 * (`scenes/board/guide-mount.ts`'s header): this outlives them, and each fresh widget starts from `place`'s answer.
 *
 * A glide only starts when the target itself changes, named by `key`. A target that merely moved (a hand reflow, the
 * rail collapsing) is followed at once, so the ring never trails behind its card; the same move during a glide just
 * redirects where it lands. After the highlight has been gone for longer than `GUIDE_GLIDE_MEMORY_MS` (the villain
 * phase, a long step with nothing to ring) the next target is shown in place: the old position means nothing by then.
 */
import { motion } from "../tokens.js";
import type { Rect } from "./layout.js";
import { clampedProgress, lerp } from "./motion-math.js";

/** How long the highlight can be gone and still glide from where it was. */
export const GUIDE_GLIDE_MEMORY_MS = 2500;

const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

const sameRect = (a: Rect, b: Rect): boolean =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

export class GuideGlide {
  #key: string | null = null;
  #from: Rect | null = null;
  #to: Rect | null = null;
  #startedAt = 0;
  /** When the highlight last left the screen, `null` while it's showing. */
  #hiddenAt: number | null = null;

  /** Starts the next `place` from `rect` as though the highlight were there: a sheet's stamp picks up from the board. */
  seed(rect: Rect, nowMs: number): void {
    this.#key = null;
    this.#from = rect;
    this.#to = rect;
    this.#startedAt = nowMs;
    this.#hiddenAt = null;
  }

  /**
   * Shows the highlight on `target`, gliding from where it is when `key` names a different target than last time.
   * Returns where to draw it this frame. `animate` false (Reduced motion) always lands on `target`.
   */
  place(key: string, target: Rect, nowMs: number, animate: boolean): Rect {
    const shown = this.recentRect(nowMs);
    const moving = this.remainingMs(nowMs) > 0;
    const newTarget = key !== this.#key;
    this.#key = key;
    this.#hiddenAt = null;
    if (!animate || !shown || (!newTarget && !moving) || sameRect(shown, target)) {
      this.#from = target;
      this.#to = target;
    } else if (newTarget) {
      this.#from = shown;
      this.#to = target;
      this.#startedAt = nowMs;
    } else {
      this.#to = target;
    }
    return this.rectAt(nowMs) ?? target;
  }

  /** Nothing to show this draw. The position is kept, so a target that shows up soon glides from it. */
  hide(nowMs: number): void {
    this.#hiddenAt ??= nowMs;
  }

  /** Drops the position: a resized window has moved everything, so the next target is simply shown. */
  forget(): void {
    this.#key = null;
    this.#from = null;
    this.#to = null;
    this.#hiddenAt = null;
  }

  /** The highlight's rect at `nowMs`, or `null` before anything has been placed. */
  rectAt(nowMs: number): Rect | null {
    if (!this.#from || !this.#to) return null;
    const progress = clampedProgress(nowMs - this.#startedAt, motion.guideGlideMs);
    if (progress === 1) return this.#to;
    const t = easeInOutSine(progress);
    return {
      x: lerp(this.#from.x, this.#to.x, t),
      y: lerp(this.#from.y, this.#to.y, t),
      width: lerp(this.#from.width, this.#to.width, t),
      height: lerp(this.#from.height, this.#to.height, t),
    };
  }

  /** `rectAt`, unless the highlight has been gone too long for its old position to mean anything. */
  recentRect(nowMs: number): Rect | null {
    if (this.#hiddenAt !== null && nowMs - this.#hiddenAt > GUIDE_GLIDE_MEMORY_MS) return null;
    return this.rectAt(nowMs);
  }

  /** Time left in the glide under way, 0 once it has landed. */
  remainingMs(nowMs: number): number {
    if (!this.#from || !this.#to || sameRect(this.#from, this.#to)) return 0;
    return Math.max(0, this.#startedAt + motion.guideGlideMs - nowMs);
  }
}
