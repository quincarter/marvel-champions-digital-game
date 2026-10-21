/**
 * The player's play area row: every card at a readable size, scrolling sideways once they stop fitting.
 *
 * The row used to shrink its cards to fit (`cardRow`'s floor is 35% of the zone's height, then overlap). At thirteen
 * cards on a 1920px table each card was about 60px wide and its "▶ EXHAUST" strip covered the whole scan (issue
 * #119). Past a floor the cards now keep their size and the row scrolls, the way the phone's hand does
 * (`view/hand-scroll.ts`).
 *
 * Pure geometry and bookkeeping, no Phaser: `scenes/board/zones.ts#drawPlayArea` draws what this lays out.
 */

import type { InstanceId } from "@mc/engine";
import { HandScroll } from "./hand-scroll.js";
import { CARD_ASPECT, cardRow, type CardSlot, type Rect } from "./layout.js";

export const PLAY_AREA_GAP = 8;
/** A card in a crowded row is never shorter than this share of the zone's height… */
const MIN_HEIGHT_SHARE = 0.7;
/** …nor than this many pixels, where the zone is tall enough to give them. */
const MIN_HEIGHT_PX = 120;

export interface PlayAreaRow {
  /** One slot per card, left to right, before any scroll offset. */
  readonly slots: readonly CardSlot[];
  /** Whether the row runs past the zone's right edge, so it scrolls. */
  readonly scrolls: boolean;
}

/**
 * `cardScale` is the Card size setting's factor (1 at Fit to screen). Above it a card is never squeezed below the zone's
 * full height to fit the row: a bigger setting must not make the play area's cards smaller than Fit to screen draws
 * them, so the row scrolls sideways sooner instead.
 */
export function playAreaRow(inner: Rect, count: number, cardScale = 1): PlayAreaRow {
  if (count <= 0) return { slots: [], scrolls: false };
  const fitted = cardRow(inner, count, { gap: PLAY_AREA_GAP, maxHeight: inner.height });
  const share = cardScale > 1 ? 1 : MIN_HEIGHT_SHARE;
  const floor = Math.min(inner.height, Math.max(MIN_HEIGHT_PX, inner.height * share));
  if (fitted[0]!.height >= floor - 0.5) return { slots: fitted, scrolls: false };

  const width = floor * CARD_ASPECT;
  const y = inner.y + (inner.height - floor) / 2;
  const slots = Array.from({ length: count }, (_unused, index): CardSlot => ({
    x: inner.x + index * (width + PLAY_AREA_GAP),
    y,
    width,
    height: floor,
    kind: "full",
  }));
  return { slots, scrolls: slots.at(-1)!.x + width > inner.x + inner.width + 0.5 };
}

/** The part of `rect` between `area`'s left and right edges, or null when none of it is. */
export function sliceWithin(rect: Rect, area: Rect): Rect | null {
  const left = Math.max(rect.x, area.x);
  const right = Math.min(rect.x + rect.width, area.x + area.width);
  return right - left > 0.5 ? { ...rect, x: left, width: right - left } : null;
}

/**
 * The play area's scroll, kept by the scene across draws, and what the last draw saw, so the row moves by itself
 * only when something changed: a card just entered play, keyboard focus moved onto a card, or a target prompt opened
 * on cards that are all off screen. A wheel or drag scroll is never undone by the next redraw.
 */
export class PlayAreaScroll {
  readonly row: HandScroll;
  #ids: ReadonlySet<InstanceId> | null = null;
  #focus: InstanceId | null = null;
  #targets: string | null = null;

  constructor(redraw: () => void) {
    this.row = new HandScroll(redraw, { wheelWithinX: true });
  }

  /** Measures this draw's row and brings into view what the player now needs to see. Call once per draw, before drawing. */
  settle(
    area: Rect,
    ids: readonly InstanceId[],
    slots: readonly Rect[],
    focused: InstanceId | null,
    targets: readonly InstanceId[] | null,
  ): void {
    const rowRight = slots.reduce((right, slot) => Math.max(right, slot.x + slot.width), area.x);
    this.row.measure(area, rowRight);

    const known = this.#ids;
    this.#ids = new Set(ids);
    // Not on the first draw of a game (a resumed save has nothing "new" in it).
    const added = known ? ids.findIndex((id) => !known.has(id)) : -1;
    if (added >= 0) this.row.reveal(slots[added]!);

    if (focused !== this.#focus) {
      this.#focus = focused;
      const at = focused ? ids.indexOf(focused) : -1;
      if (at >= 0) this.row.reveal(slots[at]!);
    }

    const targetKey = targets ? targets.join(",") : null;
    if (targetKey !== this.#targets) {
      this.#targets = targetKey;
      const wanted = targets ? slots.filter((_slot, at) => targets.includes(ids[at]!)) : [];
      const shown = wanted.some((slot) => {
        const x = slot.x - this.row.scrollX;
        return x >= area.x - 0.5 && x + slot.width <= area.x + area.width + 0.5;
      });
      if (wanted.length > 0 && !shown) this.row.reveal(wanted[0]!);
    }
  }
}

/**
 * The column beside the play area that holds a second deck and its discard (Doctor Strange's Invocation). It grows with the
 * card size, and with a tall zone (an ultrawide window's play area is 500px tall: two 100px piles beside 500px cards
 * read as thumbnails), but never takes more than 30% of the zone.
 */
export function separateColumnWidth(zoneWidth: number, zoneHeight: number, cardScale = 1): number {
  const base = Math.min(150, Math.max(96, zoneWidth * 0.26));
  return Math.min(Math.round(Math.max(base * cardScale, zoneHeight * 0.8)), Math.round(zoneWidth * 0.3));
}

/** The heading line over a form stack (`formStackLayout`). */
export const FORM_ROW_HEADER = 16;
/** The line under a stack of more than one card: "Tap to see all 3" folded, the Collapse button fanned out. */
export const FORM_ROW_FOOTER = 26;
/** How much of each card behind the front one shows while folded, as a share of a card's width. */
const FORM_PEEK = 0.16;
/** The gap between fanned-out cards. */
const FORM_GAP = 6;
/** Fanned out, the column may take this much of the zone; the play row beside it scrolls for the rest. */
const FORM_FAN_SHARE = 0.7;

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

/** One card's step to the next, as a share of a card's width, at fan-out `t` (0 folded, 1 fanned out). */
const stepShare = (t: number): number => lerp(FORM_PEEK, 1, t);

/**
 * The column beside the play area that holds a hero's form cards (Spectrum's energy forms, issue #308). Folded (`t` 0)
 * it is as wide as the stack at the zone's height needs, at least as wide as the second-deck column and never more than
 * 30% of the zone; fanned out (`t` 1) it is as wide as every card side by side, up to 70% of the zone, and the play row
 * beside it scrolls. In between, the board is animating from one to the other. `rows` is how many rows share the
 * column's height (a form stack and any second decks).
 */
export function formColumnWidth(
  zoneWidth: number,
  zoneHeight: number,
  count: number,
  rows = 1,
  cardScale = 1,
  t = 0,
): number {
  const footer = count > 1 ? FORM_ROW_FOOTER : 0;
  const rowHeight = Math.max(0, (zoneHeight - (rows - 1) * 8) / Math.max(1, rows) - FORM_ROW_HEADER - footer);
  const cardWidth = rowHeight * CARD_ASPECT;
  const floor = separateColumnWidth(zoneWidth, zoneHeight, cardScale);
  const folded = Math.min(
    Math.round(zoneWidth * 0.3),
    Math.max(floor, Math.round(cardWidth * (1 + FORM_PEEK * Math.max(0, count - 1)))),
  );
  if (t <= 0 || count <= 1) return folded;
  const fanned = Math.min(
    Math.round(zoneWidth * FORM_FAN_SHARE),
    Math.max(folded, Math.round(count * cardWidth + (count - 1) * FORM_GAP)),
  );
  return Math.round(lerp(folded, fanned, Math.min(1, t)));
}

export interface FormStackLayout {
  /** One rect per card, front card first; each card behind sits a step further right. */
  readonly cards: readonly Rect[];
  /** The whole stack: the one tap target that fans a folded stack out. */
  readonly stack: Rect;
  /** The line under a stack of more than one card ("Tap to see all 3", or Collapse); null for one card. */
  readonly footer: Rect | null;
}

/**
 * `count` cards under the row's heading, as large as the row allows. Folded (`t` 0) they stack: the front card whole and
 * an edge of each card behind it, so a set of forms takes one card's room. Fanned out (`t` 1) they sit side by side.
 * In between, each card slides from its folded place to its fanned-out one.
 */
export function formStackLayout(row: Rect, count: number, t = 0): FormStackLayout | null {
  if (count <= 0) return null;
  const footerHeight = count > 1 ? FORM_ROW_FOOTER : 0;
  const room = {
    x: row.x,
    y: row.y + FORM_ROW_HEADER,
    width: row.width,
    height: row.height - FORM_ROW_HEADER - footerHeight,
  };
  const gaps = (count - 1) * FORM_GAP * t;
  const widthByRoom = (room.width - gaps) / (1 + (count - 1) * stepShare(t));
  const height = Math.max(0, Math.min(room.height, widthByRoom / CARD_ASPECT));
  const width = height * CARD_ASPECT;
  const step = width * stepShare(t) + FORM_GAP * t;
  const span = width + (count - 1) * step;
  const left = room.x + (room.width - span) / 2;
  const top = room.y + (room.height - height) / 2;
  const cards = Array.from({ length: count }, (_unused, index) => ({ x: left + index * step, y: top, width, height }));
  return {
    cards,
    stack: { x: left, y: top, width: span, height },
    footer: count > 1 ? { x: row.x, y: top + height + 4, width: row.width, height: FORM_ROW_FOOTER - 4 } : null,
  };
}

/** One second-deck row's height: its two piles at card proportions across the column, within the room the column has. */
export function separateRowHeight(columnHeight: number, rows: number, columnWidth: number, hasDiscard = true): number {
  const room = (columnHeight - (rows - 1) * 8) / Math.max(1, rows);
  const natural = Math.round((hasDiscard ? (columnWidth - 6) / 2 : columnWidth) / CARD_ASPECT + 14);
  return Math.min(natural, Math.max(70, room));
}

/**
 * The boxes of one second-deck row: the deck, and its discard when it has one, each a portrait card (2.5 by 3.5) as tall
 * as the room allows, so a top card shows whole and as large as the play area's own cards. A pile never stretches wider
 * than a card to fill the column (the Sense deck used to be a landscape box with its portrait upgrade cropped sideways);
 * when the column is too narrow for the full height, the piles shrink together and stay card-shaped. Left aligned.
 */
export function separatePileBoxes(
  row: { readonly x: number; readonly y: number; readonly width: number },
  height: number,
  hasDiscard: boolean,
): { readonly deck: Rect; readonly discard: Rect } {
  const gap = 6;
  const perPile = hasDiscard ? (row.width - gap) / 2 : row.width;
  const pileHeight = Math.max(0, Math.min(height, perPile / CARD_ASPECT));
  const pileWidth = pileHeight * CARD_ASPECT;
  const deck: Rect = { x: row.x, y: row.y, width: pileWidth, height: pileHeight };
  return { deck, discard: { ...deck, x: row.x + pileWidth + gap } };
}
