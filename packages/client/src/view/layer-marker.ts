/**
 * Where the pad's hold-layer marker sits on the play area: the rest-state RT glyph and, under RT, the "LB RB page n/m"
 * marker (`scenes/board.ts#registerLayerHints`). Both live in the zone's header row, just past the "YOUR PLAY AREA"
 * caption, on the long table and the phone's tabbed board alike.
 *
 * A row that scrolls writes "N CARDS" at the header's right end (`scenes/board/zones.ts#drawPlayArea`). When the marker
 * would run into it (a narrow phone, a form column taking width) it moves just above the zone instead, over the gutter,
 * rather than covering either text or the tabs.
 */

import type { Rect } from "./layout.js";

/** The caption's own left inset and its width (the "YOUR PLAY AREA" label at the label size). */
export const CAPTION_INSET = 8;
export const CAPTION_WIDTH = 124;
/** The "N CARDS" count's room at the header's right end, with its gap. */
export const COUNT_ROOM = 76;
/** The header row's centre line below the zone's top. */
export const HEADER_CENTER = 12;
const GAP = 8;

export interface MarkerSpot {
  /** The marker's left edge. */
  readonly x: number;
  /** Its vertical centre. */
  readonly y: number;
}

export function layerMarkerSpot(
  zone: Rect,
  marker: { readonly width: number; readonly height: number; readonly countShown: boolean },
): MarkerSpot {
  const x = zone.x + CAPTION_INSET + CAPTION_WIDTH;
  const right = zone.x + zone.width - GAP - (marker.countShown ? COUNT_ROOM : 0);
  if (x + marker.width <= right) return { x, y: zone.y + HEADER_CENTER };
  return { x: zone.x + CAPTION_INSET, y: Math.max(marker.height / 2, zone.y - marker.height / 2 - 2) };
}
