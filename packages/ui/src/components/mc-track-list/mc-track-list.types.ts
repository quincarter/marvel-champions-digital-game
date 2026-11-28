import type { TrackRowModel } from "../mc-track-row/mc-track-row.types.js";

/** The music player's song list: the earned songs, or what to say while there are none. */
export interface TrackListModel {
  readonly tracks: readonly TrackRowModel[];
  /** Said in place of the list when `tracks` is empty. */
  readonly empty: string;
}
