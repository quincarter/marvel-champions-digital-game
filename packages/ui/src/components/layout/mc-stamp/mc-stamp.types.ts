/** The fills a stamp takes. */
export type McStampTone = "heal" | "red" | "caution" | "ink" | "parchment";

/** The properties of `mc-stamp`. */
export interface McStampProps {
  /** The word, already translated. */
  readonly label: string;
  readonly tone: McStampTone;
}
