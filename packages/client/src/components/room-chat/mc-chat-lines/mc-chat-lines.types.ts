/** One chat line, its words already translated. */
export interface ChatLineModel {
  /** A stable key (the line's index among the newest). */
  readonly id: string;
  readonly who: string;
  readonly text: string;
  readonly mine: boolean;
}

export interface ChatLinesModel {
  readonly lines: readonly ChatLineModel[];
  /** What it says while nobody has spoken, or when chat is off. */
  readonly empty: string;
  /** Changes when a new line arrived (or the chat was opened): the list scrolls to its newest line. */
  readonly toEnd: number;
}
