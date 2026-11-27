/** A small stamp drawn on the picture foot (an aspect): its word and its colors, as CSS colors. */
export interface McPictureRowStamp {
  readonly label: string;
  readonly fill: string;
  readonly ink: string;
}

/** A list row led by a picture (a deck with its hero): picture, stamps, title, meta line, corner badge and footer. */
export interface McPictureRowModel {
  /** A small label above the card (the group this row starts), or none. */
  readonly group?: string;
  readonly title: string;
  readonly meta: string;
  /** The picture: its URL (lazy; null leaves the ground), the focal point (0 to 1 each way) and its width in px. */
  readonly picture: {
    readonly src: string | null;
    readonly focus?: { readonly x: number; readonly y: number };
    readonly width: number;
  };
  /** Stamps along the foot of the picture. */
  readonly stamps: readonly McPictureRowStamp[];
  /** A small ink badge at the bottom right (a record, "3-1"), when there is one. */
  readonly badge?: string;
  /** A line along the foot of the text (the selected row record), when there is one. */
  readonly footer?: string;
  /** The chosen row: an ink fill with paper words. */
  readonly selected: boolean;
  /** A problem row: a heavier red outline and a red title (never color alone: the outline thickens). */
  readonly alert: boolean;
  /** A row that is shown but not available: faded. */
  readonly dim: boolean;
  /** The height the group label takes from the top of the row (16). */
  readonly groupHeight?: number;
}
