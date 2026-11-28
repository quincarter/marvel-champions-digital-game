/** The "Now playing" strip: what is playing, what is playing it, and whether anything is. */
export interface NowPlayingModel {
  /** "NOW PLAYING", "PAUSED" or "NOTHING PLAYING". */
  readonly status: string;
  /** The song, or null when nothing plays. */
  readonly title: string | null;
  /** "Shuffling earned songs", "Repeating this song": what is playing it. */
  readonly detail: string | null;
}
