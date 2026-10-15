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

/** One second-deck row's height: its two piles at card proportions across the column, within the room the column has. */
export function separateRowHeight(columnHeight: number, rows: number, columnWidth: number): number {
  const room = (columnHeight - (rows - 1) * 8) / Math.max(1, rows);
  const natural = Math.round((columnWidth - 6) / 2 / CARD_ASPECT + 14);
  return Math.min(natural, Math.max(70, room));
}
