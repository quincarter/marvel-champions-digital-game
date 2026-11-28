import type { SegmentBarPart } from "@mc/ui";

export interface McStatsSplitTileProps {
  /** "How you lose". */
  label: string;
  /** The bar's parts, each with its own words and colour. */
  parts: readonly SegmentBarPart[];
  detail: string;
}
