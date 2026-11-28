import type { ModStoreSize } from "../mc-mod-store-header/mc-mod-store-header.types.js";

/** One creator of the Credits tab, already translated. */
export interface CreatorModel {
  readonly name: string;
  /** "2 packs ▸". */
  readonly countText: string;
  /** Which packs, in a line. */
  readonly line: string;
}

export interface McCreatorRowProps {
  /** A phone's row is taller, with two lines for the packs. */
  size: ModStoreSize;
  credit: CreatorModel | null;
}
