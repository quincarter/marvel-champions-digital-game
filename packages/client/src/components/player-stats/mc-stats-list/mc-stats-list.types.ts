import type { StatsAspectShare } from "../mc-stats-aspects-donut/mc-stats-aspects-donut.types.js";
import type { StatsAspectStamp } from "../mc-stats-aspect-stamps/mc-stats-aspect-stamps.types.js";
import type { StatsCardModel } from "../mc-stats-card/mc-stats-card.types.js";
import type { StatsLegendEntry } from "../mc-stats-matchup-legend/mc-stats-matchup-legend.types.js";
import type { StatsMatchupTileModel } from "../mc-stats-matchup-tile/mc-stats-matchup-tile.types.js";
import type { StatsShelfModel } from "../mc-stats-matchup-shelf/mc-stats-matchup-shelf.types.js";
import type { StatsTileModel } from "../mc-stats-overview/mc-stats-overview.types.js";
import type { StatsRowModel } from "../mc-stats-row/mc-stats-row.types.js";

/** One block of a tab's list, in reading order. Each kind is drawn by its own element. */
export type StatsBlock =
  /** The Overview's tiles. */
  | { readonly kind: "tiles"; readonly id: string; readonly tiles: readonly StatsTileModel[] }
  | { readonly kind: "heading"; readonly id: string; readonly title: string }
  | { readonly kind: "note"; readonly id: string; readonly text: string }
  | { readonly kind: "stat"; readonly id: string; readonly row: StatsRowModel }
  /** The Aspects tab's donut and legend. */
  | {
      readonly kind: "donut";
      readonly id: string;
      readonly chartKey: string;
      readonly caption: string;
      readonly shares: readonly StatsAspectShare[];
    }
  /** Cards by hero's aspects line. */
  | {
      readonly kind: "aspects";
      readonly id: string;
      readonly caption: string;
      readonly aspects: readonly StatsAspectStamp[];
    }
  /** A strip of card pictures with their counts. */
  | { readonly kind: "cards"; readonly id: string; readonly cards: readonly StatsCardModel[] }
  /** The Matchups key, a villain's shelf, and the Focus view's tiles. */
  | { readonly kind: "legend"; readonly id: string; readonly entries: readonly StatsLegendEntry[] }
  | { readonly kind: "shelf"; readonly id: string; readonly shelf: StatsShelfModel }
  | { readonly kind: "matchup-tiles"; readonly id: string; readonly tiles: readonly StatsMatchupTileModel[] };

export interface McStatsListProps {
  blocks: readonly StatsBlock[];
  /** The tab's scroll name: each tab (each hero, each Matchups view) keeps its own place in the list. */
  scrollKey: string;
}
