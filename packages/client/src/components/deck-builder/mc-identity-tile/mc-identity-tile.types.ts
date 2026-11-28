import type { PictureSource } from "@mc/ui";

/** One hero on the picker: the hero's art over a name bar. */
export interface IdentityTileModel {
  /** The identity card's id: the tile is the `identity:<id>` stop. */
  readonly id: string;
  readonly name: string;
  readonly picture: PictureSource;
}
