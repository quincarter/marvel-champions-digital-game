/**
 * Which rows of role-building's list are drawn. A box can offer well over a hundred cards, so only the rows near the scroller's
 * view are parts (the rest keep their focus stops and their place in the scroll height): the window is the visible rows plus a
 * margin each way, rounded out to whole chunks so that a scroll redraws once per chunk rather than once per row. Plain
 * geometry, tested without a DOM.
 */

/** Rows are added and dropped this many at a time. */
export const WINDOW_CHUNK = 4;
/** How far past the view the window reaches, in px: a scroll shows rows already in place. */
export const WINDOW_MARGIN = 600;

export interface RowWindow {
  /** The first row drawn. */
  readonly start: number;
  /** One past the last row drawn. */
  readonly end: number;
}

/** The rows of `heights` (stacked from 0) to draw for a view `viewHeight` tall scrolled to `scrollTop`. */
export function rowWindowOf(heights: readonly number[], scrollTop: number, viewHeight: number): RowWindow {
  const from = scrollTop - WINDOW_MARGIN;
  const to = scrollTop + viewHeight + WINDOW_MARGIN;
  let top = 0;
  let first = heights.length;
  let last = 0;
  heights.forEach((height, index) => {
    if (top + height > from && top < to) {
      first = Math.min(first, index);
      last = Math.max(last, index + 1);
    }
    top += height;
  });
  if (first >= last) return { start: 0, end: Math.min(heights.length, WINDOW_CHUNK) };
  return {
    start: Math.floor(first / WINDOW_CHUNK) * WINDOW_CHUNK,
    end: Math.min(heights.length, Math.ceil(last / WINDOW_CHUNK) * WINDOW_CHUNK),
  };
}

/** True when `index` is a row of the window. */
export const inWindow = (window: RowWindow, index: number): boolean => index >= window.start && index < window.end;

/** The window as a key, to tell whether a scroll moved it. */
export const windowKeyOf = (window: RowWindow): string => `${window.start}-${window.end}`;
