/**
 * Geometry of the "Discard pile" overlay (`scenes/pile-view.ts`): a panel inset from the screen with a title bar
 * (title left, Close right) over a scrolling grid of the pile's cards, most recent first.
 *
 * The grid is `view/deck-pool-grid.ts`'s, so the global Card size setting applies here as it does in the card pool.
 * The cards scroll when the pile is taller than the panel, so none is cut off: what this guarantees is that the
 * panel sits inside the screen and that a whole cell (art and caption) fits the list's window at any width the
 * game runs at.
 */
import { poolGridGeometry, POOL_GRID_GAP, type PoolGridGeometry } from "./deck-pool-grid.js";
import { formFactorFor, type Rect } from "./layout.js";

/** The title bar's height, which is also the Close control's. */
export const PILE_BAR = 48;
/** Padding between the panel's edge and the grid. */
export const PILE_PAD = 12;
/** The widest the panel gets: wider than this the cards would sit on a field of empty paper. */
export const PILE_MAX_WIDTH = 1500;

export interface PileViewLayout {
  readonly panel: Rect;
  readonly bar: Rect;
  readonly close: Rect;
  /** Where the title is drawn, left of Close. */
  readonly title: Rect;
  /** The scrolling window the rows are drawn in. */
  readonly list: Rect;
  readonly geometry: PoolGridGeometry;
}

export function pileViewLayout(width: number, height: number, count: number, cardScale = 1): PileViewLayout {
  const inset = width < 600 ? 6 : 16;
  const panelWidth = Math.min(PILE_MAX_WIDTH, width - inset * 2);
  const panelHeight = height - inset * 2;
  const panel: Rect = {
    x: Math.round((width - panelWidth) / 2),
    y: inset,
    width: panelWidth,
    height: panelHeight,
  };
  const bar: Rect = { x: panel.x, y: panel.y, width: panel.width, height: PILE_BAR };
  const closeWidth = width < 600 ? 88 : 104;
  const close: Rect = {
    x: panel.x + panel.width - PILE_PAD - closeWidth,
    y: panel.y + 2,
    width: closeWidth,
    height: PILE_BAR - 4,
  };
  const title: Rect = {
    x: panel.x + PILE_PAD,
    y: panel.y,
    width: Math.max(40, close.x - (panel.x + PILE_PAD) - 8),
    height: PILE_BAR,
  };
  const list: Rect = {
    x: panel.x + PILE_PAD,
    y: panel.y + PILE_BAR + PILE_PAD,
    width: panel.width - PILE_PAD * 2,
    height: panel.height - PILE_BAR - PILE_PAD * 2,
  };
  const geometry = poolGridGeometry(list.width, count, formFactorFor(width, height) === "desktop", cardScale);
  return { panel, bar, close, title, list, geometry };
}

/** Card `index`'s cell within its row's rect: the row index, column and rect, left to right then down. */
export function pileCell(
  geometry: PoolGridGeometry,
  rowRect: Rect,
  column: number,
): { readonly art: Rect; readonly caption: Rect } {
  const x = rowRect.x + column * (geometry.cellWidth + POOL_GRID_GAP);
  return {
    art: { x, y: rowRect.y, width: geometry.cellWidth, height: geometry.artHeight },
    caption: { x, y: rowRect.y + geometry.artHeight, width: geometry.cellWidth, height: geometry.captionHeight },
  };
}

/** The title: the pile's name in capitals and its size. */
export function pileTitle(name: string, count: number): string {
  return `${name.toUpperCase()} · ${count} ${count === 1 ? "CARD" : "CARDS"}`;
}
