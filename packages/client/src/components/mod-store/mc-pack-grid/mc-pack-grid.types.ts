import type { PackTileModel } from "../mc-pack-tile/mc-pack-tile.types.js";
import type { ModStoreSize } from "../mc-mod-store-header/mc-mod-store-header.types.js";

export interface McPackGridProps {
  size: ModStoreSize;
  /** The packs the tab, search and tags leave, in order. */
  tiles: readonly PackTileModel[];
  /** What the list shows (`grid:<tab>`): its scroll place is kept under this id. */
  listId: string;
  /** Goes up when a new filter sends the list back to its top. */
  scrollFrom: number;
}
