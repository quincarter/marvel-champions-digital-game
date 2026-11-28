import type { PictureSource } from "@mc/ui";

/** The seat hero above a per-seat call: portrait, "SEAT 1 · COLOSSUS" and the aspects its deck runs. */
export interface SeatHeaderModel {
  /** Already capitalised. */
  readonly title: string;
  readonly picture: PictureSource | null;
  readonly stamps: readonly { readonly aspect: string; readonly label: string }[];
}
