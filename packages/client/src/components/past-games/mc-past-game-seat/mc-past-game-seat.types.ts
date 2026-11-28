/** One seat of a game in the details: the hero and how it ended, then its stats, deck and most played cards. */
export interface PastGameSeatModel {
  /** "Spider-Man · Stood": the hero's name and, when the save says, whether it fell. */
  readonly heading: string;
  readonly lines: readonly string[];
}

export interface McPastGameSeatProps {
  readonly model: PastGameSeatModel | null;
}
