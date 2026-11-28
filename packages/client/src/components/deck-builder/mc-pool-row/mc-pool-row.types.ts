export type { PoolCardModel } from "../mc-pool-cell/mc-pool-cell.types.js";

/** A list row's own measures, from the Card size setting (`view/deck-builder-rows.ts`). */
export interface PoolRowSizes {
  /** The row's slot height in px (the drawn row is 6 shorter). */
  readonly rowHeight: number;
  /** The picture's width in px, at the printed card's proportions. */
  readonly thumbWidth: number;
}
