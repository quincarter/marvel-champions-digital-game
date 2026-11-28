import type { ModStoreSize } from "../mc-mod-store-header/mc-mod-store-header.types.js";

export interface McModBetaCaptionProps {
  /** A phone's caption is smaller. */
  size: ModStoreSize;
  /** "Beta". */
  heading: string;
  /** Why the store is in beta: the long words, or the phone's short ones. */
  body: string;
}
