import type { PastGameRowModel } from "../mc-past-game-row/mc-past-game-row.types.js";

/** The list: a row per game, or one sentence in place of rows (still reading, no games, no match). */
export interface PastGamesListModel {
  readonly rows: readonly PastGameRowModel[];
  /** What the list says instead of rows, or null when there are rows. */
  readonly empty: string | null;
}

export interface McPastGamesListProps {
  readonly model: PastGamesListModel;
}
