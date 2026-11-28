/** The progress strip at the bar's right end: how many lessons, how many are behind the player or this one. */
export interface LearnHeaderTicks {
  readonly count: number;
  readonly filled: number;
  /** "Lesson 1 of 5", already translated. */
  readonly label: string;
}
