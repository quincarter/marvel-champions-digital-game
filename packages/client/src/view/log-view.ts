/**
 * The game log's scroll position, and which lines it puts on screen.
 *
 * The Board clears its display list and redraws on every change, so a scroll
 * position cannot live in a game object: a rexUI `GridTable` would have had to
 * be detached from every sweep, the way the Title screen keeps its DOM seed
 * field alive, and would still need its offset restored on every resize. So
 * the position lives here instead, the same shape as the hand's `HandScroll`,
 * and the scene draws only the lines this module says are visible — which is
 * the virtualization: 400 retained lines, a dozen live `Text` objects.
 *
 * Two decisions worth knowing:
 *  - **The view is anchored to a line id, not to an index or a pixel offset.**
 *    The log drops its oldest lines once it holds 400 (`log-lines.ts`), and an
 *    index would silently shift the view by however many lines were trimmed.
 *  - **Scrolling snaps to whole lines.** A log is read line by line, a
 *    half-cut line helps nobody, and whole lines need no clipping mask.
 *
 * With no anchor the view follows the newest line, the way a log should while
 * the player isn't looking back. Scrolling up anchors it; new lines then arrive
 * below without moving what the player is reading, and scrolling back to the
 * bottom (or "jump to latest") follows again.
 */

export interface LogWindow {
  /** Index of the first line on screen. */
  readonly start: number;
  /** One past the last line on screen. */
  readonly end: number;
}

/** What the scene measured this draw. */
export interface LogMeasure {
  readonly ids: readonly string[];
  /** Each line's drawn height at the panel's current width, in pixels. */
  readonly heights: readonly number[];
  /** Room for lines in the panel, in pixels. */
  readonly viewHeight: number;
}

const EMPTY: LogWindow = { start: 0, end: 0 };

/**
 * The most lines that fit, ending at `last` and reaching upward. `last` is
 * always included, even when it alone is taller than the view — a line that
 * doesn't fit is still better shown than skipped.
 */
export function windowEndingAt(heights: readonly number[], viewHeight: number, last: number): LogWindow {
  if (heights.length === 0) return EMPTY;
  const end = Math.min(heights.length, Math.max(1, last + 1));
  let start = end - 1;
  let used = heights[start]!;
  while (start > 0 && used + heights[start - 1]! <= viewHeight) {
    start -= 1;
    used += heights[start]!;
  }
  return { start, end };
}

/** The most lines that fit, starting at `first` and reaching downward. */
export function windowStartingAt(heights: readonly number[], viewHeight: number, first: number): LogWindow {
  if (heights.length === 0) return EMPTY;
  const start = Math.min(heights.length - 1, Math.max(0, first));
  let end = start + 1;
  let used = heights[start]!;
  while (end < heights.length && used + heights[end]! <= viewHeight) {
    used += heights[end]!;
    end += 1;
  }
  return { start, end };
}

/** The highest a scrolled-up view may go: the window that begins at the first line, named by its last line. */
const earliestLast = (measure: LogMeasure): number => windowStartingAt(measure.heights, measure.viewHeight, 0).end - 1;

export class LogScroll {
  /** The id of the bottom line on screen, or null to follow the newest line. */
  #anchor: string | null = null;

  get following(): boolean {
    return this.#anchor === null;
  }

  windowFor(measure: LogMeasure): LogWindow {
    if (measure.heights.length === 0) return EMPTY;
    return windowEndingAt(measure.heights, measure.viewHeight, this.#lastIndex(measure));
  }

  /**
   * Moves the view by whole lines; negative reveals older lines. Returns true
   * when the view actually moved, so a wheel tick at either end redraws nothing.
   */
  scrollBy(lines: number, measure: LogMeasure): boolean {
    const count = measure.heights.length;
    if (count === 0 || lines === 0) return false;
    const last = Math.min(count - 1, Math.max(earliestLast(measure), this.#lastIndex(measure) + lines));
    const anchor = last >= count - 1 ? null : (measure.ids[last] ?? null);
    const moved = anchor !== this.#anchor;
    this.#anchor = anchor;
    return moved;
  }

  /** Back to following the newest line. Returns true when that changed anything. */
  follow(): boolean {
    const moved = this.#anchor !== null;
    this.#anchor = null;
    return moved;
  }

  /** How many lines sit below the view — what "jump to latest" would reveal. */
  newerThanView(measure: LogMeasure): number {
    if (measure.heights.length === 0) return 0;
    return measure.heights.length - 1 - this.#lastIndex(measure);
  }

  #lastIndex(measure: LogMeasure): number {
    const count = measure.heights.length;
    if (this.#anchor === null) return count - 1;
    const at = measure.ids.indexOf(this.#anchor);
    // Trimmed off the front of the log: the oldest lines still held are the
    // closest thing to what the player was reading.
    return Math.max(earliestLast(measure), at < 0 ? 0 : at);
  }
}

/**
 * The scroll thumb, as fractions of the track: where it starts and how much of
 * it the view covers. Null when every line is already on screen.
 */
export function thumbOf(window: LogWindow, count: number): { readonly top: number; readonly size: number } | null {
  if (count === 0 || (window.start === 0 && window.end >= count)) return null;
  return { top: window.start / count, size: (window.end - window.start) / count };
}
