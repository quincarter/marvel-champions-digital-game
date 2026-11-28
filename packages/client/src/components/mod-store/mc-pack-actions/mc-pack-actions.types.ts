import type { PackAction } from "../../../view/mod-store-model.js";

import type { ModStoreSize } from "../mc-mod-store-header/mc-mod-store-header.types.js";

export interface McPackActionsProps {
  /** A phone's buttons share the row equally. */
  size: ModStoreSize;
  /** The buttons the pack's state offers (`actionsOf`), in order, already translated. */
  actions: readonly PackAction[];
}
