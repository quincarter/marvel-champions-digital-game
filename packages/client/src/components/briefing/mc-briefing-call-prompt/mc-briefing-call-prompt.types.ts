/** Who is deciding, the box own plain words about the question and the printed rule. */
export interface CallPromptModel {
  /** "SEAT 2" or "TOGETHER" for a call with no seat header; null when a seat header says who. */
  readonly who: string | null;
  /** The box own plain-words line, or null. */
  readonly explain: string | null;
  /** The printed rule text. */
  readonly rule: string;
}
