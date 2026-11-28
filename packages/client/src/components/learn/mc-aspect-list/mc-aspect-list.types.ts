import type { AspectRowModel } from "../mc-aspect-row/mc-aspect-row.types.js";

/** The properties of `mc-aspect-list`. */
export interface AspectListProps {
  /** ASPECTS, already translated. */
  readonly heading: string;
  readonly aspects: readonly AspectRowModel[];
}
