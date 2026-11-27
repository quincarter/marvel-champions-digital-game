/** A list row: a leading badge, a title and a detail line. */
export interface McListRowModel {
  /** The badge mark ("▶", "■", "✓"), already a glyph. */
  readonly leading: string;
  readonly title: string;
  readonly detail: string;
  /** Pressable: a red badge. Not open: an ink badge, the title dimmed and the detail in red (what opens it). */
  readonly open: boolean;
  /** The current row (the song playing): an ink ground with paper words. */
  readonly active: boolean;
}
