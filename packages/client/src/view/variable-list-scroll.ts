/**
 * Scroll position for a *variable*-row virtualized list — `view/list-scroll.ts`'s `ListScroll`
 * generalized from one fixed `rowHeight` to a `heights` array, one entry per row, for the Rules
 * overlay's Card list tab (docs/phase4-screen-gaps.md §3 "W4"): each row there is either a short
 * encounter-set header slot or a taller card-grid-row slot, and those two heights can't share one
 * `ListScroll`, which assumes every row is the same height.
 *
 * Every method takes the same `heights` array `ui/variable-list.ts`'s caller already holds
 * (rebuilt whenever the underlying data or the panel's width changes) rather than owning it,
 * exactly like `ListScroll` takes `count`/`rowHeight` rather than owning them — this class is
 * only the offset and the arithmetic over whatever shape the caller hands it this call.
 */

export interface VariableListWindow {
  /** Index of the first row with any pixel on screen (one row of overscan above it). */
  readonly start: number;
  /** One past the last row with any pixel on screen (one row of overscan below it). */
  readonly end: number;
}

const OVERSCAN = 1;

function totalHeight(heights: readonly number[]): number {
  return heights.reduce((sum, h) => sum + h, 0);
}

/** Row `index`'s own top, in pixels from the content's own top (before the scroll offset is subtracted). */
function topOf(heights: readonly number[], index: number): number {
  let top = 0;
  for (let i = 0; i < index && i < heights.length; i++) top += heights[i]!;
  return top;
}

export class VariableListScroll {
  #offset = 0;

  get offsetPx(): number {
    return this.#offset;
  }

  reset(): void {
    this.#offset = 0;
  }

  #maxOffset(heights: readonly number[], viewportHeight: number): number {
    return Math.max(0, totalHeight(heights) - viewportHeight);
  }

  clamp(heights: readonly number[], viewportHeight: number): void {
    this.#offset = Math.min(Math.max(0, this.#offset), this.#maxOffset(heights, viewportHeight));
  }

  /** The rows that need to be drawn right now: every row with any pixel in the panel, plus one row of overscan each side. */
  windowFor(heights: readonly number[], viewportHeight: number): VariableListWindow {
    if (heights.length === 0 || viewportHeight <= 0) return { start: 0, end: 0 };
    this.clamp(heights, viewportHeight);
    let start = 0;
    let top = 0;
    while (start < heights.length && top + heights[start]! <= this.#offset) {
      top += heights[start]!;
      start += 1;
    }
    let end = start;
    let bottom = top;
    while (end < heights.length && bottom < this.#offset + viewportHeight) {
      bottom += heights[end]!;
      end += 1;
    }
    return { start: Math.max(0, start - OVERSCAN), end: Math.min(heights.length, end + OVERSCAN) };
  }

  /** Where row `index`'s top sits, in pixels from the panel's own top. */
  rowTop(heights: readonly number[], index: number): number {
    return topOf(heights, index) - this.#offset;
  }

  scrollByPx(deltaPx: number, heights: readonly number[], viewportHeight: number): boolean {
    const before = this.#offset;
    this.#offset = Math.min(Math.max(0, this.#offset + deltaPx), this.#maxOffset(heights, viewportHeight));
    return this.#offset !== before;
  }

  scrollByPage(direction: 1 | -1, heights: readonly number[], viewportHeight: number): boolean {
    return this.scrollByPx(direction * Math.max(1, viewportHeight - 40), heights, viewportHeight);
  }

  scrollToStart(heights: readonly number[], viewportHeight: number): boolean {
    const before = this.#offset;
    this.#offset = 0;
    this.clamp(heights, viewportHeight);
    return this.#offset !== before;
  }

  scrollToEnd(heights: readonly number[], viewportHeight: number): boolean {
    const before = this.#offset;
    this.#offset = this.#maxOffset(heights, viewportHeight);
    return this.#offset !== before;
  }

  /** Scrolls the minimum distance so row `index` is entirely on screen. */
  scrollIntoView(index: number, heights: readonly number[], viewportHeight: number): boolean {
    const top = topOf(heights, index);
    const bottom = top + (heights[index] ?? 0);
    const before = this.#offset;
    if (top < this.#offset) this.#offset = top;
    else if (bottom > this.#offset + viewportHeight) this.#offset = bottom - viewportHeight;
    this.clamp(heights, viewportHeight);
    return this.#offset !== before;
  }
}

export interface VariableListThumb {
  readonly top: number;
  readonly size: number;
}

/** The scroll thumb, as fractions of the track. Null when every row already fits. */
export function variableThumbOf(
  offsetPx: number,
  heights: readonly number[],
  viewportHeight: number,
): VariableListThumb | null {
  const contentHeight = totalHeight(heights);
  if (contentHeight <= viewportHeight || contentHeight <= 0) return null;
  const size = Math.min(1, viewportHeight / contentHeight);
  return { top: offsetPx / contentHeight, size };
}
