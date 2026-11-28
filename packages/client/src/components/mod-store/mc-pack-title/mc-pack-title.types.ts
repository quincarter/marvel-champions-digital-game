import type { ModStoreSize } from "../shared/mod-store-size.types.js";

/** A pack page's title block, already translated. */
export interface PackTitleModel {
  readonly name: string;
  readonly byline: string;
  /** "Hero pack · v1.0.0 · 1.2 MB". */
  readonly meta: string;
  /** The state chip's mark and words. */
  readonly chip: string;
  /** The chip is the call to action: red. */
  readonly solid: boolean;
}

export interface McPackTitleProps {
  size: ModStoreSize;
  pack: PackTitleModel | null;
}
