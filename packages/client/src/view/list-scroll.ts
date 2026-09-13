/**
 * Scroll position for a uniform-row virtualized list — the Decks screen's deck
 * list and the deck builder's pool browser, both "a long filterable list"
 * PLAN.md Phase 9 asks to follow the game log's redraw-safe pattern
 * (`view/log-view.ts` + `scenes/board/log.ts`).
 *
 * Simpler than `LogScroll`: a log's lines wrap to a measured height and the
 * newest one matters most, so it anchors to a line id. A deck row or a pool
 * row is one fixed height regardless of content, so a plain first-visible-row
 * index is enough — no measuring, no id anchor, no "follow the newest" mode
 * (a list has no "newest").
 *
 * Like `LogScroll`, this lives outside the scene's display list on purpose: a
 * screen built on the Title/Game Over pattern clears and rebuilds every
 * object on every redraw (resize, a filter changing, art arriving), and a
 * scroll offset stored on a game object would be swept away with it.
 */

export interface ListWindow {
  /** Index of the first row on screen. */
  readonly start: number;
  /** One past the last row on screen. */
  readonly end: number;
}

const EMPTY: ListWindow = { start: 0, end: 0 };

export class ListScroll {
  #offset = 0;

  get offset(): number {
    return this.#offset;
  }

  /** Back to the top — a fresh list (a new filter, a new screen visit). */
  reset(): void {
    this.#offset = 0;
  }

  /** The rows on screen for `count` total rows and `rowsVisible` fitting the panel, clamped so the list never scrolls past its end. */
  windowFor(count: number, rowsVisible: number): ListWindow {
    if (count === 0 || rowsVisible <= 0) return EMPTY;
    const maxOffset = Math.max(0, count - rowsVisible);
    this.#offset = Math.min(this.#offset, maxOffset);
    const start = this.#offset;
    return { start, end: Math.min(count, start + rowsVisible) };
  }

  /** Moves the view by whole rows, clamped to the list's ends. Returns true when the view actually moved. */
  scrollBy(rows: number, count: number, rowsVisible: number): boolean {
    if (rows === 0) return false;
    const maxOffset = Math.max(0, count - rowsVisible);
    const next = Math.min(maxOffset, Math.max(0, this.#offset + rows));
    const moved = next !== this.#offset;
    this.#offset = next;
    return moved;
  }
}

/**
 * The scroll thumb, as fractions of the track: where it starts and how much of
 * it the view covers. Null when every row is already on screen. The same
 * shape `log-view.ts`'s `thumbOf` computes, kept as its own copy here rather
 * than shared: the two live in different modules for different lists, and the
 * computation is three lines — a shared import would cost more to keep
 * discoverable than it would save.
 */
export function thumbOf(window: ListWindow, count: number): { readonly top: number; readonly size: number } | null {
  if (count === 0 || (window.start === 0 && window.end >= count)) return null;
  return { top: window.start / count, size: (window.end - window.start) / count };
}
