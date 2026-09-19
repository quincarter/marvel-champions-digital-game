/**
 * Pure grid geometry for Decks & Collection's "Card pool" column (W9b, D14):
 * how many columns fit at a given pane width, each cell's own rect, and which
 * column a pointer landed in — so `scenes/decks.ts` can render the pool
 * through `McVirtualList` (each "row" of the virtualized list is one row of
 * the grid, so vertical scrolling comes for free) without doing this
 * arithmetic inline, and the geometry itself is Vitest-testable without a
 * canvas.
 *
 * **Cell shape, deliberately not the mock's own box shape.** D14's HTML mock
 * lays out `image-slot` placeholders with no true aspect ratio of their own
 * (`flex:1;min-height:0` — whatever height the grid row happens to be) next
 * to a fixed caption band. A real scan has a real shape (2.5:3.5, the
 * printed card's own ratio — `art/card-art.ts`'s `drawArt` already draws
 * every card at it with `"contain"`), so stretching it to the mock's
 * arbitrary box would crop or distort actual art. This module draws the art
 * area at the card's own ratio and adds a fixed caption band under it, which
 * is a deliberate, documented fidelity trade in favour of legible art over
 * matching an unstyled placeholder's proportions.
 */
import type { Rect } from "./layout.js";

/** Matches D14's own grid gap (`grid-template-columns … gap:12px`). */
export const POOL_GRID_GAP = 12;

const TARGET_CELL_WIDTH = 150;
const MIN_CELL_WIDTH = 110;
const MAX_COLUMNS = 8;
/** Room for the name line and the "Type · X of Y in deck" line under the art. */
const CAPTION_HEIGHT = 46;
/** Height / width of a printed card, the same ratio `drawArt`'s `"contain"` fit already respects. */
const CARD_ASPECT = 3.5 / 2.5;

export interface PoolGridGeometry {
  readonly columns: number;
  readonly cellWidth: number;
  readonly artHeight: number;
  /** Fixed regardless of `cellWidth` — the name line and the "Type · X of Y in deck" line read the same size at every column count. */
  readonly captionHeight: number;
  readonly cellHeight: number;
  readonly rows: number;
}

/** How the pool grid divides a pane of `width` px holding `cardCount` cards. `columns` is always at least 1, even at a width narrower than `MIN_CELL_WIDTH` (a single, slightly-too-narrow column beats an empty grid). */
export function poolGridGeometry(width: number, cardCount: number): PoolGridGeometry {
  const usable = Math.max(1, width);
  const columns = Math.max(1, Math.min(MAX_COLUMNS, Math.round((usable + POOL_GRID_GAP) / (TARGET_CELL_WIDTH + POOL_GRID_GAP))));
  const cellWidth = Math.max(MIN_CELL_WIDTH, (usable - (columns - 1) * POOL_GRID_GAP) / columns);
  const artHeight = cellWidth * CARD_ASPECT;
  const cellHeight = artHeight + CAPTION_HEIGHT;
  const rows = Math.max(1, Math.ceil(cardCount / columns));
  return { columns, cellWidth, artHeight, captionHeight: CAPTION_HEIGHT, cellHeight, rows };
}

/** Cell `column`'s rect within one grid row (`rowRect` is that row's own rect — `McVirtualList` already applies the vertical scroll offset to it). */
export function poolCellRect(geometry: PoolGridGeometry, rowRect: Rect, column: number): Rect {
  const x = rowRect.x + column * (geometry.cellWidth + POOL_GRID_GAP);
  return { x, y: rowRect.y, width: geometry.cellWidth, height: rowRect.height };
}

/** Which column an absolute `pointerX` lands in within `rowRect` — null in the trailing gap past the last real column, or past the row's own last populated cell (`columnCountInRow` — a short final row). */
export function poolColumnAt(geometry: PoolGridGeometry, rowRect: Rect, pointerX: number, columnCountInRow: number = geometry.columns): number | null {
  const rel = pointerX - rowRect.x;
  if (rel < 0) return null;
  const stride = geometry.cellWidth + POOL_GRID_GAP;
  const column = Math.floor(rel / stride);
  if (column < 0 || column >= columnCountInRow) return null;
  const withinCell = rel - column * stride;
  if (withinCell > geometry.cellWidth) return null;
  return column;
}
