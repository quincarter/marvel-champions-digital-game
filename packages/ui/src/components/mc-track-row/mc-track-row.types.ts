/** One earned song in the music player's list. */
export interface TrackRowModel {
  /** What `mc-activate` reports, and what a focus stop finds the row by (`song:<id>`). */
  readonly key: string;
  readonly title: string;
  /** Where it plays in the game ("Battle · Rhino"), already in the app's language. */
  readonly where: string;
  /** This is the song that is playing: an ink row with a note on its disc. */
  readonly playing: boolean;
}
