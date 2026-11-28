import type { PictureSource } from "@mc/ui";

/** The chosen identity above the builder: one card-like row with the hero's picture, name and a "Read card" cue. */
export interface IdentityRowModel {
  readonly cardId: string;
  readonly label: string;
  readonly name: string;
  readonly cue: string;
  readonly picture: PictureSource;
}
