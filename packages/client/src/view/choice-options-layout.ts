/**
 * Where a choice sheet's options go when the sheet is short, pure geometry.
 *
 * A phone held sideways leaves a decision sheet about 200 px of height for its options once the title bar, the
 * count line and Confirm/Decline are in. Six cards fit there in one row, but twelve do not, and a list of fifteen
 * text rows never does. The sheet used to cut the list off with "+5 more options, resize to see them", which left a
 * player with no way to answer. Now nothing is cut: when the options do not fit at a readable size they are laid out
 * at that size and the area scrolls (vertically, by the shared `McScrollRegion`). The scene owns the scrolling; this
 * file says where every option sits at scroll 0 and how tall the whole content is, so "is every option reachable"
 * is a test over numbers.
 *
 * Positions are absolute (the area's own `x`/`y` included) at scroll 0; scrolling by `offset` moves them up by it.
 */
import { CARD_ASPECT, cardChoiceSlots, type CardSlot, type Rect } from "./layout.js";

/** The shortest a card in a choice sheet may be drawn: about 69 px wide, over the 44 px touch target. */
export const CHOICE_MIN_CARD_HEIGHT = 96;
/** How tall a card is drawn in a scrolling grid when the area has the room: readable, with the next row peeking in. */
export const CHOICE_SCROLL_CARD_HEIGHT = 150;

export interface ChoiceCardLayout {
  /** One slot per option, in option order, at scroll 0. */
  readonly slots: readonly CardSlot[];
  /** Per visual row, the height it takes in the scroll (the row plus the gap under it); the last has no gap. */
  readonly rowHeights: readonly number[];
  /** Which row each option sits in. */
  readonly rowOf: readonly number[];
  /** The whole content's height, from the area's top. */
  readonly contentHeight: number;
  /** True when the content is taller than the area: the sheet then scrolls it. */
  readonly scrolls: boolean;
}

const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.5;

/**
 * The option cards of a choice sheet: `cardChoiceSlots`' row or grid while that gives whole cards at least
 * `minCardHeight` tall that all sit inside `bounds`, otherwise a grid of cards at a readable height that scrolls.
 */
export function choiceCardLayout(
  bounds: Rect,
  count: number,
  options: { readonly gap?: number; readonly minCardHeight?: number; readonly scrollCardHeight?: number } = {},
): ChoiceCardLayout {
  if (count <= 0) return { slots: [], rowHeights: [], rowOf: [], contentHeight: 0, scrolls: false };
  const gap = options.gap ?? 6;
  const minHeight = options.minCardHeight ?? CHOICE_MIN_CARD_HEIGHT;

  const base = cardChoiceSlots(bounds, count, { gap });
  const first = base[0]!;
  const overlapped = base.some(
    (a, i) =>
      i > 0 &&
      near(a.y, base[i - 1]!.y) &&
      a.x < base[i - 1]!.x + base[i - 1]!.width + gap - 0.5 &&
      base[i - 1]!.x < a.x,
  );
  const inside = base.every(
    (s) =>
      s.x >= bounds.x - 0.5 &&
      s.y >= bounds.y - 0.5 &&
      s.x + s.width <= bounds.x + bounds.width + 0.5 &&
      s.y + s.height <= bounds.y + bounds.height + 0.5,
  );
  if (!overlapped && inside && first.height >= minHeight - 0.5) {
    // The slots are already placed inside the area, so the content is the area itself: nothing to scroll.
    return {
      slots: base,
      rowHeights: [bounds.height],
      rowOf: base.map(() => 0),
      contentHeight: bounds.height,
      scrolls: false,
    };
  }

  const height = Math.max(minHeight, Math.min(bounds.height, options.scrollCardHeight ?? CHOICE_SCROLL_CARD_HEIGHT));
  const width = height * CARD_ASPECT;
  const cols = Math.max(1, Math.floor((bounds.width + gap) / (width + gap)));
  const rows = Math.ceil(count / cols);
  const slots: CardSlot[] = [];
  const rowOf: number[] = [];
  for (let index = 0; index < count; index++) {
    const row = Math.floor(index / cols);
    const inRow = Math.min(cols, count - row * cols);
    const rowWidth = width * inRow + gap * (inRow - 1);
    slots.push({
      x: bounds.x + (bounds.width - rowWidth) / 2 + (index - row * cols) * (width + gap),
      y: bounds.y + row * (height + gap),
      width,
      height,
      kind: "full",
    });
    rowOf.push(row);
  }
  const contentHeight = rows * height + (rows - 1) * gap;
  return {
    slots,
    rowHeights: Array.from({ length: rows }, (_unused, row) => height + (row < rows - 1 ? gap : 0)),
    rowOf,
    contentHeight,
    scrolls: contentHeight > bounds.height + 0.5,
  };
}

export interface ChoiceRowLayout {
  /** Each row's top, at scroll 0. */
  readonly tops: readonly number[];
  /** Each row's height plus the gap under it (the last has none) — what a scroll region's `heights` takes. */
  readonly scrollHeights: readonly number[];
  readonly contentHeight: number;
  readonly scrolls: boolean;
}

/** Text-row options of different heights stacked from `top`; `scrolls` when they outrun `areaHeight`. */
export function choiceRowLayout(top: number, areaHeight: number, heights: readonly number[], gap = 4): ChoiceRowLayout {
  const tops: number[] = [];
  let y = top;
  for (const h of heights) {
    tops.push(y);
    y += h + gap;
  }
  const contentHeight = Math.max(0, y - gap - top);
  return {
    tops,
    scrollHeights: heights.map((h, i) => h + (i < heights.length - 1 ? gap : 0)),
    contentHeight,
    scrolls: contentHeight > areaHeight + 0.5,
  };
}

/**
 * The largest scroll offset a layout allows in an area `areaHeight` tall, and the smallest offset that shows row
 * `row` whole: what a test (or the scene) needs to say "this option can be scrolled to".
 */
export function scrollExtent(contentHeight: number, areaHeight: number): number {
  return Math.max(0, contentHeight - areaHeight);
}
