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
import type { Rect } from "./layout.js";

export const PAUSE_KEYWORD_GRID_GAP = 12;
export const PAUSE_KEYWORD_CARD_HEIGHT = 104;
const MAX_ROWS = 3;
/** Below this right-panel width the grid drops from 3 columns to 2 (the owner's own sizing note). */
const TWO_COLUMN_MAX_WIDTH = 560;

export interface PauseKeywordGrid {
  readonly columns: number;
  /** How many of the caller's entries this grid actually shows — `min(entryCount, columns * 3 rows)`. */
  readonly shown: number;
  /** One rect per shown entry, in row-major grid order. */
  readonly cells: readonly Rect[];
  /** The grid's own total height at `shown` entries — 0 when `shown` is 0, so a caller can lay out what comes after it (an empty-state line takes its own fixed height instead). */
  readonly height: number;
}

/** `rect` is the grid's own available width (its height isn't a constraint — the grid is exactly as tall as `shown` entries need, capped at `MAX_ROWS`). */
export function pauseKeywordGrid(rect: Rect, entryCount: number): PauseKeywordGrid {
  const columns = rect.width < TWO_COLUMN_MAX_WIDTH ? 2 : 3;
  const shown = Math.max(0, Math.min(entryCount, columns * MAX_ROWS));
  const rows = shown === 0 ? 0 : Math.ceil(shown / columns);
  const cellWidth = Math.max(1, (rect.width - (columns - 1) * PAUSE_KEYWORD_GRID_GAP) / columns);
  const cells: Rect[] = [];
  for (let i = 0; i < shown; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    cells.push({
      x: rect.x + col * (cellWidth + PAUSE_KEYWORD_GRID_GAP),
      y: rect.y + row * (PAUSE_KEYWORD_CARD_HEIGHT + PAUSE_KEYWORD_GRID_GAP),
      width: cellWidth,
      height: PAUSE_KEYWORD_CARD_HEIGHT,
    });
  }
  const height = rows === 0 ? 0 : rows * PAUSE_KEYWORD_CARD_HEIGHT + (rows - 1) * PAUSE_KEYWORD_GRID_GAP;
  return { columns, shown, cells, height };
}
