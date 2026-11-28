/** One seat deck on the Decks panel. */
export interface DeckRowModel {
  readonly seat: number;
  /** "HERO · ASPECT", already capitalised. */
  readonly title: string;
  /** The deck count ("40", or "40 + 3 pinned"). */
  readonly count: string;
  /** Why the deck would be refused, in the player language; null when it is fine. */
  readonly problem: string | null;
}
