import type { StatTile } from "@mc/ui";

export interface McDeckGroupTilesProps {
  /** The heading ("COMPOSITION BY ASPECT"). */
  heading: string;
  /** One tile per group of the deck ("Justice 14"). */
  tiles: readonly StatTile[];
  /** What to say when the deck has no cards yet. */
  empty: string;
}
