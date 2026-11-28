import type { ControlGlyph } from "@mc/ui";
import type { StatsEventDetail } from "../shared/stats-events.types.js";

/** One chip of a row: its words, whether it is on, and what a press of it says. */
export interface StatsChipModel {
  /** The chip's focus stop (`filter:hero`, `grid:flip`). */
  readonly key: string;
  readonly label: string;
  readonly selected: boolean;
  readonly action: StatsEventDetail;
  /** The key or pad glyph hung on the chip while a keyboard or pad is in use. */
  readonly glyph?: ControlGlyph | undefined;
}

export interface McStatsChipRowProps {
  chips: readonly StatsChipModel[];
  /** One row that swipes sideways (a phone's), rather than wrapping to more rows. */
  swipe: boolean;
}
