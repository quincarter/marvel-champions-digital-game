/** Whether the result word is a win, a loss or neither: the word is the cue, the colour only agrees with it. */
export type PastGameTone = "won" | "lost" | "neutral";

export interface PastGameSummaryModel {
  /** "WON", "LOST", "CONCEDED"...: already in capitals and translated. */
  readonly result: string;
  readonly tone: PastGameTone;
  /** Why the game ended ("Villain defeated"). */
  readonly reason: string;
  /** "Rhino · Spider-Man": what the game was. */
  readonly title: string;
  /** "3 rounds · 24 min · Nov 3, 2026": when and how long. */
  readonly when: string;
  /** Which heroes fell and which stood; null when the reason already says it. */
  readonly fates: string | null;
  /** "Campaign: Rise of Red Skull" (the details only); null for a standalone game. */
  readonly campaign: string | null;
}

export type PastGameSummarySize = "row" | "detail";

export interface McPastGameSummaryProps {
  readonly model: PastGameSummaryModel | null;
  readonly size: PastGameSummarySize;
}
