/** The properties of `mc-now-playing`: what is playing, what is playing it, and whether anything is. */
export interface McNowPlayingProps {
  /** "NOW PLAYING", "PAUSED" or "NOTHING PLAYING", already translated. */
  status: string;
  /** The song, or null when nothing plays. */
  song: string | null;
  /** "Shuffling earned songs", "Repeating this song": what is playing it; null when nothing plays. */
  detail: string | null;
}
