import type { ControlGlyph, TabRailTab } from "@mc/ui";
import type { StatsChipModel } from "../mc-stats-chip-row/mc-stats-chip-row.types.js";
import type { StatsMode } from "../shared/stats-events.types.js";

export interface McStatsTabsProps {
  tabs: readonly TabRailTab[];
  /** The chosen tab's id. */
  selected: string;
  /** LB / RB's glyphs over the row, while a keyboard or pad is in use. */
  glyph: ControlGlyph | undefined;
  /** A phone's Filters chip, which takes the right end of the tab row. */
  toggle: StatsChipModel | null;
  mode: StatsMode;
}
