/**
 * Where the guide's highlight is on screen right now (#552): the ring and the `TRY THIS` stamp glide to each new
 * target rather than jump. Plain state, no Phaser, because every Board draw rebuilds the highlight's own widgets
 * (`scenes/board/guide-mount.ts`'s header): this outlives them, and each fresh widget starts from `place`'s answer.
 *
 * A glide only starts when the target itself changes, named by `key`. A target that merely moved (a hand reflow, the
 * rail collapsing) is followed at once, so the ring never trails behind its card; the same move during a glide just
 * redirects where it lands. After the highlight has been gone for longer than `GUIDE_GLIDE_MEMORY_MS` (the villain
 * phase, a long step with nothing to ring) the next target is shown in place: the old position means nothing by then.
 *
 * A next target sitting on top of the last one has nowhere to glide (Black Cat's card in the hand, then Peter Parker's
 * Scientist tile in the same slot of the payment table), and a move that small reads as a jump. The highlight fades out
 * instead, leaves the table undimmed for a moment to show what the press did, and fades in on the new target.
 */
import { motion } from "../tokens.js";
import type { Rect } from "./layout.js";
import { clampedProgress, lerp } from "./motion-math.js";

/** How long the highlight can be gone and still glide from where it was. */
export const GUIDE_GLIDE_MEMORY_MS = 2500;

const easeInOutSine = (t: number): number => (1 - Math.cos(Math.PI * t)) / 2;

const sameRect = (a: Rect, b: Rect): boolean =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/** How much of the smaller rect the two share before a glide between them stops reading as a move. */
const ON_TOP_SHARE = 1 / 3;

const onTopOfEachOther = (a: Rect, b: Rect): boolean => {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (width <= 0 || height <= 0) return false;
  return width * height >= ON_TOP_SHARE * Math.min(a.width * a.height, b.width * b.height);
};

const fadeTotalMs = (): number => motion.guideFadeMs * 2 + motion.guideFadeHoldMs;

export class GuideGlide {
  #key: string | null = null;
  #from: Rect | null = null;
  #to: Rect | null = null;
  #startedAt = 0;
  /** True while this move is the fade between two targets on top of each other, rather than a glide. */
  #fading = false;
  /** When the highlight last left the screen, `null` while it's showing. */
  #hiddenAt: number | null = null;

  /** Starts the next `place` from `rect` as though the highlight were there: a sheet's stamp picks up from the board. */
  seed(rect: Rect, nowMs: number): void {
    this.#key = null;
    this.#from = rect;
    this.#to = rect;
    this.#startedAt = nowMs;
    this.#fading = false;
    this.#hiddenAt = null;
  }

  /**
   * Shows the highlight on `target`, gliding from where it is when `key` names a different target than last time.
   * Returns where to draw it this frame. `animate` false (Reduced motion) always lands on `target`. `fades` false keeps
   * a glide even onto an overlapping target: a sheet's small stamp reads as moving across a short way.
   */
  place(key: string, target: Rect, nowMs: number, animate: boolean, fades = true): Rect {
    const shown = this.recentRect(nowMs);
    const moving = this.remainingMs(nowMs) > 0;
    const newTarget = key !== this.#key;
    this.#key = key;
    this.#hiddenAt = null;
    if (!animate || !shown || (!newTarget && !moving)) {
      this.#from = target;
      this.#to = target;
      this.#fading = false;
    } else if (moving && (this.#fading || !newTarget)) {
      // Under way: land on `target` instead. A fade never restarts, so a quick player can't keep the table lit.
      this.#to = target;
    } else {
      this.#from = shown;
      this.#to = target;
      this.#startedAt = nowMs;
      this.#fading = fades && onTopOfEachOther(shown, target);
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
    this.#fading = false;
    this.#hiddenAt = null;
  }

  /** The highlight's rect at `nowMs`, or `null` before anything has been placed. */
  rectAt(nowMs: number): Rect | null {
    if (!this.#from || !this.#to) return null;
    if (this.#fading) return nowMs - this.#startedAt < fadeTotalMs() / 2 ? this.#from : this.#to;
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

  /** How opaque the highlight is at `nowMs`: 1 except through a fade. */
  alphaAt(nowMs: number): number {
    if (!this.#fading) return 1;
    const elapsed = nowMs - this.#startedAt;
    const fadeOut = clampedProgress(elapsed, motion.guideFadeMs);
    const fadeIn = clampedProgress(elapsed - motion.guideFadeMs - motion.guideFadeHoldMs, motion.guideFadeMs);
    return easeInOutSine(fadeOut < 1 ? 1 - fadeOut : fadeIn);
  }

  /** `rectAt`, unless the highlight has been gone too long for its old position to mean anything. */
  recentRect(nowMs: number): Rect | null {
    if (this.#hiddenAt !== null && nowMs - this.#hiddenAt > GUIDE_GLIDE_MEMORY_MS) return null;
    return this.rectAt(nowMs);
  }

  /** Time left in the glide under way, 0 once it has landed. */
  remainingMs(nowMs: number): number {
    if (!this.#from || !this.#to) return 0;
    if (this.#fading) return Math.max(0, this.#startedAt + fadeTotalMs() - nowMs);
    if (sameRect(this.#from, this.#to)) return 0;
    return Math.max(0, this.#startedAt + motion.guideGlideMs - nowMs);
  }
}
