/**
 * Where the schemes column puts its rows: a pure function of the panel's rect and how many schemes are in play
 * (`scenes/board/schemes.ts` draws it; nothing here imports Phaser).
 *
 * The column has to hold the main scheme (two in Tower Defense) and every side scheme in play, and the table gives
 * it a fixed share of the villain band. On a short tablet the share is less than three rows tall (owner report,
 * 2026-10-04: Project Wideawake on a tablet in landscape drew its third scheme under the hero's panel), so the
 * order of preference is:
 *
 * 1. Every row at its normal size, growing into a tall zone (an ultrawide) as far as every scheme still fits.
 * 2. Every row, with the main scheme at a compact height (`MAIN_COMPACT_HEIGHT`), when only that makes them fit.
 * 3. Otherwise the side schemes scroll in a viewport inside the panel, under the main scheme(s), which stay pinned
 *    at the top. A panel too short to show one side scheme and a peek of the next scrolls everything together.
 *
 * A row is never drawn outside the panel: a scrolling row is clipped to `viewport`.
 */

import type { Rect } from "./layout.js";

/** The main scheme row's height on the 1440x900 table, and how far it may grow into a taller zone. */
export const MAIN_SCHEME_HEIGHT = 92;
export const MAIN_SCHEME_MAX_HEIGHT = 150;
/** The shortest a main scheme row gets: its name, subtitle and threat meter still stack without touching. */
export const MAIN_COMPACT_HEIGHT = 72;
export const SIDE_SCHEME_HEIGHT = 52;
export const SIDE_SCHEME_MAX_HEIGHT = 80;
/** The panel's inner padding and the gap between rows. */
export const SCHEME_PANEL_PADDING = 10;
export const SCHEME_ROW_GAP = 6;
/** How much of a next side scheme the scrolling viewport has to show, below the first, for it to read as a list. */
const PEEK_HEIGHT = 20;
/** The scrolling viewport stops this far above the panel's bottom edge. */
const VIEWPORT_EDGE = 4;
/** Under pinned rows the viewport starts this far below them, so a scrolled row is cut close to the pinned one. */
const VIEWPORT_TOP_INSET = 2;

export interface SchemeRowSlot {
  /** Index into `[...mains, ...sides]`. */
  readonly index: number;
  readonly kind: "main" | "side";
  /** True for a row that is drawn once and never moves; false for a row inside the scrolling viewport. */
  readonly pinned: boolean;
  /** Where the row is drawn: for a scrolling row, with the scroll at 0. */
  readonly rect: Rect;
  /** For a scrolling row, its index in `heights`; -1 when pinned. */
  readonly scrollIndex: number;
}

export interface SchemeListLayout {
  readonly rows: readonly SchemeRowSlot[];
  /** The rect scrolling rows are clipped to; null when everything fits and nothing scrolls. */
  readonly viewport: Rect | null;
  /** One entry per scrolling row (its height plus the space after it), for the scroll math. Empty when it fits. */
  readonly heights: readonly number[];
  /** Whether the content is taller than the viewport, so some row has to be scrolled to. */
  readonly scrolls: boolean;
}

export interface SchemeListInput {
  /** Main schemes in play: one, or two with Tower Defense. */
  readonly mains: number;
  readonly sides: number;
  /** The phone's tabbed board keeps its rows at their normal size instead of growing into a tall zone. */
  readonly tabbed: boolean;
}

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

export function schemeListLayout(rect: Rect, input: SchemeListInput): SchemeListLayout {
  const { mains, sides, tabbed } = input;
  const pad = SCHEME_PANEL_PADDING;
  const gap = SCHEME_ROW_GAP;
  const x = rect.x + pad;
  const width = rect.width - pad * 2;
  const inner = rect.height - pad * 2;
  const total = mains + sides;
  const gaps = gap * Math.max(0, total - 1);
  const rowRect = (y: number, height: number): Rect => ({ x, y, width, height });

  // 1 and 2: everything fits in the panel without scrolling.
  const fitsAt = (mainHeight: number): boolean => mains * mainHeight + sides * SIDE_SCHEME_HEIGHT + gaps <= inner;
  const fitMain = fitsAt(MAIN_SCHEME_HEIGHT)
    ? MAIN_SCHEME_HEIGHT
    : fitsAt(MAIN_COMPACT_HEIGHT)
      ? MAIN_COMPACT_HEIGHT
      : 0;
  if (fitMain > 0) {
    const available = inner - gaps;
    // A tall zone grows the rows, but only as far as every scheme still fits.
    const mainHeight =
      tabbed || fitMain !== MAIN_SCHEME_HEIGHT
        ? fitMain
        : Math.max(
            MAIN_SCHEME_HEIGHT,
            Math.min(MAIN_SCHEME_MAX_HEIGHT, (available - sides * SIDE_SCHEME_HEIGHT) / mains),
          );
    const sideHeight =
      tabbed || sides === 0
        ? SIDE_SCHEME_HEIGHT
        : Math.max(
            SIDE_SCHEME_HEIGHT,
            Math.min(SIDE_SCHEME_MAX_HEIGHT, Math.floor((available - mainHeight * mains) / sides)),
          );
    const rows: SchemeRowSlot[] = [];
    let y = rect.y + pad;
    for (let index = 0; index < total; index++) {
      const kind = index < mains ? "main" : "side";
      const height = kind === "main" ? mainHeight : sideHeight;
      rows.push({ index, kind, pinned: true, rect: rowRect(y, height), scrollIndex: -1 });
      y += height + gap;
    }
    return { rows, viewport: null, heights: [], scrolls: false };
  }

  // 3: the main scheme(s) stay pinned and the sides scroll under them, when that leaves a usable viewport.
  const bottom = rect.y + rect.height - VIEWPORT_EDGE;
  const pinnedEndAt = (mainHeight: number): number => rect.y + pad + mains * mainHeight + gap * Math.max(0, mains - 1);
  const roomAt = (mainHeight: number): number => bottom - (pinnedEndAt(mainHeight) + gap);
  // The main scheme keeps its normal height while the viewport still shows two side schemes and a peek of a third.
  const pinnedMain =
    roomAt(MAIN_SCHEME_HEIGHT) >= 2 * SIDE_SCHEME_HEIGHT + gap + PEEK_HEIGHT ? MAIN_SCHEME_HEIGHT : MAIN_COMPACT_HEIGHT;
  const pinnedEnd = pinnedEndAt(pinnedMain);
  const pinMains = sides > 0 && roomAt(pinnedMain) >= SIDE_SCHEME_HEIGHT + PEEK_HEIGHT;

  const rows: SchemeRowSlot[] = [];
  let viewport: Rect;
  let scrolling: readonly number[];
  let firstTop: number;
  if (pinMains) {
    let y = rect.y + pad;
    for (let index = 0; index < mains; index++) {
      rows.push({ index, kind: "main", pinned: true, rect: rowRect(y, pinnedMain), scrollIndex: -1 });
      y += pinnedMain + gap;
    }
    const top = pinnedEnd + VIEWPORT_TOP_INSET;
    viewport = { x: rect.x + 1, y: top, width: rect.width - 2, height: bottom - top };
    scrolling = Array.from({ length: sides }, (_unused, at) => mains + at);
    firstTop = pinnedEnd + gap;
  } else {
    // Nothing pinned: the whole list, mains first, scrolls in the panel's interior.
    viewport = {
      x: rect.x + 1,
      y: rect.y + VIEWPORT_EDGE,
      width: rect.width - 2,
      height: rect.height - VIEWPORT_EDGE * 2,
    };
    scrolling = Array.from({ length: total }, (_unused, at) => at);
    firstTop = rect.y + pad;
  }

  // Row slots in screen space with the scroll at 0. The space above the first row is part of its scroll slot and
  // the space under the last part of that one, so scrolling to either end leaves the padding the panel has at rest.
  const heights: number[] = [];
  let y = firstTop;
  scrolling.forEach((index, at) => {
    const kind = index < mains ? "main" : "side";
    const height = kind === "main" ? MAIN_COMPACT_HEIGHT : SIDE_SCHEME_HEIGHT;
    rows.push({ index, kind, pinned: false, rect: rowRect(y, height), scrollIndex: at });
    const lead = at === 0 ? firstTop - viewport.y : 0;
    const trail = at === scrolling.length - 1 ? pad - VIEWPORT_EDGE : gap;
    heights.push(lead + height + trail);
    y += height + gap;
  });
  return { rows, viewport, heights, scrolls: sum(heights) > viewport.height };
}

/** `rect` as it is drawn with the list scrolled by `offset`, clipped to `viewport`; null when none of it shows. */
export function visibleSlice(rect: Rect, offset: number, viewport: Rect): Rect | null {
  const top = Math.max(rect.y - offset, viewport.y);
  const bottom = Math.min(rect.y - offset + rect.height, viewport.y + viewport.height);
  return bottom > top ? { x: rect.x, y: top, width: rect.width, height: bottom - top } : null;
}

/** Whether `rect`, drawn with the list scrolled by `offset`, lies wholly inside `viewport`. */
export function fullyVisible(rect: Rect, offset: number, viewport: Rect): boolean {
  return rect.y - offset >= viewport.y - 0.5 && rect.y - offset + rect.height <= viewport.y + viewport.height + 0.5;
}
