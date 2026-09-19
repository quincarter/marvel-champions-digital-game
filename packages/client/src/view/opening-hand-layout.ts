/**
 * The setup screen's opening-hand row (`scenes/setup-deal.ts#drawOpeningHand`): a single centred row when every
 * card reads at this width, otherwise a horizontally scrolling strip of full-size cards.
 *
 * Reported from a Pixel 9 Pro XL (2026-09-19): the previous fallback — the P13 two-row grid — split a six-card
 * hand into two rows of ~80px-wide thumbnails inside a ~360px column, "nearly impossible to see". Two rows halve
 * the height each card gets, and a card's height is what makes its text legible. A strip keeps every card at the
 * row's full height (the same trade `Board - Phone`'s hand makes, `view/layout.ts#cardRow`'s `fan: "expanded"`)
 * and lets the player swipe sideways; two cards and the edge of a third are visible at a time, which is also the
 * strip's own affordance that there is more to the right. `HandScroll` (`view/hand-scroll.ts`) owns the offset.
 *
 * Nothing here imports Phaser: the scene draws what this returns and subtracts the scroll offset itself.
 */
import { cardRow, type Rect } from "./layout.js";

/** Below this card width, a single row no longer reads (the cost pip and title line are the first to go). */
export const READABLE_CARD_WIDTH = 90;
/** Gap between cards in either presentation. */
const CARD_GAP = 8;
/** Room reserved under the strip for the scroll indicator: a 4px track with breathing room above it. */
const INDICATOR_ROOM = 10;
const INDICATOR_HEIGHT = 4;
/** The indicator's thumb never shrinks below this, so a long strip still shows a grabbable-looking bar. */
const MIN_THUMB_WIDTH = 24;

export type OpeningHandMode = "row" | "strip";

export interface OpeningHandLayout {
  readonly mode: OpeningHandMode;
  /** One slot per card, unscrolled. In "strip" mode the last slots run past `viewport`'s right edge. */
  readonly slots: readonly Rect[];
  /** Where cards are visible: the whole rect for a row, the rect above the indicator for a strip (the scene clips to it). */
  readonly viewport: Rect;
  /** The strip's full content width from `viewport.x` to the last card's right edge; equals the row's width otherwise. */
  readonly contentWidth: number;
  /** The scroll indicator's track, "strip" mode only. */
  readonly indicator: Rect | null;
}

export function openingHandLayout(rect: Rect, count: number): OpeningHandLayout {
  const row = cardRow(rect, count, { gap: CARD_GAP, maxHeight: rect.height });
  if (count <= 4 || (row[0]?.width ?? 0) >= READABLE_CARD_WIDTH) {
    const right = row.reduce((max, slot) => Math.max(max, slot.x + slot.width), rect.x);
    return { mode: "row", slots: row, viewport: rect, contentWidth: right - rect.x, indicator: null };
  }

  const viewport: Rect = { x: rect.x, y: rect.y, width: rect.width, height: Math.max(1, rect.height - INDICATOR_ROOM) };
  const slots = cardRow(viewport, count, { gap: CARD_GAP, maxHeight: viewport.height, fan: "expanded", align: "start" });
  const right = slots.reduce((max, slot) => Math.max(max, slot.x + slot.width), viewport.x);
  const indicator: Rect = { x: rect.x, y: rect.y + rect.height - INDICATOR_HEIGHT, width: rect.width, height: INDICATOR_HEIGHT };
  return { mode: "strip", slots, viewport, contentWidth: right - viewport.x, indicator };
}

/** How far a strip can scroll: the content past the viewport's right edge, never negative. */
export function openingHandMaxScroll(layout: OpeningHandLayout): number {
  return Math.max(0, layout.contentWidth - layout.viewport.width);
}

/**
 * The indicator's thumb for a strip at `scrollX`, or null when the strip fits (nothing to indicate — the track
 * hides too, so a hand that happens to fit exactly doesn't carry a full-width bar for no reason).
 */
export function openingHandThumb(layout: OpeningHandLayout, scrollX: number): Rect | null {
  const { indicator } = layout;
  if (!indicator || layout.mode !== "strip") return null;
  const maxScroll = openingHandMaxScroll(layout);
  if (maxScroll <= 0) return null;
  const visibleShare = layout.viewport.width / layout.contentWidth;
  const width = Math.max(MIN_THUMB_WIDTH, Math.round(indicator.width * visibleShare));
  const travel = indicator.width - width;
  const progress = Math.min(1, Math.max(0, scrollX / maxScroll));
  return { x: indicator.x + Math.round(travel * progress), y: indicator.y, width, height: indicator.height };
}
