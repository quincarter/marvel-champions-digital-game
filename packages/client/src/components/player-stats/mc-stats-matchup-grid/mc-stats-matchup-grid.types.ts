import type { StatsGridAxisModel } from "../mc-stats-matchup-head/mc-stats-matchup-head.types.js";
import type { StatsLegendEntry } from "../mc-stats-matchup-legend/mc-stats-matchup-legend.types.js";
import type { StatsMode } from "../shared/stats-events.types.js";

/** How a cell looks: no game, played and never beaten, or the hardest tier beaten. */
export type StatsGridLook =
  | "unplayed"
  | "played"
  | "skirmish"
  | "standard"
  | "expert"
  | "extreme"
  | "heroic1"
  | "heroic2"
  | "heroic3"
  | "heroic4";

/** The grid, as the view model words it. The cells are row-major: `rows.length * columns.length` of each. */
export interface StatsGridModel {
  readonly kind: "heat" | "stamps";
  readonly rows: readonly StatsGridAxisModel[];
  readonly columns: readonly StatsGridAxisModel[];
  readonly looks: readonly StatsGridLook[];
  /** What a cell says in its middle: its count with Counts on, a tier's mark on the stamp grid, else empty. */
  readonly words: readonly string[];
  /** Each tier's colour and the ink that reads on it (CSS), for the cells and the key. */
  readonly tiers: Readonly<Record<string, { readonly color: string; readonly ink: string }>>;
  readonly legend: readonly StatsLegendEntry[];
  /** The line under the grid for the pairing at (`row`, `column`): "Rhino × Spider-Man" and what you did. */
  readonly readout: (row: number, column: number) => { readonly title: string; readonly detail: string };
}

export interface StatsGridCursor {
  readonly row: number;
  readonly column: number;
}

export type StatsGridStep = "up" | "down" | "left" | "right";

export interface McStatsMatchupGridProps {
  grid: StatsGridModel | null;
  cursor: StatsGridCursor;
  mode: StatsMode;
}
