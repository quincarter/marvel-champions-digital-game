/**
 * The Matchups tab as the page's elements take it (`view/player-stats-page-model.ts`): the heat or stamp grid, the
 * Shelves view's key and shelves, and the Focus view's key, side list and tiles. Pure: the folds are
 * `view/matchup-grid.ts`'s, the pictures come in through `MatchupPictures`.
 */
import type { PictureSource, SegmentBarPart } from "@mc/ui";
import type { StatsLegendEntry } from "../components/player-stats/mc-stats-matchup-legend/mc-stats-matchup-legend.types.js";
import type { StatsGridAxisModel } from "../components/player-stats/mc-stats-matchup-head/mc-stats-matchup-head.types.js";
import type {
  StatsGridLook,
  StatsGridModel,
} from "../components/player-stats/mc-stats-matchup-grid/mc-stats-matchup-grid.types.js";
import type { StatsShelfModel } from "../components/player-stats/mc-stats-matchup-shelf/mc-stats-matchup-shelf.types.js";
import type { StatsMatchupTileModel } from "../components/player-stats/mc-stats-matchup-tile/mc-stats-matchup-tile.types.js";
import type { StatsSideRowModel } from "../components/player-stats/mc-stats-side-row/mc-stats-side-row.types.js";
import { formatCount } from "./number-format.js";
import {
  TIER_MARKS,
  cellLookOf,
  flipGrid,
  legendOf,
  readoutOf,
  shelvesOf,
  tilesOf,
  type CellLook,
  type MatchupGrid,
  type MatchupKind,
  type WinTier,
} from "./matchup-grid.js";
import { TIER_COLORS, TIER_LOOKS, tierInk } from "./matchup-tiers.js";

/** Where the pictures and cards behind the axes come from: the scene, which leases them. */
export interface MatchupPictures {
  /** A row's or column's picture on the axis `id` names (a villain's, a hero's, none for a modular set). */
  readonly picture: (axis: "row" | "column", id: string) => PictureSource | null;
  /** The card that picture stands for, for the hover; null for none. */
  readonly cardId: (axis: "row" | "column", id: string) => string | null;
}

export interface MatchupChoices {
  readonly kind: MatchupKind;
  readonly counts: boolean;
  readonly played: boolean;
  readonly flipped: boolean;
}

const flipped = new WeakMap<MatchupGrid, MatchupGrid>();

/** The grid on show, flipped if the Flip chip is on (one flip kept per grid, so the rows ask for it cheaply). */
export function shownGridOf(source: MatchupGrid, isFlipped: boolean): MatchupGrid {
  if (!isFlipped) return source;
  let grid = flipped.get(source);
  if (!grid) {
    grid = flipGrid(source);
    flipped.set(source, grid);
  }
  return grid;
}

const axisOf = (
  axis: "row" | "column",
  entries: MatchupGrid["rows"],
  pictures: MatchupPictures,
  withPictures: boolean,
): readonly StatsGridAxisModel[] =>
  entries.map((entry) => ({
    name: entry.name,
    picture: withPictures ? pictures.picture(axis, entry.id) : null,
    cardId: withPictures ? pictures.cardId(axis, entry.id) : null,
  }));

const legendEntriesOf = (grid: MatchupGrid, showPlayed: boolean): readonly StatsLegendEntry[] =>
  legendOf(grid, showPlayed).map((entry) => ({
    kind: entry.kind,
    label: entry.label,
    color: entry.kind === "tier" ? TIER_COLORS[entry.tier] : "",
  }));

const lookName = (look: CellLook): StatsGridLook => (look.kind === "won" ? look.tier : look.kind);

/** The heat or stamp grid: every pairing's look and words, row-major. */
export function gridModelOf(
  grid: MatchupGrid,
  kind: "heat" | "stamps",
  choices: MatchupChoices,
  pictures: MatchupPictures,
): StatsGridModel {
  const cells = new Map(grid.cells.map((cell) => [`${cell.row}:${cell.column}`, cell]));
  const looks: StatsGridLook[] = [];
  const words: string[] = [];
  for (let row = 0; row < grid.rows.length; row++) {
    for (let column = 0; column < grid.columns.length; column++) {
      const look = cellLookOf(cells.get(`${row}:${column}`), choices.played);
      looks.push(lookName(look));
      words.push(
        look.kind === "unplayed"
          ? ""
          : choices.counts
            ? formatCount(look.count)
            : kind === "stamps" && look.kind === "won"
              ? TIER_MARKS[look.tier]
              : "",
      );
    }
  }
  return {
    kind,
    rows: axisOf("row", grid.rows, pictures, kind === "stamps"),
    columns: axisOf("column", grid.columns, pictures, kind === "stamps"),
    looks,
    words,
    tiers: TIER_LOOKS,
    legend: legendEntriesOf(grid, choices.played),
    readout: (row, column) => readoutOf(grid, row, column),
  };
}

/** The Shelves view's shelves, one per villain. */
export function shelfModelsOf(
  grid: MatchupGrid,
  choices: MatchupChoices,
  pictures: MatchupPictures,
): readonly StatsShelfModel[] {
  return shelvesOf(grid, choices.played).map((shelf) => {
    const id = grid.rows[shelf.row]!.id;
    const bar: SegmentBarPart[] = shelf.bar.map((part) => ({ count: part.count, color: TIER_COLORS[part.tier] }));
    return {
      row: shelf.row,
      name: shelf.name,
      summary: shelf.summary,
      short: shelf.short,
      bar,
      total: shelf.total,
      pips: shelf.pips.map((pip) =>
        pip === "unplayed" || pip === "played"
          ? { kind: pip, color: "" }
          : { kind: "tier" as const, color: TIER_COLORS[pip] },
      ),
      best: shelf.bestLabel,
      bestColor: shelf.best ? TIER_COLORS[shelf.best] : "",
      bestInk: shelf.best ? tierInk(shelf.best) : "",
      picture: pictures.picture("row", id),
      cardId: pictures.cardId("row", id),
    };
  });
}

/** The Focus view's side list: every villain, the one shown marked. */
export function sideRowsOf(grid: MatchupGrid, choices: MatchupChoices, focusRow: number): readonly StatsSideRowModel[] {
  return shelvesOf(grid, choices.played).map((shelf) => ({
    row: shelf.row,
    name: shelf.name,
    score: shelf.score,
    selected: shelf.row === focusRow,
  }));
}

/** The Focus view's tiles: every column of one row. */
export function focusTilesOf(
  grid: MatchupGrid,
  row: number,
  choices: MatchupChoices,
  pictures: MatchupPictures,
): readonly StatsMatchupTileModel[] {
  return tilesOf(grid, row, choices.played, choices.counts).map((tile) => {
    const id = grid.columns[tile.column]!.id;
    const won: WinTier | null = tile.look.kind === "won" ? tile.look.tier : null;
    return {
      column: tile.column,
      name: tile.name,
      look: tile.look.kind,
      ribbon: tile.ribbon,
      color: won ? TIER_COLORS[won] : "",
      ink: won ? tierInk(won) : "",
      picture: pictures.picture("column", id),
      cardId: pictures.cardId("column", id),
    };
  });
}

/** The key above the Shelves and Focus views. */
export const legendOfGrid = legendEntriesOf;
