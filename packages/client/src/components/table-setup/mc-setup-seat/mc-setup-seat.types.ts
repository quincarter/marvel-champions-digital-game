import type { PictureSource } from "@mc/ui";
import type { SeatCell } from "../mc-setup-seating/mc-setup-seating.types.js";

/** What one seat shows: the cell and the hero's picture. */
export interface SeatInput {
  readonly seat: SeatCell;
  readonly picture: PictureSource | null;
}
