import type { PictureSource } from "@mc/ui";
import type { FaceRef } from "../../../view/civil-war-builder-art.js";

/** A set's picture: its most recognizable card's scan, and which card it is (for the hover popover). */
export interface SetPicture {
  readonly source: PictureSource;
  readonly cardId: string;
  readonly face?: FaceRef["face"];
}

/** What one modular set tile shows. */
export interface SetTileInput {
  readonly id: string;
  readonly name: string;
  /** The count line ("CHOSEN · 6 CARDS"), already translated; a barred set's reason stands in for the count. */
  readonly label: string;
  readonly selected: boolean;
  /** The scenario may not use it: faded, and a tap does nothing. */
  readonly barred: boolean;
  readonly dim: boolean;
  readonly picture: SetPicture | null;
}
