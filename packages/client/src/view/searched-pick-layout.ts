/**
 * Where Hunted's "which minion?" sheet puts things (Tigra, 56007; docs/phase7-wave10-client.md 5.3 and 5.6), and Make
 * the Call's "which ally?" sheet (01071): a sheet over the table with one tile per candidate the engine listed, each a
 * card face with its area tag under it and an Inspect button, and Cancel (and Confirm) in the header. Plain geometry,
 * no Phaser, so the tiles never overlap or leave the sheet at any window size: a list longer than the sheet holds pages.
 * The scene turns the rects into pictures (`scenes/board/searched-pick-sheet.ts`).
 */
import { hit } from "../tokens.js";
import type { Rect } from "./layout.js";

export interface SearchedTileRects {
  /** The whole tile: tapping it chooses the minion. */
  readonly tile: Rect;
  readonly face: Rect;
  /** The area tag, on a strip under the face. */
  readonly tag: Rect;
  /** The name and type lines under the tag. */
  readonly caption: Rect;
  readonly inspect: Rect;
}

/** Previous / Next under the tiles, for a list longer than one sheet holds (Make the Call's allies on a phone, #420). */
export interface SearchedPagerRects {
  readonly previous: Rect;
  readonly next: Rect;
  /** "Page 1 of 2", between the buttons. */
  readonly label: Rect;
  /** The page shown, clamped to the pages there are, and how many pages there are. */
  readonly page: number;
  readonly pages: number;
}

export interface SearchedPickLayout {
  readonly sheet: Rect;
  readonly title: Rect;
  readonly cancel: Rect;
  /** Confirm, beside Cancel, for a list that waits for it (Make the Call); null otherwise. */
  readonly confirm: Rect | null;
  /**
   * How many lines the title may wrap to inside `title`. The prompt ("Hunted: choose the minion to search for and
   * attach it to") is longer than the room beside Cancel on a phone, where one line clipped it ("...SEARCH FOR AND AT").
   */
  readonly titleLines: number;
  /**
   * True when Cancel (and Confirm) sit on a row under the title instead of beside it: on a phone, two buttons beside
   * the title left it about 112 px, too little for "Make the Call: choose the ally whose cost you pay" (#420).
   */
  readonly stackedHeader: boolean;
  /** The tiles of the page shown, in order: `tiles[i]` is option `first + i`. */
  readonly tiles: readonly SearchedTileRects[];
  /** The index of the option the first tile shows. */
  readonly first: number;
  /** Tiles per row, and how many rows a full page needs. */
  readonly columns: number;
  readonly rows: number;
  /**
   * Null when every option fits on one sheet. Otherwise the list pages: a face never shrinks below `MIN_FACE_WIDTH`,
   * so a long list (every ally in every discard pile) takes more than one sheet rather than running off its edge.
   */
  readonly pager: SearchedPagerRects | null;
}

const PAD = 16;
const GAP = 12;
const TAG_HEIGHT = 24;
const CAPTION_HEIGHT = 40;
const HEADER_HEIGHT = hit.primary + 12;
/** The header with its buttons on a row of their own under the title. */
const STACKED_HEADER_HEIGHT = hit.primary * 2 + 8 + 12;
/** The room a two-line title needs beside the buttons; with less, the buttons go under it. */
const MIN_TITLE_WIDTH = 200;
const PAGER_HEIGHT = hit.primary;
export const MIN_FACE_WIDTH = 64;
const MAX_FACE_WIDTH = 170;
/** The header holds two lines of title (16 px type at 1.25 line height is 40 px, inside the header's 52). */
const TITLE_LINES = 2;

/**
 * Lays `count` tiles out in `viewport`: as few rows as the width allows, each tile as large as the height then allows,
 * and never smaller than `MIN_FACE_WIDTH`. When that many tiles do not fit, the list pages and `page` picks which.
 */
export function searchedPickLayout(viewport: Rect, count: number, withConfirm = false, page = 0): SearchedPickLayout {
  const margin = viewport.width < 600 ? 8 : 24;
  const sheet: Rect = {
    x: viewport.x + margin,
    y: viewport.y + margin,
    width: Math.max(0, viewport.width - margin * 2),
    height: Math.max(0, viewport.height - margin * 2),
  };
  const cancelWidth = Math.min(140, Math.max(88, sheet.width * 0.2));
  const buttonsWidth = withConfirm ? cancelWidth * 2 + GAP : cancelWidth;
  const besideWidth = sheet.width - PAD * 2 - GAP - buttonsWidth;
  const stackedHeader = besideWidth < MIN_TITLE_WIDTH;
  const cancel: Rect = {
    x: sheet.x + sheet.width - PAD - cancelWidth,
    y: stackedHeader ? sheet.y + PAD + hit.primary + 8 : sheet.y + PAD,
    width: cancelWidth,
    height: hit.primary,
  };
  const confirm: Rect | null = withConfirm
    ? { x: cancel.x - GAP - cancelWidth, y: cancel.y, width: cancelWidth, height: hit.primary }
    : null;
  const title: Rect = {
    x: sheet.x + PAD,
    y: sheet.y + PAD,
    width: Math.max(0, stackedHeader ? sheet.width - PAD * 2 : besideWidth),
    height: hit.primary,
  };
  const headerHeight = stackedHeader ? STACKED_HEADER_HEIGHT : HEADER_HEIGHT;
  const inner: Rect = {
    x: sheet.x + PAD,
    y: sheet.y + PAD + headerHeight,
    width: Math.max(0, sheet.width - PAD * 2),
    height: Math.max(0, sheet.height - PAD * 2 - headerHeight),
  };
  // The tile is a face (5:7) over the tag, caption and Inspect rows.
  const chrome = TAG_HEIGHT + CAPTION_HEIGHT + hit.target + GAP;
  const minTileHeight = Math.round(MIN_FACE_WIDTH * (7 / 5)) + chrome;
  const columnsIn = (width: number): number => Math.max(1, Math.floor((width + GAP) / (MIN_FACE_WIDTH + GAP)));
  const fitRows = (height: number): number => Math.max(1, Math.floor((height + GAP) / (minTileHeight + GAP)));
  const total = Math.max(1, count);
  let area = inner;
  let perPage = columnsIn(inner.width) * fitRows(inner.height);
  // A short sheet (a phone held sideways) has room for one row of tiles and no pager under it: the pager's buttons
  // go in columns at the sides of the row instead.
  let besideRow = false;
  if (total > perPage) {
    const under = Math.max(0, inner.height - PAGER_HEIGHT - GAP);
    besideRow = under < minTileHeight;
    // The pager takes a row at the foot of the sheet (or a column each side), and the tiles the room left.
    area = besideRow
      ? { ...inner, x: inner.x + cancelWidth + GAP, width: Math.max(0, inner.width - (cancelWidth + GAP) * 2) }
      : { ...inner, height: under };
    perPage = columnsIn(area.width) * fitRows(area.height);
  }
  const pages = Math.ceil(total / perPage);
  const shownPage = Math.min(Math.max(0, Math.floor(page)), pages - 1);
  const first = shownPage * perPage;
  // Every page is laid out for a full page, so the tiles keep one size as the player pages.
  const laid = Math.min(total, perPage);
  // Pick the column count that gives the largest face, never more columns than a minimum face fits.
  let best = { columns: 1, rows: laid, face: 0 };
  for (let columns = 1; columns <= Math.min(laid, columnsIn(area.width)); columns++) {
    const rows = Math.ceil(laid / columns);
    const byWidth = (area.width - GAP * (columns - 1)) / columns;
    const byHeight = ((area.height - GAP * (rows - 1)) / rows - chrome) * (5 / 7);
    const face = Math.min(byWidth, byHeight, MAX_FACE_WIDTH);
    if (face > best.face) best = { columns, rows, face };
  }
  const faceWidth = Math.max(Math.min(MIN_FACE_WIDTH, area.width), Math.floor(best.face));
  const faceHeight = Math.round(faceWidth * (7 / 5));
  const tileHeight = faceHeight + chrome;
  const rowWidth = best.columns * faceWidth + (best.columns - 1) * GAP;
  const left = area.x + Math.max(0, (area.width - rowWidth) / 2);
  const onPage = Math.max(0, Math.min(perPage, count - first));
  const tiles = Array.from({ length: onPage }, (_, index): SearchedTileRects => {
    const column = index % best.columns;
    const row = Math.floor(index / best.columns);
    const x = Math.round(left + column * (faceWidth + GAP));
    const y = Math.round(area.y + row * (tileHeight + GAP));
    const face: Rect = { x, y, width: faceWidth, height: faceHeight };
    return {
      tile: { x, y, width: faceWidth, height: tileHeight },
      face,
      tag: { x, y: y + faceHeight, width: faceWidth, height: TAG_HEIGHT },
      caption: { x, y: y + faceHeight + TAG_HEIGHT, width: faceWidth, height: CAPTION_HEIGHT },
      inspect: { x, y: y + faceHeight + TAG_HEIGHT + CAPTION_HEIGHT + 4, width: faceWidth, height: hit.target },
    };
  });
  let pager: SearchedPagerRects | null = null;
  if (pages > 1 && besideRow) {
    // Previous over the page count on the left of the row, Next on the right.
    const y = inner.y + Math.max(0, (Math.min(inner.height, tileHeight) - PAGER_HEIGHT * 2 - GAP) / 2);
    const previous: Rect = { x: inner.x, y, width: cancelWidth, height: PAGER_HEIGHT };
    const next: Rect = { x: inner.x + inner.width - cancelWidth, y, width: cancelWidth, height: PAGER_HEIGHT };
    const label: Rect = { x: inner.x, y: y + PAGER_HEIGHT + GAP, width: cancelWidth, height: PAGER_HEIGHT };
    pager = { previous, next, label, page: shownPage, pages };
  } else if (pages > 1) {
    const y = inner.y + inner.height - PAGER_HEIGHT;
    const previous: Rect = { x: inner.x, y, width: cancelWidth, height: PAGER_HEIGHT };
    const next: Rect = { x: inner.x + inner.width - cancelWidth, y, width: cancelWidth, height: PAGER_HEIGHT };
    const labelX = previous.x + previous.width + GAP;
    const label: Rect = { x: labelX, y, width: Math.max(0, next.x - GAP - labelX), height: PAGER_HEIGHT };
    pager = { previous, next, label, page: shownPage, pages };
  }
  return {
    sheet,
    title,
    cancel,
    confirm,
    titleLines: TITLE_LINES,
    stackedHeader,
    tiles,
    first,
    columns: best.columns,
    rows: best.rows,
    pager,
  };
}
