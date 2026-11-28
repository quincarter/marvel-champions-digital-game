import type { PastGamePicture } from "../mc-past-game-pictures/mc-past-game-pictures.types.js";
import type { PastGameSummaryModel } from "../mc-past-game-summary/mc-past-game-summary.types.js";

/** One game in the list. */
export interface PastGameRowModel {
  readonly id: string;
  /** The game whose details show now: the heavy red frame (and `aria-pressed`). */
  readonly selected: boolean;
  /** A spoken name for the row ("Won: Rhino · Spider-Man"). */
  readonly label: string;
  readonly pictures: readonly PastGamePicture[];
  readonly summary: PastGameSummaryModel;
}

export interface McPastGameRowProps {
  readonly model: PastGameRowModel | null;
}
