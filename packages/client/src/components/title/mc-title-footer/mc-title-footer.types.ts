/** The footer line, already worded and translated. */
export interface TitleFooterInput {
  /** The quiet note at the left ("1,065 / 3,678 cards live"); hidden where it would touch the links. */
  readonly note: string;
  /** The build stamp at the right end, quiet. */
  readonly version: string;
  /** The links left of the version, each an underlined word with a touch-sized target. */
  readonly links: readonly TitleFooterLink[];
  /** A line above the right end ("Power saving mode is on"), when there is one. */
  readonly aside: string | null;
}

export interface TitleFooterLink {
  /** Its focus stop and what a press reports (`release-notes`, `discord`). */
  readonly key: string;
  readonly label: string;
}
