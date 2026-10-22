/**
 * Two or three villains (Tower Defense's Proxima Midnight and Corvus Glaive, the Wrecking Crew's trio) drawn the way a
 * lone villain is: the full wide panel, a card-shaped scan with the name, stage, stat badges and hit point plate beside
 * it, side by side and scaled to fit the enemies zone. Pure geometry; `scenes/board/zones.ts` only draws what this
 * decides. Many villains (the Sinister Six, the Four Horsemen) never come here: they keep the compact tile row
 * (`villain-tile-layout.ts`), because panels at a readable size would not fit.
 */

import { CARD_ASPECT, PANEL_TEXT_INSETS, PANEL_TEXT_MIN_WIDTH, type Rect } from "./layout.js";

/** The most villains drawn as full panels; past this the compact tile row is used. */
export const VILLAIN_PANEL_MAX_COUNT = 3;
/** The shortest a panel is drawn: the single villain's own floor, where its stat badges and HP plate still read. */
export const VILLAIN_PANEL_MIN_HEIGHT = 128;
/** The gap between two panels. */
export const VILLAIN_PANEL_GAP = 10;
/** Air added to the text column beyond its minimum, so "ATK 2 / SCH 1" badges and an ACTIVE chip sit comfortably. */
const TEXT_AIR = 50;

/** The width of a wide panel `height` tall: the card at that height plus a readable text column. */
export function villainPanelWidth(height: number): number {
  return Math.round((height - 6) * CARD_ASPECT) + PANEL_TEXT_MIN_WIDTH + PANEL_TEXT_INSETS + TEXT_AIR;
}

/** The tallest panel whose `count` copies, with `gap` between them, fit in `width`. */
function tallestFitting(width: number, count: number, gap: number): number {
  const each = (width - gap * (count - 1)) / count;
  return Math.floor((each - PANEL_TEXT_MIN_WIDTH - PANEL_TEXT_INSETS - TEXT_AIR) / CARD_ASPECT) + 6;
}

export interface VillainPanelPlan {
  readonly tileWidth: number;
  readonly tileHeight: number;
  /** Every panel's rect, left to right, from `origin`. */
  readonly slots: readonly Rect[];
  /** The right edge of the last panel, for whatever sits beside them. */
  readonly right: number;
}

/**
 * Where `count` villain panels go in `room` (the band's x, y and width, and the tallest a panel may be), keeping
 * `reserveRight` px free to their right for an environment. Null when `count` is not 2..3 or the panels would have to
 * be shorter than `VILLAIN_PANEL_MIN_HEIGHT` to fit: the caller then draws the compact tile row.
 */
export function villainPanelPlan(
  room: Pick<Rect, "x" | "y" | "width">,
  count: number,
  height: number,
  reserveRight = 0,
  gap = VILLAIN_PANEL_GAP,
): VillainPanelPlan | null {
  if (count < 2 || count > VILLAIN_PANEL_MAX_COUNT) return null;
  const tileHeight = Math.min(height, tallestFitting(room.width - reserveRight, count, gap));
  if (tileHeight < VILLAIN_PANEL_MIN_HEIGHT) return null;
  const tileWidth = villainPanelWidth(tileHeight);
  const slots = Array.from({ length: count }, (_unused, index) => ({
    x: room.x + index * (tileWidth + gap),
    y: room.y,
    width: tileWidth,
    height: tileHeight,
  }));
  return { tileWidth, tileHeight, slots, right: room.x + count * tileWidth + (count - 1) * gap };
}
