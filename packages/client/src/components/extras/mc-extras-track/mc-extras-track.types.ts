import type { McListRowModel } from "@mc/ui";

export interface McExtrasTrackProps {
  /** The row as a badge row: the mark, the title, the detail, and whether it is open and playing. */
  model: McListRowModel | null;
}
