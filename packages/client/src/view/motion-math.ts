/**
 * The arithmetic every timed Board motion shares: clamping "how far along is
 * this" into [0, 1], and interpolating between a from-value and a to-value.
 *
 * Nothing here is specific to one kind of motion — it is what `phase-wipe.ts`,
 * `status-motion.ts`, `hp-motion.ts`, `threat-motion.ts` and `motion.ts` all
 * reach for to recreate a motion already partway along after a redraw, since
 * every Board draw tears down and rebuilds the display list
 * (`scenes/board/motion.ts`'s own file comment).
 */

/**
 * 0 at `elapsedMs <= 0`, 1 at `elapsedMs >= durationMs`, linear between.
 * `durationMs <= 0` is always 1 (nothing to animate, already at the end).
 */
export function clampedProgress(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1;
  if (elapsedMs <= 0) return 0;
  if (elapsedMs >= durationMs) return 1;
  return elapsedMs / durationMs;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
