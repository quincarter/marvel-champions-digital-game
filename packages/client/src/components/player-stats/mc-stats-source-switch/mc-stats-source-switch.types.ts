import type { ControlGlyph } from "@mc/ui";
import type { StatsSourceName } from "../shared/stats-events.types.js";

export interface McStatsSourceSwitchProps {
  /** Whose numbers are on show. */
  source: StatsSourceName;
  /** The two segments' words, already translated ("You", "Everyone" or "All"). */
  youLabel: string;
  everyoneLabel: string;
  /** The key or pad glyph on the segment that is not chosen (View, or Shift+B), while a keyboard or pad is in use. */
  glyph: ControlGlyph | undefined;
}
