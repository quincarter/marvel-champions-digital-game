/**
 * The hand zone's row, laid out whole: the player's own deck and discard piles,
 * the payment strip, and the cards in hand.
 *
 * **Why the piles live here.** A drawn card has to fly *from* somewhere and a
 * discarded one *to* somewhere, and until now the player's deck and discard
 * were a number in a caption — so draws and discards simply appeared
 * (`view/travel.ts`). The hand is the one zone every layout shows, on every
 * phone tab, so a pile beside it is always on screen to be an anchor. On the
 * long table they flank the hand the way the physical piles sit either side of
 * a player's cards; on the tabbed board, where width is scarce, they stack in
 * one narrow column at the left.
 *
 * **Why one function.** The payment strip used to be drawn at the row's left
 * edge, and the hand then centered itself in whatever width was left, which
 * opened a gap between the strip and the first card. Laying them out together
 * centers strip and hand as one group, so they always sit side by side.
 */

import { CARD_ASPECT, cardRow, type CardSlot, type Rect } from "./layout.js";

/** "flank": deck left, discard right, card-sized. "stacked": both in one narrow column at the left. */
export type PileStyle = "flank" | "stacked";

export interface HandRowOptions {
  readonly handCount: number;
  /** Tiles in the payment strip: resources on the table, plus the card being paid for when it's in play. */
  readonly tableTiles: number;
  readonly fan: boolean | "expanded";
  readonly piles: PileStyle;
  /**
   * Per hand card, whether its printed face is sideways (a player side scheme). A sideways card keeps the portrait
   * card's long side as its width, so it is wider and shorter than its neighbours and its scan shows whole.
   */
  readonly landscape?: readonly boolean[];
}

export interface HandRowLayout {
  readonly deck: Rect;
  readonly discard: Rect;
  /** Payment strip tiles, left to right. */
  readonly tiles: readonly Rect[];
  /** The rule between the strip and the hand. Null without a strip. */
  readonly rule: Rect | null;
  /** Hand card slots, before any scroll offset. */
  readonly slots: readonly CardSlot[];
  /** Where hand cards may be drawn: the row minus piles and strip. What the tabbed hand scrolls within. */
  readonly cardArea: Rect;
}

const CARD_GAP = 6;
/** Between a pile and the rest of the row. */
const PILE_GAP = 10;
/** The stacked column's width: wide enough for a count and a short label, no wider. */
const STACKED_PILE_WIDTH = 52;
/** A flanking pile never takes more of the row than this. */
const FLANK_MAX_SHARE = 0.12;
const STRIP_GAP = 6;
const RULE_WIDTH = 2;
/** A strip tile never narrower than this, and the strip never more than half the row: most payments still come from the hand. */
const STRIP_TILE_MIN = 40;
const STRIP_MAX_SHARE = 0.5;

export function handRow(inner: Rect, options: HandRowOptions): HandRowLayout {
  const { deck, discard, area } = options.piles === "stacked" ? stackedPiles(inner) : flankingPiles(inner);

  const count = options.tableTiles;
  const tileWidth =
    count > 0
      ? Math.max(
          STRIP_TILE_MIN,
          Math.min(area.height * CARD_ASPECT, (area.width * STRIP_MAX_SHARE - STRIP_GAP * count) / count),
        )
      : 0;
  const stripWidth = count > 0 ? count * (tileWidth + STRIP_GAP) + RULE_WIDTH + STRIP_GAP : 0;

  const cardArea: Rect = { ...area, x: area.x + stripWidth, width: Math.max(0, area.width - stripWidth) };
  const sideways = options.landscape?.slice(0, options.handCount) ?? [];
  const raw = sideways.some(Boolean)
    ? mixedCardRow(cardArea, options.handCount, sideways, CARD_GAP, Boolean(options.fan))
    : cardRow(cardArea, options.handCount, {
        gap: CARD_GAP,
        maxHeight: cardArea.height,
        fan: options.fan,
        align: "start",
      });
  const rowRight = raw.reduce((right, slot) => Math.max(right, slot.x + slot.width), cardArea.x);

  // Strip and hand centered together when they fit. A row that overflows — the
  // phone's fanned hand — starts at the left edge instead, and scrolls.
  const used = stripWidth + (rowRight - cardArea.x);
  const shift = used <= area.width ? (area.width - used) / 2 : 0;

  const tiles = Array.from({ length: count }, (_unused, index): Rect => ({
    x: area.x + shift + index * (tileWidth + STRIP_GAP),
    y: area.y,
    width: tileWidth,
    height: area.height,
  }));
  const rule: Rect | null =
    count > 0
      ? { x: area.x + shift + count * (tileWidth + STRIP_GAP), y: area.y, width: RULE_WIDTH, height: area.height }
      : null;

  return {
    deck,
    discard,
    tiles,
    rule,
    slots: raw.map((slot) => ({ ...slot, x: slot.x + shift })),
    cardArea,
  };
}

function flankingPiles(inner: Rect): { deck: Rect; discard: Rect; area: Rect } {
  const width = Math.min(inner.height * CARD_ASPECT, inner.width * FLANK_MAX_SHARE);
  const height = width / CARD_ASPECT;
  const y = inner.y + (inner.height - height) / 2;
  return {
    deck: { x: inner.x, y, width, height },
    discard: { x: inner.x + inner.width - width, y, width, height },
    area: {
      x: inner.x + width + PILE_GAP,
      y: inner.y,
      width: Math.max(0, inner.width - 2 * (width + PILE_GAP)),
      height: inner.height,
    },
  };
}

function stackedPiles(inner: Rect): { deck: Rect; discard: Rect; area: Rect } {
  const width = Math.min(STACKED_PILE_WIDTH, inner.width * 0.2);
  const half = (inner.height - CARD_GAP) / 2;
  return {
    deck: { x: inner.x, y: inner.y, width, height: half },
    discard: { x: inner.x, y: inner.y + half + CARD_GAP, width, height: half },
    area: {
      x: inner.x + width + PILE_GAP,
      y: inner.y,
      width: Math.max(0, inner.width - width - PILE_GAP),
      height: inner.height,
    },
  };
}

/**
 * A hand row holding sideways cards among portrait ones, left-aligned like `cardRow`'s `align: "start"`. A portrait
 * card is as tall as the row; a sideways card is as wide as that, so both share a long side. Too wide for the area
 * and not fanned: every card shrinks together (down to the same floor `cardRow` uses), then the row overlaps. Fanned
 * (the tabbed board's scrolling hand): full size, running past the area.
 */
export function mixedCardRow(
  bounds: Rect,
  count: number,
  landscape: readonly boolean[],
  gap: number,
  fan: boolean,
): readonly CardSlot[] {
  if (count <= 0) return [];
  const long = bounds.height;
  const widths = Array.from({ length: count }, (_unused, i) => (landscape[i] ? long : long * CARD_ASPECT));
  const sum = widths.reduce((total, width) => total + width, 0);
  const needed = sum + gap * (count - 1);
  const scale = fan || needed <= bounds.width ? 1 : Math.max(0.35, (bounds.width - gap * (count - 1)) / sum);
  const scaled = widths.map((width) => width * scale);
  const rowWidth = scaled.reduce((total, width) => total + width, 0) + gap * (count - 1);
  // Past the floor the cards overlap, evenly, so the row stays inside the area.
  const last = scaled[count - 1] ?? 0;
  const squeeze = fan || rowWidth <= bounds.width || rowWidth <= last ? 1 : (bounds.width - last) / (rowWidth - last);
  let offset = 0;
  return scaled.map((width, i): CardSlot => {
    const height = landscape[i] ? width * CARD_ASPECT : width / CARD_ASPECT;
    const slot: CardSlot = {
      x: bounds.x + offset * squeeze,
      y: bounds.y + (bounds.height - height) / 2,
      width,
      height,
      kind: "full",
    };
    offset += width + gap;
    return slot;
  });
}
