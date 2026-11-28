import type { BarChartBar } from "@mc/ui";
import type { OddsModel } from "../mc-odds-panel/mc-odds-panel.types.js";

/** The cost curve and the draw odds. */
export interface DeckChartsModel {
  readonly curveLabel: string;
  readonly curveTab: string;
  readonly oddsLabel: string;
  readonly oddsTab: string;
  readonly bars: readonly BarChartBar[];
  readonly odds: OddsModel;
}

/** Tabs: the wide rail shows one chart at a time; stacked, both are down the column under their own labels. */
export type DeckChartsMode = "tabs" | "stacked";
