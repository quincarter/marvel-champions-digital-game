import type { PastGameActionButton } from "../mc-past-game-actions/mc-past-game-actions.types.js";
import type { PastGamePicture } from "../mc-past-game-pictures/mc-past-game-pictures.types.js";
import type { PastGameSeatModel } from "../mc-past-game-seat/mc-past-game-seat.types.js";
import type { PastGameSummaryModel } from "../mc-past-game-summary/mc-past-game-summary.types.js";

/** One game's details: the side panel beside the list, or a phone's popup over it. */
export interface PastGameDetailsModel {
  readonly id: string;
  readonly pictures: readonly PastGamePicture[];
  readonly summary: PastGameSummaryModel;
  /** Every seat at the table, in seat order. */
  readonly seats: readonly PastGameSeatModel[];
  readonly actions: readonly PastGameActionButton[];
  /** An action (or the file picker) is running. */
  readonly busy: boolean;
  /** The popup's close button, spoken. */
  readonly closeLabel: string;
}

export interface McPastGameDetailsProps {
  readonly model: PastGameDetailsModel | null;
  /** A phone's popup: a scrim over the screen and a close button, instead of a panel beside the list. */
  readonly popup: boolean;
}
