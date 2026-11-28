import type { ControlGlyph } from "@mc/ui";
import type { StatsMode, StatsSourceName } from "../shared/stats-events.types.js";

/** What the header says: filled in by the scene's view model. */
export interface StatsHeaderInput {
  /** Back's words ("◂ TITLE", or "◂" on a phone). */
  readonly backLabel: string;
  /** "Your stats". */
  readonly title: string;
  /** "17 games played" (wide only), or empty. */
  readonly played: string;
  /** Whether the You / Everyone switch shows (the stats have loaded). */
  readonly showSource: boolean;
  readonly source: StatsSourceName;
  readonly youLabel: string;
  readonly everyoneLabel: string;
  /** The Cancel glyph hung on Back, and the switch glyph on the segment not chosen. */
  readonly backGlyph: ControlGlyph | undefined;
  readonly sourceGlyph: ControlGlyph | undefined;
}

export interface McStatsHeaderProps {
  input: StatsHeaderInput | null;
  mode: StatsMode;
}
