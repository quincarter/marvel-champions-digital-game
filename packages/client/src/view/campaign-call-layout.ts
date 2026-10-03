/**
 * The briefing's "Your call" option buttons as wrapped rows: a pick of many (MC32's role-building lists a dozen
 * events) flows into rows inside the panel width, never off its right edge. Plain geometry, tested without Phaser.
 */
import type { Rect } from "./layout.js";

export interface CallGridSpec {
  readonly count: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  /** Widest a button grows to when the row has room. */
  readonly maxButtonWidth?: number;
  /** Narrowest a button is allowed before the row gives up a column. */
  readonly minButtonWidth?: number;
  readonly height?: number;
  readonly gap?: number;
  /** Room for the grid; when every row doesn't fit, the grid pages: `page` picks a page of `perPage` options. */
  readonly maxHeight?: number;
  readonly page?: number;
}

export interface CallGrid {
  readonly rects: readonly Rect[];
  readonly columns: number;
  /** Options on each page (all of them when nothing pages). */
  readonly perPage: number;
  readonly pageCount: number;
  /** The page shown, clamped into range. */
  readonly page: number;
  /** Index of the first option on this page; `rects[i]` belongs to option `firstIndex + i`. */
  readonly firstIndex: number;
  /** Bottom edge of the last row (the `y` itself for an empty list). */
  readonly bottom: number;
}

export function callGridOf(spec: CallGridSpec): CallGrid {
  const gap = spec.gap ?? 12;
  const height = spec.height ?? 44;
  const maxButton = spec.maxButtonWidth ?? 200;
  const minButton = Math.min(spec.minButtonWidth ?? 150, spec.width);
  const columns = Math.max(1, Math.floor((spec.width + gap) / (minButton + gap)));
  const buttonWidth = Math.min(maxButton, Math.floor((spec.width - gap * (columns - 1)) / columns));
  const rowsFit =
    spec.maxHeight === undefined ? Infinity : Math.max(1, Math.floor((spec.maxHeight + gap) / (height + gap)));
  const perPage = Math.min(Math.max(spec.count, 1), rowsFit * columns);
  const pageCount = Math.max(1, Math.ceil(spec.count / perPage));
  const page = Math.min(Math.max(spec.page ?? 0, 0), pageCount - 1);
  const firstIndex = page * perPage;
  const shown = Math.max(0, Math.min(perPage, spec.count - firstIndex));
  const rects: Rect[] = [];
  for (let index = 0; index < shown; index++) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    rects.push({
      x: spec.x + column * (buttonWidth + gap),
      y: spec.y + row * (height + gap),
      width: buttonWidth,
      height,
    });
  }
  const rows = Math.ceil(shown / columns);
  return {
    rects,
    columns,
    perPage,
    pageCount,
    page,
    firstIndex,
    bottom: rows === 0 ? spec.y : spec.y + rows * height + (rows - 1) * gap,
  };
}
