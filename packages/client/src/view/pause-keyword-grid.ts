/**
 * Pure grid geometry for the desktop/tablet Pause overlay's "Rules reference"
 * keyword grid (D13; owner decision 2026-09-18 — see `pause-layout.ts`'s own
 * header). Unlike the full Rules overlay's own glossary grid
 * (`rules-glossary-grid.ts`), which sizes each card to its own real definition
 * text because it can scroll through the whole glossary, this grid is capped
 * at a fixed few rows inside a menu overlay with no scroll of its own — so
 * every card is drawn at one fixed height ("up to ~3 rows", the owner's own
 * ask), and an entry past that cap simply isn't shown here (the player can
 * still find it by opening Rules reference itself, which does scroll).
 */
import { estimateWrappedLines, type Rect } from "./layout.js";

export const PAUSE_KEYWORD_GRID_GAP = 12;
export const PAUSE_KEYWORD_CARD_HEIGHT = 104;
const MAX_ROWS = 3;
/** Below this right-panel width the grid drops from 3 columns to 2 (the owner's own sizing note). */
const TWO_COLUMN_MAX_WIDTH = 560;

/** What a keyword card draws, as far as its height goes: the definition (9px body, wrapped) and whether the "On <card>." tail line is reserved. */
export interface PauseKeywordCardText {
  readonly definition: string;
  readonly hasTail: boolean;
}

/** Public Sans at the card's 9px body size: average glyph width, with a margin so a long word wrapping early cannot make the estimate short. */
export const PAUSE_KEYWORD_DEFINITION_CHAR_WIDTH = 5.4;
export const PAUSE_KEYWORD_DEFINITION_LINE_HEIGHT = 14;
/** Card padding above the term, the 16px Bangers term line, its gap to the definition, and the tail line plus bottom padding. */
const CARD_TOP = 8 + 22 + 4;
const CARD_TAIL = 6 + 14;
const CARD_BOTTOM = 8;
export const PAUSE_KEYWORD_TEXT_PADDING = 10;

/** How tall one keyword card must be at `cellWidth` for its own real text to sit inside it — never shorter than the standard card. */
export function pauseKeywordCardHeight(text: PauseKeywordCardText, cellWidth: number): number {
  const lines = estimateWrappedLines(
    text.definition,
    Math.max(1, cellWidth - PAUSE_KEYWORD_TEXT_PADDING * 2),
    PAUSE_KEYWORD_DEFINITION_CHAR_WIDTH,
  );
  const needed = CARD_TOP + lines * PAUSE_KEYWORD_DEFINITION_LINE_HEIGHT + (text.hasTail ? CARD_TAIL : 0) + CARD_BOTTOM;
  return Math.max(PAUSE_KEYWORD_CARD_HEIGHT, needed);
}

export interface PauseKeywordGrid {
  readonly columns: number;
  /** How many of the caller's entries this grid actually shows — `min(entryCount, columns * 3 rows)`. */
  readonly shown: number;
  /** One rect per shown entry, in row-major grid order. */
  readonly cells: readonly Rect[];
  /** The grid's own total height at `shown` entries — 0 when `shown` is 0, so a caller can lay out what comes after it (an empty-state line takes its own fixed height instead). */
  readonly height: number;
}

/**
 * `rect` is the grid's own available width. Without `texts`, every card is the standard height (`entryCount`
 * cards). With `texts` (one per entry, in order), each row is as tall as its tallest card needs
 * (`pauseKeywordCardHeight`), so no definition can run out of its tile; and when `rect.height` is positive it is a
 * budget: rows that would not fit under it are left out (the full Rules reference lists everything).
 */
export function pauseKeywordGrid(
  rect: Rect,
  entryCount: number,
  texts?: readonly PauseKeywordCardText[],
): PauseKeywordGrid {
  const columns = rect.width < TWO_COLUMN_MAX_WIDTH ? 2 : 3;
  const cellWidth = Math.max(1, (rect.width - (columns - 1) * PAUSE_KEYWORD_GRID_GAP) / columns);
  const wanted = Math.max(0, Math.min(entryCount, columns * MAX_ROWS));
  const rowHeights: number[] = [];
  let used = 0;
  for (let start = 0; start < wanted; start += columns) {
    const inRow = Math.min(columns, wanted - start);
    let rowHeight = PAUSE_KEYWORD_CARD_HEIGHT;
    for (let i = start; i < start + inRow; i++) {
      const text = texts?.[i];
      if (text) rowHeight = Math.max(rowHeight, pauseKeywordCardHeight(text, cellWidth));
    }
    const next = used + (rowHeights.length > 0 ? PAUSE_KEYWORD_GRID_GAP : 0) + rowHeight;
    // The first row always shows: a grid with nothing in it would hide the entry the player is paused to read.
    if (rect.height > 0 && rowHeights.length > 0 && next > rect.height) break;
    rowHeights.push(rowHeight);
    used = next;
  }
  const shown = Math.min(wanted, rowHeights.length * columns);
  const cells: Rect[] = [];
  let y = rect.y;
  for (let row = 0; row < rowHeights.length; row++) {
    for (let col = 0; col < columns; col++) {
      if (row * columns + col >= shown) break;
      cells.push({
        x: rect.x + col * (cellWidth + PAUSE_KEYWORD_GRID_GAP),
        y,
        width: cellWidth,
        height: rowHeights[row]!,
      });
    }
    y += rowHeights[row]! + PAUSE_KEYWORD_GRID_GAP;
  }
  return { columns, shown, cells, height: used };
}
