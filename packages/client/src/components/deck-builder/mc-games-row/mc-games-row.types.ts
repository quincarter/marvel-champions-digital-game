import type { PictureSource } from "@mc/ui";

/** One suggested card from the player's finished games: its picture, its name and a line of why, and Cut or Add. */
export interface GamesRowModel {
  readonly cardId: string;
  readonly name: string;
  /** The line under the name ("won with in 4 of 5 games"). */
  readonly detail: string;
  readonly picture: PictureSource;
  /** The button: the same as the deck list's "-" or the pool's "+" (the scene checks again); null for a card kept. */
  readonly action: { readonly label: string; readonly kind: "add" | "remove" } | null;
}
