/**
 * Geometry of the scheme fan (`scenes/scheme-fan.ts`): every scheme in play spread out from the table's scheme stack
 * (Stack schemes, Quin 2026-11-18). A panel inset from the screen with a title bar (title left, Close right) over the
 * schemes as large sideways cards, each with its threat meter under it.
 *
 * Where they all fit in one row (a desktop or a tablet held sideways, two to four schemes) they are fanned: tilted a few
 * degrees apart along a shallow arc, like a hand of cards. Otherwise they go in a grid of rows that scrolls (a phone:
 * one full-width card a row). `slots` are the cards' upright rects with the scroll at 0, which are also their tap and
 * focus rects; the tilt and the arc lift are only how a card is drawn.
 */
import type { Rect } from "./layout.js";
import { SCHEME_CARD_ASPECT } from "./scheme-list-layout.js";

export const FAN_BAR = 48;
export const FAN_PAD = 16;
/** Under each card: the threat meter and its caption line. */
export const FAN_CAPTION = 44;
const FAN_GAP = 18;
/** No fanned card is wider than this, about the hover popover's size; nor narrower than this before it wraps to rows. */
const FAN_CARD_MAX = 520;
const FAN_CARD_MIN = 280;
/** The widest tilt, at each end of a fanned row, and how far the arc lifts the middle card. */
export const FAN_MAX_ANGLE = 6;
const FAN_ARC_LIFT = 16;

export interface SchemeFanSlot {
  /** The card upright, scroll at 0: its tap, focus and hover rect. */
  readonly card: Rect;
  /** The meter and caption under it. */
  readonly caption: Rect;
  /** Degrees the card is drawn turned by (0 in a grid). */
  readonly angle: number;
  /** Pixels the card is drawn raised by, for the arc (0 in a grid). */
  readonly lift: number;
}

export interface SchemeFanLayout {
  readonly panel: Rect;
  readonly bar: Rect;
  readonly close: Rect;
  readonly title: Rect;
  /** The window the cards are drawn in, and scroll in when they are taller than it. */
  readonly list: Rect;
  readonly columns: number;
  /** One per scrolling row: its height and the gap after it. */
  readonly rowHeights: readonly number[];
  readonly fanned: boolean;
  readonly slots: readonly SchemeFanSlot[];
}

export function schemeFanLayout(width: number, height: number, count: number): SchemeFanLayout {
  const inset = width < 600 ? 6 : 16;
  const panel: Rect = { x: inset, y: inset, width: width - inset * 2, height: height - inset * 2 };
  const bar: Rect = { x: panel.x, y: panel.y, width: panel.width, height: FAN_BAR };
  const closeWidth = width < 600 ? 88 : 104;
  const close: Rect = {
    x: panel.x + panel.width - FAN_PAD - closeWidth,
    y: panel.y + 2,
    width: closeWidth,
    height: FAN_BAR - 4,
  };
  const title: Rect = {
    x: panel.x + FAN_PAD,
    y: panel.y,
    width: Math.max(40, close.x - (panel.x + FAN_PAD) - 8),
    height: FAN_BAR,
  };
  const list: Rect = {
    x: panel.x + FAN_PAD,
    y: panel.y + FAN_BAR + FAN_PAD,
    width: panel.width - FAN_PAD * 2,
    height: panel.height - FAN_BAR - FAN_PAD * 2,
  };
  const n = Math.max(1, count);
  const fits = (columns: number): number => (list.width - FAN_GAP * (columns - 1)) / columns;
  let columns = 1;
  while (columns < n && fits(columns + 1) >= FAN_CARD_MIN) columns++;
  // A row is never taller than the window: a card shrinks until one row and its caption fit.
  const tallest = (list.height - FAN_CAPTION - FAN_ARC_LIFT) / SCHEME_CARD_ASPECT;
  const cardWidth = Math.floor(Math.max(120, Math.min(FAN_CARD_MAX, fits(columns), tallest)));
  const cardHeight = Math.round(cardWidth * SCHEME_CARD_ASPECT);
  const rows = Math.ceil(n / columns);
  const fanned = rows === 1 && n > 1;
  const rowHeight = cardHeight + FAN_CAPTION;
  const block = rowHeight + (fanned ? FAN_ARC_LIFT : 0);
  // One row stands in the middle of the window; rows that scroll start at its top.
  const top = rows === 1 ? list.y + Math.max(0, (list.height - block) / 2) + (fanned ? FAN_ARC_LIFT : 0) : list.y;
  const slots: SchemeFanSlot[] = [];
  for (let index = 0; index < count; index++) {
    const row = Math.floor(index / columns);
    const inRow = Math.min(columns, count - row * columns);
    const column = index % columns;
    const rowWidth = inRow * cardWidth + (inRow - 1) * FAN_GAP;
    const x = Math.round(list.x + (list.width - rowWidth) / 2 + column * (cardWidth + FAN_GAP));
    const y = Math.round(top + row * (rowHeight + FAN_GAP));
    // -1 at the left end of a fanned row, +1 at the right.
    const t = fanned ? (column - (inRow - 1) / 2) / Math.max(1, (inRow - 1) / 2) : 0;
    slots.push({
      card: { x, y, width: cardWidth, height: cardHeight },
      caption: { x, y: y + cardHeight + 4, width: cardWidth, height: FAN_CAPTION - 8 },
      angle: t * FAN_MAX_ANGLE,
      lift: fanned ? Math.round(FAN_ARC_LIFT * (1 - t * t)) : 0,
    });
  }
  const rowHeights = Array.from({ length: rows }, (_unused, row) =>
    row === 0 ? top - list.y + rowHeight + (rows > 1 ? FAN_GAP : 0) : rowHeight + (row < rows - 1 ? FAN_GAP : 0),
  );
  return { panel, bar, close, title, list, columns, rowHeights, fanned, slots };
}

/** The fan's title: how many schemes there are. */
export function schemeFanTitle(count: number): string {
  return `SCHEMES · ${count} IN PLAY`;
}
