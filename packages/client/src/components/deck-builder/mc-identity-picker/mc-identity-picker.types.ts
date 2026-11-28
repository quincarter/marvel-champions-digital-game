import type { IdentityTileModel } from "../mc-identity-tile/mc-identity-tile.types.js";

/** The hero picker (New deck): a search over a grid of hero tiles. */
export interface IdentityPickerModel {
  readonly label: string;
  /** The hero search: the text the screen accepted (never a live draft). */
  readonly search: { readonly text: string; readonly placeholder: string; readonly clearLabel: string };
  readonly tiles: readonly IdentityTileModel[];
  /** What to say when no hero matches the search; null while there are tiles. */
  readonly empty: string | null;
  /** A hero tile's least width in px: a bigger Card size setting makes bigger tiles. */
  readonly tileMin: number;
}
