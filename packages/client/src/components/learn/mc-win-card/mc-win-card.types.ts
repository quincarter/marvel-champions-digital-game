import type { PictureSource } from "@mc/ui";

/** The stamp's fill: green for the win, red for a loss. */
export type WinCardTone = "heal" | "red";

/** Beside the words, or over them. */
export type WinCardLayout = "row" | "column";

/** The properties of `mc-win-card`. */
export interface WinCardProps {
  readonly tag: string;
  readonly tone: WinCardTone;
  readonly heading: string;
  readonly picture: PictureSource | null;
  readonly cardId: string;
  readonly face: unknown;
  readonly art: "portrait" | "landscape";
  readonly layout: WinCardLayout;
  /** The scan takes the card's whole height. */
  readonly fill: boolean;
  /** Names the scan in the page (`data-key`), for tests. */
  readonly scanKey: string;
}
