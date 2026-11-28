/** One earned song in the music player's list. */
export interface TrackListItem {
  /** What the press reports, and what a focus stop finds the row by (`song:<id>`). */
  readonly key: string;
  readonly title: string;
  /** Where it plays in the game ("Battle · Rhino"), already in the app's language. */
  readonly where: string;
  /** This is the song that is playing: an ink row with a note on its disc. */
  readonly playing: boolean;
}

/** The properties of `mc-track-list`: the earned songs, or what to say while there are none. */
export interface McTrackListProps {
  tracks: readonly TrackListItem[];
  /** Said in place of the list when `tracks` is empty. */
  empty: string;
}
