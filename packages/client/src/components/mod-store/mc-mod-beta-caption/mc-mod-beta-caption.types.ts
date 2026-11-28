import type { ModStoreSize } from "../shared/mod-store-size.types.js";

export interface McModBetaCaptionProps {
  /** A phone's caption is smaller. */
  size: ModStoreSize;
  /** "Beta". */
  heading: string;
  /** Why the store is in beta: the long words, or the phone's short ones. */
  body: string;
}
