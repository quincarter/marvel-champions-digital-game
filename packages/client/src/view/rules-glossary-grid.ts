/**
 * Pure grid geometry for the Rules overlay's Glossary tab (docs/phase4-screen-gaps.md §3 "W4";
 * D13's own read: a grid of individually bordered entry cards, not one scrolling text block —
 * `scenes/rules.ts`'s own header comment has the redesign this replaces).
 *
 * Mirrors `view/deck-pool-grid.ts`'s split of "how many columns fit" from "how tall does one
 * card need to be": columns only depend on the panel's own width (wider entry cards than the
 * card-art pool grid — a term needs room to state its definition, not just caption a picture),
 * and a card's own height is computed from its *real* definition text at that column's width
 * (`glossaryCardHeight`), the same "measure the actual content, don't guess a worst case" rule
 * `view/layout.ts`'s `toggleRowHeight` documents (a fixed height sized for the shortest entry is
 * exactly the clipping bug that fidelity pass fixed elsewhere on this same screen family). The
 * grid itself still draws every card at one uniform height — `McVirtualList` has no per-row
 * height of its own — so the caller takes the *tallest* currently-showing entry's own height and
 * uses that for the whole grid; the extra room under a short entry is the accepted trade for
 * never clipping a long one.
 */
import { estimateWrappedLines, type Rect } from "./layout.js";

export const GLOSSARY_GRID_GAP = 12;

const TARGET_CELL_WIDTH = 380;
const MIN_CELL_WIDTH = 260;
const MAX_COLUMNS = 3;

export interface GlossaryGridColumns {
  readonly columns: number;
  readonly cellWidth: number;
}

/** How many entry cards fit across a panel `width` px wide, and each one's own width. Always at least one column, even narrower than `MIN_CELL_WIDTH` (a single slightly-too-narrow card beats none). */
export function glossaryGridColumns(width: number): GlossaryGridColumns {
  const usable = Math.max(1, width);
  const columns = Math.max(1, Math.min(MAX_COLUMNS, Math.round((usable + GLOSSARY_GRID_GAP) / (TARGET_CELL_WIDTH + GLOSSARY_GRID_GAP))));
  const cellWidth = Math.max(MIN_CELL_WIDTH, (usable - (columns - 1) * GLOSSARY_GRID_GAP) / columns);
  return { columns, cellWidth };
}

/** Cell `column`'s rect within one grid row (`rowRect` is that row's own rect, already offset for scroll by the caller's virtualized list). */
export function glossaryCellRect(geometry: GlossaryGridColumns, rowRect: Rect, column: number): Rect {
  return { x: rowRect.x + column * (geometry.cellWidth + GLOSSARY_GRID_GAP), y: rowRect.y, width: geometry.cellWidth, height: rowRect.height };
}

const CARD_PADDING = 12;
/** Bangers term line. */
const TERM_HEIGHT = 24;
const DEFINITION_LINE_HEIGHT = 15;
/** Public Sans body's own average glyph width at `typeRole.body`'s 11px, matching `toggleRowHeight`'s own estimate convention. */
const DEFINITION_CHAR_WIDTH = 5.6;
const CITE_HEIGHT = 16;
/** A card thumbnail's own footprint in the strip: `McCardTile`'s art plus its caption. */
export const GLOSSARY_THUMB_SIZE = 64;
export const GLOSSARY_THUMB_CAPTION = 26;
const THUMB_STRIP_HEIGHT = GLOSSARY_THUMB_SIZE * 1.4 + GLOSSARY_THUMB_CAPTION;
const GAP = 8;

export interface GlossaryCardContent {
  readonly definition: string;
  /** Only the count matters for height — whether the strip row is reserved at all. */
  readonly cardRefCount: number;
}

/** How tall one entry card needs to be at `cellWidth`, from its own real definition text and whether it has a thumbnail strip to show. */
export function glossaryCardHeight(entry: GlossaryCardContent, cellWidth: number): number {
  const textWidth = Math.max(1, cellWidth - CARD_PADDING * 2);
  const lines = estimateWrappedLines(entry.definition, textWidth, DEFINITION_CHAR_WIDTH);
  const thumbRow = entry.cardRefCount > 0 ? GAP + THUMB_STRIP_HEIGHT : 0;
  return CARD_PADDING * 2 + TERM_HEIGHT + lines * DEFINITION_LINE_HEIGHT + GAP + CITE_HEIGHT + thumbRow;
}

/** The uniform row height a grid of `entries` needs at `cellWidth`: the tallest one, so nothing clips (see the module header for the trade this makes). */
export function glossaryRowHeight(entries: readonly GlossaryCardContent[], cellWidth: number, minHeight = 120): number {
  return Math.max(minHeight, ...entries.map((entry) => glossaryCardHeight(entry, cellWidth)));
}

/**
 * One height *per grid row* — `columns` entries at a time — rather than `glossaryRowHeight`'s
 * single height for the whole tab. A `McVirtualList` can only draw every row at one uniform
 * height, so feeding it the tab-wide tallest entry left every short entry (no thumbnail strip:
 * "Alliance", "Assault", "Discount"…) with the same reserved height as the tallest one on the
 * whole tab, most of it empty. `ui/variable-list.ts`'s `McVariableList` draws each row at its own
 * height, so the caller (`scenes/rules.ts`) can take *this* — the taller of just the pair (or
 * fewer, on a short trailing row) actually sharing that row — instead.
 */
export function glossaryRowHeights(entries: readonly GlossaryCardContent[], columns: number, cellWidth: number, minHeight = 120): number[] {
  const heights: number[] = [];
  for (let start = 0; start < entries.length; start += columns) {
    heights.push(glossaryRowHeight(entries.slice(start, start + columns), cellWidth, minHeight));
  }
  return heights;
}
