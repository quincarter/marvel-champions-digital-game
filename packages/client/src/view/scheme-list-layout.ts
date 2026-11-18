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
const BASE_MAIN_HEIGHT = MAIN_SCHEME_HEIGHT;
const BASE_MAIN_MAX_HEIGHT = MAIN_SCHEME_MAX_HEIGHT;
const BASE_MAIN_COMPACT = MAIN_COMPACT_HEIGHT;
const BASE_SIDE_HEIGHT = SIDE_SCHEME_HEIGHT;
const BASE_SIDE_MAX_HEIGHT = SIDE_SCHEME_MAX_HEIGHT;
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
  /**
   * The Card size setting's factor (1 when omitted): every row height is multiplied by it, so a larger Card size shows a
   * larger scheme card, the way it does every other card on the table.
   */
  readonly scale?: number;
  /**
   * Pixels the main scheme row needs past its normal height for lines of its own (The Collection's count, issue #173),
   * added to the normal height; a row grown past that already has the room, and a compact main row does without.
   */
  readonly mainExtra?: number;
}

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

export function schemeListLayout(rect: Rect, input: SchemeListInput): SchemeListLayout {
  const { mains, sides, tabbed } = input;
  const k = Math.max(1, input.scale ?? 1);
  const extra = input.mainExtra ?? 0;
  const MAIN_SCHEME_HEIGHT = Math.round(BASE_MAIN_HEIGHT * k) + extra;
  // A tall zone (an ultrawide's 600px column) lets the main scheme grow past the 1440x900 ceiling, so its card is not
  // a 96px strip in a panel that size; the usual ceiling stands wherever the panel is no taller than that.
  const MAIN_SCHEME_MAX_HEIGHT = Math.max(
    MAIN_SCHEME_HEIGHT,
    Math.round(Math.max(BASE_MAIN_MAX_HEIGHT * k, Math.min(240 * k, (rect.height - SCHEME_PANEL_PADDING * 2) * 0.36))),
  );
  const MAIN_COMPACT_HEIGHT = Math.round(BASE_MAIN_COMPACT * k);
  const SIDE_SCHEME_HEIGHT = Math.round(BASE_SIDE_HEIGHT * k);
  const SIDE_SCHEME_MAX_HEIGHT = Math.round(BASE_SIDE_MAX_HEIGHT * k);
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

/**
 * How a row draws its card under the Large schemes setting: "beside" keeps the text and meter in a column on the right
 * of a large card (a wide panel), "above" puts the card across the row with the text and meter under it (a narrow one).
 * `cardWidth` is the card's drawn width; its height is that times `SCHEME_CARD_ASPECT`.
 */
export interface LargeSchemeShape {
  readonly mode: "beside" | "above";
  readonly cardWidth: number;
}

/** A scheme card's height over its width: the printed card is sideways, 3.5 wide by 2.5 tall. */
export const SCHEME_CARD_ASPECT = 2.5 / 3.5;
/** The narrowest text column beside a large card: the name, the subtitle and a meter that still reads. */
export const LARGE_TEXT_MIN_WIDTH = 170;
/**
 * The room under an "above" card for the subtitle and the meter (the name is printed on the card right above). The
 * lines a scheme adds (counters, an ability, tucked cards, area notes) come on top, as `infoExtra`.
 */
export const LARGE_INFO_HEIGHT = 52;
/** No large scheme card is drawn wider than this, however big the panel: about the hover popover's own size. */
export const LARGE_CARD_MAX_WIDTH = 560;
/** The frame inset around the card and the gap and rule between it and the text column (`schemes.ts`). */
const LARGE_ART_INSET = 3;
/** How much of the next large scheme shows under a whole one. */
const LARGE_PEEK_HEIGHT = 36;
const LARGE_BESIDE_GUTTER = 8 + 6 + 8;

export interface LargeSchemeListLayout extends SchemeListLayout {
  readonly shape: LargeSchemeShape;
}

/**
 * The Large schemes setting's rows (the owner, 2026-11-17, from a player's request): every scheme, main and side alike,
 * drawn as a large card the way the hover popover shows it, without hovering. The table's own layout never changes for
 * it, so the table never scrolls: each row is sized so one whole row fits the panel, and when they don't all fit the
 * list scrolls inside the panel, mains first (nothing is pinned, since a pinned large main scheme would leave no room).
 *
 * The card goes beside the text column where that gives the larger card, else above the text.
 */
export function largeSchemeListLayout(
  rect: Rect,
  input: {
    readonly mains: number;
    readonly sides: number;
    /** Pixels the tallest scheme's own lines need under an "above" card (`LARGE_INFO_HEIGHT`). */
    readonly infoExtra?: number;
  },
): LargeSchemeListLayout {
  const pad = SCHEME_PANEL_PADDING;
  const gap = SCHEME_ROW_GAP;
  const width = rect.width - pad * 2;
  const inner = rect.height - pad * 2;
  const info = LARGE_INFO_HEIGHT + (input.infoExtra ?? 0);
  const inset = LARGE_ART_INSET * 2;
  const total = input.mains + input.sides;
  // With more than one scheme the row leaves a peek of the next under it, so the panel reads as a list to scroll.
  const room = total > 1 ? inner - gap - LARGE_PEEK_HEIGHT : inner;

  // Beside: the card is as tall as the panel allows, narrowed until the text column keeps its minimum width.
  const besideWidth = Math.max(
    0,
    Math.min((room - inset) / SCHEME_CARD_ASPECT, width - LARGE_BESIDE_GUTTER - LARGE_TEXT_MIN_WIDTH),
  );
  // Above: the card spans the row, shortened until the text under it still fits the panel.
  const aboveWidth = Math.max(0, Math.min(width - inset, (room - inset - info) / SCHEME_CARD_ASPECT));
  const mode = besideWidth >= aboveWidth ? "beside" : "above";
  const cardWidth = Math.floor(Math.min(LARGE_CARD_MAX_WIDTH, mode === "beside" ? besideWidth : aboveWidth));
  const cardHeight = Math.round(cardWidth * SCHEME_CARD_ASPECT);
  const rowHeight = mode === "beside" ? cardHeight + inset : cardHeight + inset + info;
  const shape: LargeSchemeShape = { mode, cardWidth };

  const x = rect.x + pad;
  const rows: SchemeRowSlot[] = [];
  if (total * rowHeight + gap * Math.max(0, total - 1) <= inner) {
    let y = rect.y + pad;
    for (let index = 0; index < total; index++) {
      const kind = index < input.mains ? "main" : "side";
      rows.push({ index, kind, pinned: true, rect: { x, y, width, height: rowHeight }, scrollIndex: -1 });
      y += rowHeight + gap;
    }
    return { rows, viewport: null, heights: [], scrolls: false, shape };
  }

  const viewport: Rect = {
    x: rect.x + 1,
    y: rect.y + VIEWPORT_EDGE,
    width: rect.width - 2,
    height: rect.height - VIEWPORT_EDGE * 2,
  };
  const firstTop = rect.y + pad;
  const heights: number[] = [];
  let y = firstTop;
  for (let index = 0; index < total; index++) {
    const kind = index < input.mains ? "main" : "side";
    rows.push({ index, kind, pinned: false, rect: { x, y, width, height: rowHeight }, scrollIndex: index });
    const lead = index === 0 ? firstTop - viewport.y : 0;
    const trail = index === total - 1 ? pad - VIEWPORT_EDGE : gap;
    heights.push(lead + rowHeight + trail);
    y += rowHeight + gap;
  }
  return { rows, viewport, heights, scrolls: sum(heights) > viewport.height, shape };
}

/** The Stack schemes header: the "1 of 3" count, the arrows and Fan out. */
export const STACK_HEADER_HEIGHT = 30;
/** How much of each card behind the front one shows above it: its printed name band. */
export const STACK_PEEK = 22;
/** At most this many cards show behind the front one; the count says how many more. */
export const STACK_MAX_BEHIND = 3;
/** Each card further back is this much narrower on each side, so the stack reads as a deck seen from the front. */
const STACK_INSET_STEP = 8;

export interface SchemeStackLayout {
  /** The header strip across the top of the panel. */
  readonly header: Rect;
  /** The front card's row and its card shape, as `largeSchemeListLayout` places a single scheme. */
  readonly front: { readonly rect: Rect; readonly shape: LargeSchemeShape };
  /**
   * The cards behind, nearest first: where each card is drawn (mostly hidden behind the one in front) and `peek`, the
   * band of it that shows, which is its tap, focus and target rect.
   */
  readonly behind: readonly { readonly card: Rect; readonly peek: Rect }[];
}

/**
 * The Stack schemes setting (Quin, 2026-11-18): every scheme in play stacked in the panel like a deck, the front one a
 * large card (`largeSchemeListLayout`'s single row) and up to `STACK_MAX_BEHIND` more behind it, each showing its name
 * band above the card in front. Nothing scrolls: the stack always fits the panel.
 */
export function schemeStackLayout(rect: Rect, count: number, infoExtra = 0): SchemeStackLayout {
  const pad = SCHEME_PANEL_PADDING;
  const header: Rect = {
    x: rect.x + pad,
    y: rect.y + pad - 4,
    width: rect.width - pad * 2,
    height: STACK_HEADER_HEIGHT,
  };
  const behindCount = Math.max(0, Math.min(STACK_MAX_BEHIND, count - 1));
  const top = header.y + header.height + 2 + behindCount * STACK_PEEK;
  // The front row is laid out as a lone large scheme in what is left under the header and the peeks.
  const room: Rect = { x: rect.x, y: top - pad, width: rect.width, height: rect.y + rect.height - (top - pad) };
  const single = largeSchemeListLayout(room, { mains: 1, sides: 0, infoExtra });
  const frontRect = single.rows[0]!.rect;
  const art = schemeRowGeometry(frontRect, 0, single.shape).art;
  // A panel too small for any card keeps the front row alone.
  const behind = Array.from({ length: art ? behindCount : 0 }, (_unused, at) => {
    const depth = at + 1;
    const inset = Math.min(depth * STACK_INSET_STEP, art!.width / 4);
    const card: Rect = {
      x: art!.x + inset,
      y: art!.y - depth * STACK_PEEK,
      width: art!.width - inset * 2,
      height: art!.height,
    };
    return { card, peek: { ...card, height: STACK_PEEK } };
  });
  return { header, front: { rect: frontRect, shape: single.shape }, behind };
}

/** The order the stack draws in from the scheme at the front: that one, then the rest in play order, wrapping around. */
export function stackOrder<T>(items: readonly T[], frontIndex: number): readonly T[] {
  if (items.length === 0) return [];
  const front = ((frontIndex % items.length) + items.length) % items.length;
  return [...items.slice(front), ...items.slice(0, front)];
}

/**
 * Where a scheme row's card and its text go: the card in a column on the left (the usual row, and a large "beside"
 * row) or across the top (a large "above" row), and the text, the notes and the meter in what is left.
 * `art` is null for a row too narrow for a card.
 */
export function schemeRowGeometry(
  rect: Rect,
  artWidth: number,
  large: LargeSchemeShape | null = null,
): { readonly art: Rect | null; readonly text: Rect; readonly above: boolean } {
  if (large?.mode === "above") {
    const cardHeight = Math.round(large.cardWidth * SCHEME_CARD_ASPECT);
    const art: Rect = {
      x: rect.x + Math.max(LARGE_ART_INSET, Math.round((rect.width - large.cardWidth) / 2)),
      y: rect.y + LARGE_ART_INSET,
      width: large.cardWidth,
      height: cardHeight,
    };
    const top = art.y + art.height + 3;
    return {
      art,
      text: { x: rect.x + 8, y: top, width: rect.width - 16, height: rect.y + rect.height - top },
      above: true,
    };
  }
  const width = large ? large.cardWidth : artWidth;
  const art: Rect | null =
    width > 0 ? { x: rect.x + LARGE_ART_INSET, y: rect.y + LARGE_ART_INSET, width, height: rect.height - 6 } : null;
  const left = rect.x + 8 + (width > 0 ? width + 6 : 0);
  return {
    art,
    text: { x: left, y: rect.y, width: rect.x + rect.width - 8 - left, height: rect.height },
    above: false,
  };
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
