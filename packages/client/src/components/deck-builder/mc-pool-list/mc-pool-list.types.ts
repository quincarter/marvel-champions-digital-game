import type { PoolCardModel } from "../mc-pool-cell/mc-pool-cell.types.js";

/** How the pool is shown: card pictures in a grid, or the text rows with each card's rules. */
export type PoolView = "grid" | "list";

/** The pool, windowed: only the cards near the viewport are asked for. */
export interface PoolListModel {
  readonly view: PoolView;
  readonly count: number;
  /** One card, asked for only while its cell or row is in the window. */
  readonly cardAt: (index: number) => PoolCardModel;
  /** The global Card size factor times the phone's smaller cards: 1, 1.25, 1.5 (x 0.8). */
  readonly cardScale: number;
  /** List view's row slot height and its picture's width. */
  readonly rowHeight: number;
  readonly thumbWidth: number;
  /** Card view's caption band is taller on desktop (a wrapped caption needs the room). */
  readonly desktop: boolean;
  /** What to say with no card to list (a search with no match, the search still being ranked); null with cards. */
  readonly empty: string | null;
}

/** Card view's measures for a list `width` px wide (`view/deck-pool-grid.ts`, plus the copy strip under each cell). */
export interface PoolGridMeasures {
  readonly columns: number;
  readonly rowHeight: number;
  readonly gap: number;
  readonly captionHeight: number;
}
