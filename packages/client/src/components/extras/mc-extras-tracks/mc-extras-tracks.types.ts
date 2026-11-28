import type { McListRowModel } from "@mc/ui";

/** One song row: the entry's id (its stop is `tile:<id>`) and the badge row to draw. */
export interface ExtrasTrackItem {
  readonly id: string;
  readonly row: McListRowModel;
}

export interface McExtrasTracksProps {
  tracks: readonly ExtrasTrackItem[];
  /** What it says with no songs. */
  empty: string;
}
