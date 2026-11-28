import type { ControlGlyph, TabRailTab } from "@mc/ui";
import type { StatsHeaderInput } from "../../../components/player-stats/shared/stats-header.types.js";
import type { StatsControlRow } from "../../../components/player-stats/mc-stats-controls/mc-stats-controls.types.js";
import type { StatsChipModel } from "../../../components/player-stats/mc-stats-chip-row/mc-stats-chip-row.types.js";
import type { StatsBlock } from "../../../components/player-stats/mc-stats-list/mc-stats-list.types.js";
import type {
  StatsGridCursor,
  StatsGridModel,
} from "../../../components/player-stats/mc-stats-matchup-grid/mc-stats-matchup-grid.types.js";
import type { StatsSideRowModel } from "../../../components/player-stats/mc-stats-side-row/mc-stats-side-row.types.js";
import type { StatsMode } from "../../../components/player-stats/shared/stats-events.types.js";

/** What the page shows under the controls. */
export type StatsBody =
  /** Still reading the saves, or they could not be read. */
  | { readonly kind: "message"; readonly text: string }
  /** The heat or stamp grid. */
  | { readonly kind: "grid"; readonly grid: StatsGridModel; readonly cursor: StatsGridCursor }
  /** A tab's list, with the Focus view's side list beside it when there is room. */
  | {
      readonly kind: "list";
      readonly scrollKey: string;
      readonly blocks: readonly StatsBlock[];
      readonly side: readonly StatsSideRowModel[] | null;
    };

/** Everything Your stats draws, as the scene's view model words it (`view/player-stats-page-model.ts`). */
export interface StatsPageModel {
  readonly header: StatsHeaderInput;
  /** The tab row; absent while the stats load. */
  readonly tabs: {
    readonly tabs: readonly TabRailTab[];
    readonly selected: string;
    readonly glyph: ControlGlyph | undefined;
    /** A phone's Filters chip, at the right end of the tab row. */
    readonly toggle: StatsChipModel | null;
  } | null;
  readonly controls: readonly StatsControlRow[];
  readonly body: StatsBody;
}

export interface McPlayerStatsPageProps {
  model: StatsPageModel | null;
  mode: StatsMode;
}
