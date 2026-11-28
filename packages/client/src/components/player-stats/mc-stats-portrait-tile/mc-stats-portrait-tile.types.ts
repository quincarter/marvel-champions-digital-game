import type { PictureSource } from "@mc/ui";

/**
 * How the portrait sits: `hero` is the headline (a banner with the picture at the left, standing tall on a wide
 * Overview), `stack` a picture over the words.
 */
export type StatsPortraitVariant = "hero" | "stack";

export interface McStatsPortraitTileProps {
  variant: StatsPortraitVariant;
  label: string;
  /** The hero's or villain's name. */
  name: string;
  detail: string;
  extra: string;
  picture: PictureSource | null;
}
