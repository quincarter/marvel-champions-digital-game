import type { ControlGlyph } from "@mc/ui";
import type { StatsChipModel } from "../mc-stats-chip-row/mc-stats-chip-row.types.js";
import type { StatsShareInput } from "../mc-stats-share/mc-stats-share.types.js";
import type { StatsEventDetail, StatsMode } from "../shared/stats-events.types.js";

/** One row of the controls under the tabs. */
export type StatsControlRow =
  /** Chips: the filters, the Matchups views, "Hide hero cards". */
  | { readonly kind: "chips"; readonly id: string; readonly chips: readonly StatsChipModel[]; readonly scroll: boolean }
  /** A stepper: Cards by hero's heroes, the Focus view's villains. */
  | {
      readonly kind: "stepper";
      readonly id: string;
      readonly label: string;
      readonly prevStop: string;
      readonly nextStop: string;
      readonly nameStop: string;
      readonly prevAction: StatsEventDetail;
      readonly nextAction: StatsEventDetail;
      readonly prevGlyph: ControlGlyph | undefined;
      readonly nextGlyph: ControlGlyph | undefined;
      readonly several: boolean;
    }
  /** Share my games, or "Sharing on". */
  | { readonly kind: "share"; readonly id: string; readonly input: StatsShareInput };

export interface McStatsControlsProps {
  rows: readonly StatsControlRow[];
  mode: StatsMode;
}
