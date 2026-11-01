/**
 * The Matchups tab of Your stats (issue #608): which villains you have played each hero and each modular set against,
 * and the hardest way you have beaten that pairing, as a grid to pan around. Pure: the fold, the words and the geometry,
 * no Phaser (`ui/matchup-grid.ts` draws it).
 *
 * **Rows are scenarios**, the thing a player picks, so a villain with two scenarios (Green Goblin) has two rows and a
 * scenario whose villain is chosen at setup has one. **Both axes hold the whole pool**, played or not, in release order:
 * the gaps are the point, and a pairing stays in the same place as the grid fills in. A game with two heroes or two
 * modular sets lands in each of their cells, as it does on the Heroes and Encounter tabs.
 *
 * A cell's color is its hardest win (`WIN_TIERS`). A Skirmish win is the easiest tier whatever else the game was set to:
 * a shortened game is not an Expert win, the same call `withWin` and the achievements make.
 */
import type { SessionConfig } from "../engine/host.js";
import type { Rect } from "./layout.js";

/** Easiest first: a cell shows the last of these it has a win at. */
export const WIN_TIERS = [
  "skirmish",
  "standard",
  "expert",
  "extreme",
  "heroic1",
  "heroic2",
  "heroic3",
  "heroic4",
] as const;
export type WinTier = (typeof WIN_TIERS)[number];

/** Which of the Matchups views is on: `heat` and `stamps` are grids; `shelves` and `focus` are lists. */
export const MATCHUP_VIEWS = ["heat", "stamps", "shelves", "focus"] as const;
export type MatchupView = (typeof MATCHUP_VIEWS)[number];
export const MATCHUP_VIEW_LABELS: Readonly<Record<MatchupView, string>> = {
  heat: "Heat grid",
  stamps: "Stamps",
  shelves: "Shelves",
  focus: "Focus",
};

/** What a stamp says, so a tier is never told by its color alone. */
export const TIER_MARKS: Readonly<Record<WinTier, string>> = {
  skirmish: "SK",
  standard: "S",
  expert: "E",
  extreme: "X",
  heroic1: "H1",
  heroic2: "H2",
  heroic3: "H3",
  heroic4: "H4",
};

export const TIER_LABELS: Readonly<Record<WinTier, string>> = {
  skirmish: "Skirmish",
  standard: "Standard",
  expert: "Expert",
  extreme: "Extreme",
  heroic1: "Heroic 1",
  heroic2: "Heroic 2",
  heroic3: "Heroic 3",
  heroic4: "Heroic 4",
};

/** Which tier a game of this setup counts at. Every Heroic level is harder than any plain difficulty. */
export function winTierOf(config: Pick<SessionConfig, "difficulty" | "modes">): WinTier {
  if (config.modes?.skirmish) return "skirmish";
  const heroic = config.modes?.heroic ?? 0;
  if (heroic > 0) return `heroic${Math.min(heroic, 4) as 1 | 2 | 3 | 4}`;
  if (config.modes?.expert || config.difficulty === "expert") return "expert";
  return config.difficulty === "extreme" ? "extreme" : "standard";
}

export interface GridAxisEntry {
  readonly id: string;
  readonly name: string;
}

/** A pairing with at least one game. Pairings with none have no cell. */
export interface MatchupCell {
  readonly row: number;
  readonly column: number;
  readonly wins: Readonly<Partial<Record<WinTier, number>>>;
  readonly losses: number;
}

export interface MatchupGrid {
  readonly rows: readonly GridAxisEntry[];
  readonly columns: readonly GridAxisEntry[];
  readonly cells: readonly MatchupCell[];
}

export type MatchupKind = "heroes" | "modulars";
export type Matchups = Readonly<Record<MatchupKind, MatchupGrid>>;

/** One finished game, as the grids read it. */
export interface MatchupGame {
  readonly scenarioId: string;
  readonly heroIds: readonly string[];
  readonly modularIds: readonly string[];
  readonly won: boolean;
  readonly tier: WinTier;
}

/** The axes before any game is laid on them, and the names of what a game holds that the pool does not (an old save). */
export interface MatchupAxes {
  readonly scenarios: readonly GridAxisEntry[];
  readonly heroes: readonly GridAxisEntry[];
  readonly modulars: readonly GridAxisEntry[];
}

export interface MatchupNames {
  readonly scenario: (id: string) => string;
  readonly hero: (id: string) => string;
  readonly modular: (id: string) => string;
}

/** The pool's entries, then any id the games hold that the pool does not, so no game drops off the grid. */
function axisOf(pool: readonly GridAxisEntry[], played: readonly string[], nameOf: (id: string) => string) {
  const known = new Set(pool.map((entry) => entry.id));
  const extra = [...new Set(played)].filter((id) => !known.has(id)).map((id) => ({ id, name: nameOf(id) }));
  return [...pool, ...extra];
}

function gridOf(
  games: readonly MatchupGame[],
  rows: readonly GridAxisEntry[],
  columns: readonly GridAxisEntry[],
  columnsOf: (game: MatchupGame) => readonly string[],
): MatchupGrid {
  const rowAt = new Map(rows.map((entry, index) => [entry.id, index]));
  const columnAt = new Map(columns.map((entry, index) => [entry.id, index]));
  const cells = new Map<
    string,
    { row: number; column: number; wins: Partial<Record<WinTier, number>>; losses: number }
  >();
  for (const game of games) {
    const row = rowAt.get(game.scenarioId)!;
    for (const id of new Set(columnsOf(game))) {
      const column = columnAt.get(id)!;
      const key = `${row}:${column}`;
      const cell = cells.get(key) ?? { row, column, wins: {}, losses: 0 };
      if (game.won) cell.wins[game.tier] = (cell.wins[game.tier] ?? 0) + 1;
      else cell.losses++;
      cells.set(key, cell);
    }
  }
  return { rows, columns, cells: [...cells.values()] };
}

export function matchupsOf(games: readonly MatchupGame[], axes: MatchupAxes, names: MatchupNames): Matchups {
  const rows = axisOf(
    axes.scenarios,
    games.map((game) => game.scenarioId),
    names.scenario,
  );
  const heroes = axisOf(
    axes.heroes,
    games.flatMap((game) => game.heroIds),
    names.hero,
  );
  const modulars = axisOf(
    axes.modulars,
    games.flatMap((game) => game.modularIds),
    names.modular,
  );
  return {
    heroes: gridOf(games, rows, heroes, (game) => game.heroIds),
    modulars: gridOf(games, rows, modulars, (game) => game.modularIds),
  };
}

/** The same grid with its axes swapped (the Flip chip). */
export function flipGrid(grid: MatchupGrid): MatchupGrid {
  return {
    rows: grid.columns,
    columns: grid.rows,
    cells: grid.cells.map((cell) => ({ ...cell, row: cell.column, column: cell.row })),
  };
}

const winsIn = (cell: MatchupCell): number => Object.values(cell.wins).reduce((sum, n) => sum + n, 0);

/** The hardest tier a cell has a win at, or null for a pairing not beaten yet. */
export function hardestWin(cell: MatchupCell): WinTier | null {
  return [...WIN_TIERS].reverse().find((tier) => (cell.wins[tier] ?? 0) > 0) ?? null;
}

export type CellLook =
  | { readonly kind: "unplayed" }
  /** `count`: wins (`count` in the legend's words), drawn only with the Counts chip on. */
  | { readonly kind: "won"; readonly tier: WinTier; readonly count: number }
  /** `count`: games played, all of them lost. */
  | { readonly kind: "played"; readonly count: number };

/** How a cell draws. With "Played, not beaten" off, a pairing with no win looks unplayed. */
export function cellLookOf(cell: MatchupCell | undefined, showPlayed: boolean): CellLook {
  if (!cell) return { kind: "unplayed" };
  const tier = hardestWin(cell);
  if (tier) return { kind: "won", tier, count: winsIn(cell) };
  return showPlayed ? { kind: "played", count: cell.losses } : { kind: "unplayed" };
}

export interface CellReadout {
  /** "Rhino × Spider-Man". */
  readonly title: string;
  /** "Heroic 2: 1 win · Expert: 3 wins · 2 losses", or "Not played yet". */
  readonly detail: string;
}

/** What the line under the grid says about the pairing at (`row`, `column`): every tier in words, hardest first. */
export function readoutOf(grid: MatchupGrid, row: number, column: number): CellReadout {
  const title = `${grid.rows[row]?.name ?? ""} × ${grid.columns[column]?.name ?? ""}`;
  const cell = grid.cells.find((c) => c.row === row && c.column === column);
  if (!cell) return { title, detail: "Not played yet" };
  const wins = [...WIN_TIERS]
    .reverse()
    .filter((tier) => (cell.wins[tier] ?? 0) > 0)
    .map((tier) => `${TIER_LABELS[tier]}: ${cell.wins[tier]} ${cell.wins[tier] === 1 ? "win" : "wins"}`);
  const losses = cell.losses > 0 ? [`${cell.losses} ${cell.losses === 1 ? "loss" : "losses"}`] : [];
  return { title, detail: [...wins, ...losses].join(" · ") };
}

export type LegendEntry =
  | { readonly kind: "tier"; readonly tier: WinTier; readonly label: string }
  | { readonly kind: "played"; readonly label: string }
  | { readonly kind: "unplayed"; readonly label: string };

/** The key under the grid: only the tiers this grid shows, easiest first, then the two looks with no win. */
export function legendOf(grid: MatchupGrid, showPlayed: boolean): readonly LegendEntry[] {
  const shown = new Set(grid.cells.map(hardestWin));
  return [
    ...WIN_TIERS.filter((tier) => shown.has(tier)).map((tier) => ({
      kind: "tier" as const,
      tier,
      label: TIER_LABELS[tier],
    })),
    ...(showPlayed ? [{ kind: "played" as const, label: "Played, not beaten" }] : []),
    { kind: "unplayed", label: "Not played" },
  ];
}

const LEGEND_ROW = 22;
const LEGEND_SWATCH_ROOM = 20;
const LEGEND_GAP = 16;
/** A label's width, near enough to wrap the key by: 12px body text runs about this wide a character. */
const LEGEND_CHAR = 6.8;

export interface LegendLayout {
  readonly entries: readonly { readonly entry: LegendEntry; readonly x: number; readonly y: number }[];
  readonly height: number;
}

/** The key laid out in rows that fit `width`. */
export function legendLayoutOf(entries: readonly LegendEntry[], width: number): LegendLayout {
  const placed: { entry: LegendEntry; x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  for (const entry of entries) {
    const span = LEGEND_SWATCH_ROOM + entry.label.length * LEGEND_CHAR + LEGEND_GAP;
    if (x > 0 && x + span > width) {
      x = 0;
      y += LEGEND_ROW;
    }
    placed.push({ entry, x, y });
    x += span;
  }
  return { entries: placed, height: y + LEGEND_ROW };
}

/** One row of the grid as the Shelves view tells it: how much of the axis you have beaten, and how. */
export interface ShelfView {
  readonly row: number;
  readonly name: string;
  readonly total: number;
  /** Wins by tier, easiest first, each count how many columns it is the hardest win of. */
  readonly bar: readonly { readonly tier: WinTier; readonly count: number }[];
  readonly best: WinTier | null;
  readonly bestLabel: string;
  /** "9 of 63 beaten · 3 tried". */
  readonly summary: string;
  readonly short: string;
  /** One per column, hardest wins first, then played, then not played. */
  readonly pips: readonly (WinTier | "played" | "unplayed")[];
  /** Beaten, of `total`: "9/63". */
  readonly score: string;
}

/** Each row's looks, by column. */
function looksOf(grid: MatchupGrid, showPlayed: boolean): CellLook[][] {
  const looks = grid.rows.map(() => grid.columns.map((): CellLook => ({ kind: "unplayed" })));
  for (const cell of grid.cells) looks[cell.row]![cell.column] = cellLookOf(cell, showPlayed);
  return looks;
}

export function shelvesOf(grid: MatchupGrid, showPlayed: boolean): readonly ShelfView[] {
  const total = grid.columns.length;
  return looksOf(grid, showPlayed).map((looks, row) => {
    const wins = looks.flatMap((look) => (look.kind === "won" ? [look.tier] : []));
    const tried = looks.filter((look) => look.kind === "played").length;
    const best = [...WIN_TIERS].reverse().find((tier) => wins.includes(tier)) ?? null;
    const beaten = `${wins.length} of ${total}`;
    return {
      row,
      name: grid.rows[row]!.name,
      total,
      bar: WIN_TIERS.flatMap((tier) => {
        const count = wins.filter((win) => win === tier).length;
        return count > 0 ? [{ tier, count }] : [];
      }),
      best,
      bestLabel: best ? TIER_LABELS[best] : "",
      summary: tried > 0 ? `${beaten} beaten · ${tried} tried` : `${beaten} beaten`,
      short: tried > 0 ? `${beaten} · ${tried} tried` : beaten,
      pips: [
        ...[...WIN_TIERS].reverse().flatMap((tier) => wins.filter((win) => win === tier)),
        ...Array.from({ length: tried }, () => "played" as const),
        ...Array.from({ length: total - wins.length - tried }, () => "unplayed" as const),
      ],
      score: `${wins.length}/${total}`,
    };
  });
}

export interface MatchupTile {
  readonly column: number;
  readonly name: string;
  readonly look: CellLook;
  /** "Expert", "Tried", "Not played"; with counts, "Expert · 3". */
  readonly ribbon: string;
}

/** Every column of one row, in axis order, for the Focus view. */
export function tilesOf(
  grid: MatchupGrid,
  row: number,
  showPlayed: boolean,
  showCounts: boolean,
): readonly MatchupTile[] {
  return grid.columns.map((entry, column) => {
    const look = cellLookOf(
      grid.cells.find((cell) => cell.row === row && cell.column === column),
      showPlayed,
    );
    const word = look.kind === "won" ? TIER_LABELS[look.tier] : look.kind === "played" ? "Tried" : "Not played";
    return {
      column,
      name: entry.name,
      look,
      ribbon: showCounts && look.kind !== "unplayed" ? `${word} · ${look.count}` : word,
    };
  });
}

/** One row of a Matchups list view. */
export type MatchupRow =
  | { readonly kind: "legend"; readonly layout: LegendLayout }
  | { readonly kind: "shelf"; readonly shelf: ShelfView }
  | {
      readonly kind: "tiles";
      readonly tileWidth: number;
      readonly tileHeight: number;
      readonly tiles: readonly (MatchupTile & { readonly x: number })[];
    };

export interface MatchupListRow {
  readonly id: string;
  readonly height: number;
  readonly row: MatchupRow;
}

const legendRow = (grid: MatchupGrid, showPlayed: boolean, width: number): MatchupListRow => {
  const layout = legendLayoutOf(legendOf(grid, showPlayed), width);
  return { id: "matchup:legend", height: layout.height + 8, row: { kind: "legend", layout } };
};

export const shelfRowsOf = (
  grid: MatchupGrid,
  showPlayed: boolean,
  width: number,
  phone: boolean,
): readonly MatchupListRow[] => [
  legendRow(grid, showPlayed, width),
  ...shelvesOf(grid, showPlayed).map((shelf) => ({
    id: `shelf:${shelf.row}`,
    height: phone ? 88 : 86,
    row: { kind: "shelf" as const, shelf },
  })),
];

const TILE_GAP = 8;

/** One row's tiles in rows as many across as fit `width`, under the key. */
export function tileRowsOf(
  grid: MatchupGrid,
  row: number,
  options: { readonly showPlayed: boolean; readonly showCounts: boolean },
  width: number,
  phone: boolean,
): readonly MatchupListRow[] {
  const tileWidth = phone ? 82 : 112;
  const tileHeight = phone ? 118 : 138;
  const across = Math.max(1, Math.floor((width + TILE_GAP) / (tileWidth + TILE_GAP)));
  const tiles = tilesOf(grid, row, options.showPlayed, options.showCounts);
  const rows: MatchupListRow[] = [legendRow(grid, options.showPlayed, width)];
  for (let i = 0; i < tiles.length; i += across) {
    rows.push({
      id: `tiles:${i / across}`,
      height: tileHeight + TILE_GAP,
      row: {
        kind: "tiles",
        tileWidth,
        tileHeight,
        tiles: tiles.slice(i, i + across).map((tile, j) => ({ ...tile, x: j * (tileWidth + TILE_GAP) })),
      },
    });
  }
  return rows;
}

export interface GridMetrics {
  readonly cell: number;
  /** The row names' column. */
  readonly rowHeader: number;
  /** The column names' band: they stand on end, so it is as tall as a long name. */
  readonly columnHeader: number;
}

/** `short`: a landscape tablet, with chips above the grid and little height under them, gives the names' band less. */
export function gridMetricsOf(phone: boolean, short: boolean, style: "heat" | "stamps" = "heat"): GridMetrics {
  if (style === "stamps")
    return phone
      ? { cell: 56, rowHeader: 78, columnHeader: 84 }
      : { cell: 68, rowHeader: 190, columnHeader: short ? 96 : 112 };
  return phone
    ? { cell: 36, rowHeader: 108, columnHeader: 100 }
    : { cell: 40, rowHeader: 190, columnHeader: short ? 110 : 150 };
}

export interface GridShape {
  /** The grid's whole area, headers included. */
  readonly rect: Rect;
  readonly metrics: GridMetrics;
  readonly rows: number;
  readonly columns: number;
}

export interface GridPoint {
  readonly x: number;
  readonly y: number;
}

export interface GridCursor {
  readonly row: number;
  readonly column: number;
}

/** Where the cells show: the grid's area less its two header bands. */
export function bodyOf({ rect, metrics }: GridShape): Rect {
  return {
    x: rect.x + metrics.rowHeader,
    y: rect.y + metrics.columnHeader,
    width: Math.max(0, rect.width - metrics.rowHeader),
    height: Math.max(0, rect.height - metrics.columnHeader),
  };
}

const maxPanOf = (shape: GridShape): GridPoint => {
  const body = bodyOf(shape);
  return {
    x: Math.max(0, shape.columns * shape.metrics.cell - body.width),
    y: Math.max(0, shape.rows * shape.metrics.cell - body.height),
  };
};

export function clampPan(shape: GridShape, pan: GridPoint): GridPoint {
  const max = maxPanOf(shape);
  return { x: Math.min(max.x, Math.max(0, pan.x)), y: Math.min(max.y, Math.max(0, pan.y)) };
}

/** The rows and columns at least partly in view, as half-open ranges. */
export function visibleRange(shape: GridShape, pan: GridPoint) {
  const { cell } = shape.metrics;
  const body = bodyOf(shape);
  return {
    rowFrom: Math.max(0, Math.floor(pan.y / cell)),
    rowTo: Math.min(shape.rows, Math.ceil((pan.y + body.height) / cell)),
    columnFrom: Math.max(0, Math.floor(pan.x / cell)),
    columnTo: Math.min(shape.columns, Math.ceil((pan.x + body.width) / cell)),
  };
}

/** A cell's square on screen right now; it may lie outside the body. */
export function cellRect(shape: GridShape, pan: GridPoint, { row, column }: GridCursor): Rect {
  const { cell } = shape.metrics;
  const body = bodyOf(shape);
  return { x: body.x + column * cell - pan.x, y: body.y + row * cell - pan.y, width: cell, height: cell };
}

/** The cell under a point of the screen, or null off the body or past the grid's last row or column. */
export function cellAt(shape: GridShape, pan: GridPoint, x: number, y: number): GridCursor | null {
  const { cell } = shape.metrics;
  const body = bodyOf(shape);
  if (x < body.x || x >= body.x + body.width || y < body.y || y >= body.y + body.height) return null;
  const column = Math.floor((x - body.x + pan.x) / cell);
  const row = Math.floor((y - body.y + pan.y) / cell);
  return row < shape.rows && column < shape.columns ? { row, column } : null;
}

/** The nearest pan that shows the whole cell. */
export function panToShow(shape: GridShape, pan: GridPoint, { row, column }: GridCursor): GridPoint {
  const { cell } = shape.metrics;
  const body = bodyOf(shape);
  const along = (at: number, offset: number, view: number): number => {
    const start = at * cell;
    if (start < offset) return start;
    return start + cell > offset + view ? start + cell - view : offset;
  };
  return clampPan(shape, { x: along(column, pan.x, body.width), y: along(row, pan.y, body.height) });
}

export type GridStep = "up" | "down" | "left" | "right";

/** The cursor moved the least that leaves it wholly in view, for a pan that would carry it off the body. */
export function cursorInView(shape: GridShape, pan: GridPoint, { row, column }: GridCursor): GridCursor {
  const { cell } = shape.metrics;
  const body = bodyOf(shape);
  const along = (at: number, offset: number, view: number, count: number): number => {
    const first = Math.ceil(offset / cell);
    const last = Math.min(count, Math.floor((offset + view) / cell)) - 1;
    return last < first ? at : Math.min(last, Math.max(first, at));
  };
  return { row: along(row, pan.y, body.height, shape.rows), column: along(column, pan.x, body.width, shape.columns) };
}

/** The cursor one cell along, or null at the grid's edge (the arrow then leaves the grid). */
export function stepCursor(shape: GridShape, { row, column }: GridCursor, step: GridStep): GridCursor | null {
  const next = {
    row: row + (step === "down" ? 1 : step === "up" ? -1 : 0),
    column: column + (step === "right" ? 1 : step === "left" ? -1 : 0),
  };
  const inside = next.row >= 0 && next.row < shape.rows && next.column >= 0 && next.column < shape.columns;
  return inside ? next : null;
}

/** The cursor kept on the grid, for a grid that changed shape under it (a flip, a filter). */
export function clampCursor(shape: GridShape, { row, column }: GridCursor): GridCursor {
  return {
    row: Math.min(Math.max(0, shape.rows - 1), Math.max(0, row)),
    column: Math.min(Math.max(0, shape.columns - 1), Math.max(0, column)),
  };
}

/** How many whole rows the body shows, at least one: a page of the keyboard's Page Up and Page Down. */
export const pageRows = (shape: GridShape): number =>
  Math.max(1, Math.floor(bodyOf(shape).height / shape.metrics.cell));
