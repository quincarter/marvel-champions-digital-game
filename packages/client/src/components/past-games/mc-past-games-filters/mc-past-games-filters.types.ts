import type { ControlGlyph, TabRailTab } from "@mc/ui";
import type { PastGameFilter } from "../../../view/past-games-model.js";

export interface McPastGamesFiltersProps {
  /** All, Wins and Losses with their counts ("All (12)"), ids from `PAST_GAME_FILTERS`. */
  readonly tabs: readonly TabRailTab[];
  readonly selected: PastGameFilter;
  /** LB / RB over the strip's right end, on a pad only; undefined for none. */
  readonly glyph: ControlGlyph | undefined;
}
