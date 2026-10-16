/**
 * How the villain phase's "boost card" panel tiles the boost cards one
 * activation has revealed so far, once `villainPhaseLayout`'s `boosts` rect
 * has room for them (`villain-phase-layout.ts`).
 *
 * The panel used to be text only — a card's name, its icon count, its rules
 * text — which on a wide screen left a wide white box with a lot of empty
 * space next to the words. Real scans read faster than that text does, and
 * the physical game shows the boost card face up on the table, so each
 * revealed card gets its own thumbnail here: the scan on the left at the
 * card's own 2.5:3.5 ratio, the existing text (unchanged) to its right — the
 * text stays for accessibility (colorblind-safe, works with a screen reader,
 * survives a missing scan).
 *
 * Several boost cards can be face up in one activation (a card that boosts
 * more than once, or a boost ability that keeps flipping until an icon-less
 * card turns up), so this tiles them in a row and wraps to more rows within
 * the fixed height `villainPhaseLayout` already reserved — never overlapping,
 * the same "+N more" contract the text-only panel already had for whatever
 * doesn't fit.
 *
 * Pure function of the rect, the count and the form factor — no text
 * measurement, matching every other layout module's own rule.
 */
import type { InstanceId } from "@mc/engine";
import { CARD_ASPECT, type FormFactor, type Rect } from "./layout.js";

/** Gap between cards, and between a card's own art and text. */
const GAP = 10;
/** Padding inside one boost card's own panel, between its border and its art/text. */
const PAD_WIDE = 10;
const PAD_PHONE = 8;
/** Below this the art is a colored sliver, not a readable scan — such a card folds into "+N more" instead. */
const MIN_ART_HEIGHT = 60;
/** Room the name/icon-count/rules-text column needs to stay legible — never traded away for a taller image. */
const MIN_TEXT_WIDTH_WIDE = 200;
const MIN_TEXT_WIDTH_PHONE = 120;
/** Desktop/tablet may tile a couple of cards side by side; phone always stacks — a thumb next to a thumb is too narrow to read either at 390px. */
const MAX_COLUMNS_WIDE = 3;
const MAX_COLUMNS_PHONE = 1;

export interface BoostCardSlot {
  /** The card's own bordered panel. */
  readonly card: Rect;
  /** The scan, left-aligned within `card`, at the printed 2.5:3.5 ratio. */
  readonly art: Rect;
  /** The existing name/icon-count/rules-text column, to the right of `art`. */
  readonly text: Rect;
}

export interface BoostCardsLayout {
  readonly slots: readonly BoostCardSlot[];
  /** Boost cards revealed but not shown because the panel ran out of room — draw as "+N more", same as the text-only panel did. */
  readonly overflow: number;
}

/** `count` is how many boost cards the current activation has revealed so far — `activation.boosts.length`, never invented here. */
export function boostCardsLayout(rect: Rect, count: number, formFactor: FormFactor): BoostCardsLayout {
  if (count <= 0 || rect.width <= 0 || rect.height <= 0) return { slots: [], overflow: Math.max(0, count) };

  const phone = formFactor === "phone";
  const pad = phone ? PAD_PHONE : PAD_WIDE;
  const minTextWidth = phone ? MIN_TEXT_WIDTH_PHONE : MIN_TEXT_WIDTH_WIDE;
  const maxColumns = phone ? MAX_COLUMNS_PHONE : MAX_COLUMNS_WIDE;

  // How wide one card would be at the panel's full height, art plus its text
  // column plus padding — used only to decide a column count, never to force
  // a card to be exactly this wide (a narrow rail still gets one column).
  const fullArtHeight = Math.max(0, rect.height - pad * 2);
  const fullArtWidth = fullArtHeight * CARD_ASPECT;
  const idealCardWidth = fullArtWidth + GAP + minTextWidth + pad * 2;
  const columnsFit = Math.max(1, Math.floor((rect.width + GAP) / (idealCardWidth + GAP)));
  const columns = Math.max(1, Math.min(maxColumns, columnsFit, count));

  // Rows: as many as fit at a still-legible art height; anything past that
  // folds into the overflow count instead of drawing a sliver.
  const maxRows = Math.max(1, Math.floor((rect.height + GAP) / (MIN_ART_HEIGHT + pad * 2 + GAP)));
  const rows = Math.max(1, Math.min(maxRows, Math.ceil(count / columns)));
  const shown = Math.min(count, columns * rows);
  const overflow = count - shown;

  const cardWidth = (rect.width - (columns - 1) * GAP) / columns;
  const rowHeight = (rect.height - (rows - 1) * GAP) / rows;

  const slots: BoostCardSlot[] = [];
  for (let i = 0; i < shown; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const card: Rect = {
      x: rect.x + col * (cardWidth + GAP),
      y: rect.y + row * (rowHeight + GAP),
      width: cardWidth,
      height: rowHeight,
    };

    // The art fills the card's own height, unless that would leave the text
    // column narrower than `minTextWidth` — then the art's width (and, to
    // keep its ratio, its height) shrinks until the text column gets its due.
    const artHeightAtFullHeight = Math.max(0, card.height - pad * 2);
    const artWidthAtFullHeight = artHeightAtFullHeight * CARD_ASPECT;
    const maxArtWidth = Math.max(0, card.width - pad * 2 - GAP - minTextWidth);
    const artWidth = Math.min(artWidthAtFullHeight, maxArtWidth);
    const artHeight = artWidth / CARD_ASPECT;
    const art: Rect = {
      x: card.x + pad,
      y: card.y + (card.height - artHeight) / 2,
      width: artWidth,
      height: Number.isFinite(artHeight) ? artHeight : 0,
    };

    const text: Rect = {
      x: art.x + art.width + (artWidth > 0 ? GAP : 0),
      y: card.y + pad,
      width: Math.max(0, card.width - pad * 2 - art.width - (artWidth > 0 ? GAP : 0)),
      height: Math.max(0, card.height - pad * 2),
    };

    slots.push({ card, art, text });
  }

  return { slots, overflow };
}

/** Below this width the interrupt panel stacks the enemy's strip and the counted boost card's strip instead of pairing them. */
const SOURCE_STRIPS_SIDE_BY_SIDE = 560;
const SOURCE_STRIPS_GAP = 8;

export interface InterruptSourceStrips {
  /** The enemy whose activation the window belongs to; null when there is none. */
  readonly enemy: Rect | null;
  /** The boost card whose icons a boost-count window is about (Chaos Control, Scarlet Witch's Crest); null otherwise. */
  readonly boost: Rect | null;
  /** Where the panel's body text starts below the strips (`area.y` when neither is drawn). */
  readonly bottom: number;
}

/**
 * The inline interrupt panel's source strips. The panel replaces the boost panel while a decision is open, so a
 * boost-count window shows the counted card here, beside the enemy on a wide panel and under it on a narrow one (a
 * phone, a tablet in portrait), each at the full strip height `stripHeight` (issue #172).
 */
export function interruptSourceStrips(
  area: Rect,
  enemy: boolean,
  boost: boolean,
  stripHeight: number,
): InterruptSourceStrips {
  if (!enemy && !boost) return { enemy: null, boost: null, bottom: area.y };
  const strip = (x: number, y: number, width: number): Rect => ({ x, y, width, height: stripHeight });
  if (enemy && boost) {
    if (area.width >= SOURCE_STRIPS_SIDE_BY_SIDE) {
      const half = (area.width - SOURCE_STRIPS_GAP) / 2;
      return {
        enemy: strip(area.x, area.y, half),
        boost: strip(area.x + half + SOURCE_STRIPS_GAP, area.y, half),
        bottom: area.y + stripHeight,
      };
    }
    const second = area.y + stripHeight + SOURCE_STRIPS_GAP;
    return {
      enemy: strip(area.x, area.y, area.width),
      boost: strip(area.x, second, area.width),
      bottom: second + stripHeight,
    };
  }
  const only = strip(area.x, area.y, area.width);
  return { enemy: enemy ? only : null, boost: boost ? only : null, bottom: area.y + stripHeight };
}

/** The docked panel's boost card thumbnails under "happening now": as tall as this, or what the panel has left. */
export const BOOST_THUMB_HEIGHT = 70;
/** Shorter than this a thumbnail is a tint, not a card: the panel keeps its facedown "?" box instead. */
const BOOST_THUMB_MIN_HEIGHT = 34;
const BOOST_THUMB_GAP = 6;
/** The boost line beside the thumbnails keeps at least this much width. */
const BOOST_LINE_MIN_WIDTH = 90;

export interface BoostThumbs {
  readonly cards: readonly { readonly instanceId: InstanceId; readonly rect: Rect }[];
  /** Where the boost line starts, right of the last thumbnail. */
  readonly textX: number;
  readonly height: number;
}

/**
 * The faceup boost cards as a row of card thumbnails, left to right in flip order, starting at (`x`, `y`) within
 * `width` and `room` of height. When they don't all fit beside the line, the latest flips stay: a boost-count window is
 * always about the newest one. A landscape card (a side scheme) lies on its side. Null when there is no room for a
 * readable card (issue #172).
 */
export function boostThumbsLayout(
  x: number,
  y: number,
  width: number,
  room: number,
  ids: readonly InstanceId[],
  landscape: (instanceId: InstanceId) => boolean = () => false,
): BoostThumbs | null {
  const height = Math.min(BOOST_THUMB_HEIGHT, room);
  if (ids.length === 0 || height < BOOST_THUMB_MIN_HEIGHT) return null;
  const widthOf = (instanceId: InstanceId): number =>
    Math.round(landscape(instanceId) ? height / CARD_ASPECT : height * CARD_ASPECT);
  // Newest first until the row would leave the line less than its minimum; the newest always shows.
  const shown: InstanceId[] = [];
  let used = 0;
  for (const instanceId of [...ids].reverse()) {
    const next = used + widthOf(instanceId) + BOOST_THUMB_GAP;
    if (shown.length > 0 && next > width - BOOST_LINE_MIN_WIDTH + BOOST_THUMB_GAP) break;
    shown.unshift(instanceId);
    used = next;
  }
  let cursor = x;
  const cards = shown.map((instanceId) => {
    const rect = { x: cursor, y, width: widthOf(instanceId), height };
    cursor += rect.width + BOOST_THUMB_GAP;
    return { instanceId, rect };
  });
  return { cards, textX: cursor + 4, height };
}
