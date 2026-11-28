/** The properties of an `mc-track-row`: one song in a list. */
export interface McTrackRowProps {
  /** The song's title, already in the app's language. */
  heading: string;
  /** Where it plays in the game ("Battle · Rhino"), already in the app's language. */
  where: string;
  /** This is the song that is playing. */
  playing: boolean;
  /** Its focus stop's key (`song:<id>`). */
  stop: string;
  /** What a tap raises in `mc-pressed`. */
  action: unknown;
}
