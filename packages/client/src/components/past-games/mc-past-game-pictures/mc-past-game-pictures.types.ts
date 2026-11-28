import type { PictureSource } from "@mc/ui";
import type { AspectBadge } from "../mc-past-game-aspects/mc-past-game-aspects.types.js";

/** One picture of a game: the villain's (first) or a hero's. */
export interface PastGamePicture {
  /** The card the picture stands for, for the hover popover and Inspect; null when the pool does not know it. */
  readonly cardId: string | null;
  /** The scan or hero artwork (leased by the scene), with the name printed on it when there is no art (#758). */
  readonly picture: PictureSource;
  /** A hero's aspect chips along its foot; empty for the villain and for a seat with none. */
  readonly badges: readonly AspectBadge[];
}

/** `row`: the list's pictures; `detail`: the larger ones in the details (the villain larger, the heroes beside it). */
export type PastGamePicturesSize = "row" | "detail";

export interface McPastGamePicturesProps {
  readonly pictures: readonly PastGamePicture[];
  readonly size: PastGamePicturesSize;
}
