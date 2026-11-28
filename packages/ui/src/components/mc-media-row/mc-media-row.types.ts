import type { PictureFit } from "../../shared/picture.types.js";

/** A small stamp drawn on the picture foot (an aspect): its word and its colors, as CSS colors. */
export interface McMediaRowStamp {
  readonly label: string;
  readonly fill: string;
  readonly ink: string;
}

/**
 * Everything a media row shows (`mc-media-row`), in its two looks: the `pack` look (the Mod Store tile: a 5:7 picture, a
 * heading, meta, a two line summary, a note and a state badge along the foot) and the `deck` look (a deck with its hero:
 * a picture with aspect stamps on its foot, a two line display title, a meta line, a record badge in the corner, a footer
 * line, an optional group label above, and chosen, problem and faded states).
 */
export interface McMediaRowModel {
  /** The title: one line cut with an ellipsis in the pack look, two lines of display type in the deck look. */
  readonly heading: string;
  readonly meta?: string;
  /** Up to two lines under the meta (pack look). */
  readonly summary?: string;
  /** A note along the foot, left: a size in the pack look, the chosen row record in the deck look. */
  readonly foot?: string;
  /** The state badge: along the foot at the right in the pack look, an ink badge in the corner in the deck look. */
  readonly badge?: string;
  /** The pack look badge is the call to action (a red fill) rather than an outline. */
  readonly solid?: boolean;
  /** The picture URL (lazy); null leaves the ground, or the `letter`. */
  readonly src: string | null;
  /** What the picture box says in big faint type while it has no picture (the pack initial). */
  readonly letter?: string;
  /** Names where `src` came from, so a stale URL can be asked for again (`mc-image-error`). */
  readonly retry?: string;
  readonly focusX?: number;
  readonly focusY?: number;
  /** The crop is centered on the focal point and kept inside the picture (a hero `focus.json`), not a share of the overflow. */
  readonly focusCentered?: boolean;
  readonly fit?: PictureFit;
  /** `pack` (default) or `deck`. */
  readonly look?: "pack" | "deck";
  /** The picture width in px; absent, the pack look is 5:7 of the row height. */
  readonly artWidth?: number;
  /** Stamps along the foot of the picture (deck look). */
  readonly stamps?: readonly McMediaRowStamp[];
  /** A small label above the card (the group this row starts), deck look. */
  readonly group?: string;
  /** The height the group label takes from the top of the row (16). */
  readonly groupHeight?: number;
  /** The chosen row: an ink fill with paper words (deck look). */
  readonly selected?: boolean;
  /** A problem row: a heavier red outline and a red title; never color alone, the outline thickens (deck look). */
  readonly alert?: boolean;
  /** A row that is shown but not available: faded (deck look). */
  readonly dim?: boolean;
}
