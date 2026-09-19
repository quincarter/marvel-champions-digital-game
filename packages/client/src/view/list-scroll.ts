/**
 * Scroll position for a uniform-row virtualized list — the Decks screen's deck
 * list and the deck builder's pool browser, both "a long filterable list"
 * PLAN.md Phase 9 asks to follow the game log's redraw-safe pattern
 * (`view/log-view.ts` + `scenes/board/log.ts`), and `ui/virtual-list.ts`'s
 * `McVirtualList` for the game log later.
 *
 * **Pixel offset, not whole rows.** A row-granularity offset (the original
 * shape) leaves a gap under the last row whenever the panel's height isn't an
 * exact multiple of the row height, and can only ever jump a full row at a
 * time. This tracks a pixel offset instead, clamped to the content's real
 * height, so the last row's remainder fills the panel and a wheel notch or a
 * drag moves it by the notch/drag's own distance rather than snapping to the
 * next row line.
 *
 * Like the log's own scroll state, this lives outside the scene's display
 * list on purpose — see `ui/virtual-list.ts`, which owns a `ListScroll` and
 * is itself the thing that survives a scene's `destroyChildren(scene)`
 * sweep, the same way `McTextInput` does.
 */

export interface ListWindow {
  /** Index of the first row with any pixel on screen (one row of overscan above it, so it's already drawn before the mask exposes it). */
  readonly start: number;
  /** One past the last row with any pixel on screen (one row of overscan below it). */
  readonly end: number;
}

export interface ScrollThumb {
  /** Fraction of the track the thumb's top sits at, 0–1. */
  readonly top: number;
  /** Fraction of the track the thumb covers, 0–1. */
  readonly size: number;
}

const OVERSCAN = 1;

export class ListScroll {
  #offset = 0;

  /** Pixels scrolled down from the top. */
  get offsetPx(): number {
    return this.#offset;
  }

  /** Back to the top — a fresh list (a new filter, a new screen visit). */
  reset(): void {
    this.#offset = 0;
  }

  #maxOffset(count: number, rowHeight: number, viewportHeight: number): number {
    return Math.max(0, count * rowHeight - viewportHeight);
  }

  /** Clamps the current offset to what `count` rows and a `viewportHeight`-tall panel actually allow — called by every method below, and safe to call after a filter narrows the list or the window resizes. */
  clamp(count: number, rowHeight: number, viewportHeight: number): void {
    if (rowHeight <= 0) return;
    this.#offset = Math.min(Math.max(0, this.#offset), this.#maxOffset(count, rowHeight, viewportHeight));
  }

  /** The rows that need to be drawn right now: every row with any pixel in the panel, plus one row of overscan each side. */
  windowFor(count: number, rowHeight: number, viewportHeight: number): ListWindow {
    if (count === 0 || rowHeight <= 0 || viewportHeight <= 0) return { start: 0, end: 0 };
    this.clamp(count, rowHeight, viewportHeight);
    const start = Math.max(0, Math.floor(this.#offset / rowHeight) - OVERSCAN);
    const end = Math.min(count, Math.ceil((this.#offset + viewportHeight) / rowHeight) + OVERSCAN);
    return { start, end };
  }

  /** Where row `index`'s top sits, in pixels from the panel's own top (negative or past the panel when it's only partly, or not at all, on screen). */
  rowTop(index: number, rowHeight: number): number {
    return index * rowHeight - this.#offset;
  }

  /** Scrolls by a pixel delta (positive = down), clamped to the list's ends. Returns true when the view actually moved. */
  scrollByPx(deltaPx: number, count: number, rowHeight: number, viewportHeight: number): boolean {
    const before = this.#offset;
    this.#offset = Math.min(Math.max(0, this.#offset + deltaPx), this.#maxOffset(count, rowHeight, viewportHeight));
    return this.#offset !== before;
  }

  /** Scrolls by whole rows — a keyboard/pad step, or a stepper button. */
  scrollByRows(rows: number, count: number, rowHeight: number, viewportHeight: number): boolean {
    return this.scrollByPx(rows * rowHeight, count, rowHeight, viewportHeight);
  }

  /** A page: the panel's own height, less one row so the next page still shows a row of context, in `direction`. */
  scrollByPage(direction: 1 | -1, count: number, rowHeight: number, viewportHeight: number): boolean {
    const rows = Math.max(1, Math.floor(viewportHeight / rowHeight) - 1);
    return this.scrollByRows(direction * rows, count, rowHeight, viewportHeight);
  }

  /** Home. */
  scrollToStart(count: number, rowHeight: number, viewportHeight: number): boolean {
    const before = this.#offset;
    this.#offset = 0;
    this.clamp(count, rowHeight, viewportHeight);
    return this.#offset !== before;
  }

  /** End. */
  scrollToEnd(count: number, rowHeight: number, viewportHeight: number): boolean {
    const before = this.#offset;
    this.#offset = this.#maxOffset(count, rowHeight, viewportHeight);
    return this.#offset !== before;
  }

  /**
   * Scrolls the minimum distance so row `index` is entirely on screen — what
   * moving keyboard/pad focus onto an off-screen row does. Already-visible
   * stays put, so repeatedly focusing the same row never jitters the view.
   */
  scrollIntoView(index: number, count: number, rowHeight: number, viewportHeight: number): boolean {
    const top = index * rowHeight;
    const bottom = top + rowHeight;
    const before = this.#offset;
    if (top < this.#offset) this.#offset = top;
    else if (bottom > this.#offset + viewportHeight) this.#offset = bottom - viewportHeight;
    this.clamp(count, rowHeight, viewportHeight);
    return this.#offset !== before;
  }
}

/** The scroll thumb, as fractions of the track. Null when every row already fits — nothing to scroll. */
export function thumbOf(offsetPx: number, count: number, rowHeight: number, viewportHeight: number): ScrollThumb | null {
  const contentHeight = count * rowHeight;
  if (contentHeight <= viewportHeight || contentHeight <= 0) return null;
  const size = Math.min(1, viewportHeight / contentHeight);
  return { top: offsetPx / contentHeight, size };
}
