import type { GamesRowModel } from "../mc-games-row/mc-games-row.types.js";

/** A titled list of suggested cards ("Cards to cut", "Try adding", "Keep"). */
export interface GamesSectionModel {
  /** `cut`, `try`, `wins`, `losses`, `keep`: part of each picture's key. */
  readonly id: string;
  readonly title: string;
  readonly rows: readonly GamesRowModel[];
}
