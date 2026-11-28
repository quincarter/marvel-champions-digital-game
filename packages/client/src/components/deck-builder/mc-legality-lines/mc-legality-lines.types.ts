/**
 * What the engine's own legality verdict says of the deck (`legalityOf`, or a campaign's own), as lines of words: a legal
 * count in green or the problems in red, a campaign's frozen reason, "unsaved changes", and the last status. A line never
 * rests on its colour: a problem reads "N problems: ..." and legal reads "Legal".
 */
export interface LegalityModel {
  /** "Legal: 40 cards" or "2 problems: ...". */
  readonly text: string;
  readonly ok: boolean;
  /** A campaign's reason the deck cannot be edited; null otherwise. */
  readonly frozen: string | null;
  /** "Unsaved changes" / "Not saved yet"; null when saved or when a status shows. */
  readonly dirty: string | null;
  /** The last status line (a save, a refusal, the leave warning); null for none. */
  readonly status: string | null;
}
