/** A one-line footer's words, already worded and translated: a note at the left, links and the version at the right. */
export interface FooterBarModel {
  /** The quiet note at the left ("1,065 / 3,678 cards live"); hidden when it would touch the links. */
  readonly note: string;
  /** The build stamp at the right end ("v1.0.0+abc1234"), quiet. */
  readonly version: string;
  /** The links left of the version, each an underlined word with a touch-sized target; `key` is what `mc-activate` reports. */
  readonly links: readonly FooterBarLink[];
  /** A line hung above the right end ("Power saving mode is on"), when there is one. */
  readonly aside: string | null;
}

export interface FooterBarLink {
  readonly key: string;
  readonly label: string;
}
