import type { UpdateAllBar } from "../../../view/mod-store-update-all.js";
import type { ModStoreSize } from "../shared/mod-store-size.types.js";

export interface McModUpdateBarProps {
  size: ModStoreSize;
  /** What the bar says and offers (`updateAllBarOf`); null draws nothing. */
  bar: UpdateAllBar | null;
}
