import type { PictureSource } from "@mc/ui";

/** One card of a strip: the card, what the stats say of it, and its picture. */
export interface StatsCardModel {
  /** The card's focus stop: `card:<strip id>:<card id>`. */
  readonly key: string;
  readonly cardId: string;
  /** "12 played", "3 times". */
  readonly value: string;
  readonly detail: string;
  readonly picture: PictureSource | null;
}

export interface McStatsCardProps {
  card: StatsCardModel | null;
}
