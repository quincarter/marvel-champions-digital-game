import type { CreatorModel } from "../mc-creator-row/mc-creator-row.types.js";
import type { ModStoreSize } from "../mc-mod-store-header/mc-mod-store-header.types.js";

export interface McCreatorListProps {
  size: ModStoreSize;
  /** "The people who make the store's packs. Pick a name to see what they made." */
  intro: string;
  /** What it says while there are no creators yet. */
  empty: string;
  credits: readonly CreatorModel[];
}
