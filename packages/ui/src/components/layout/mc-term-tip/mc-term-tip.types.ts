/** The event a tap on the tip's link raises. */
export const TERM_LINK_EVENT = "mc-term-link";

/** The properties of `mc-term-tip`. */
export interface McTermTipProps {
  /** The word the tip points at. */
  readonly anchor: Element | null;
  /** The term's name, already translated. */
  readonly heading: string;
  /** The definition with its source, already translated. */
  readonly body: string;
  /** The glossary link's words, already translated. */
  readonly linkLabel: string;
  /** The link's focus stop key. */
  readonly linkStop: string;
}

/** Where the plate sits, in px from the element's own corner. */
export interface TermTipPlace {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  /** The arrow's left edge along the plate. */
  readonly arrowX: number;
  /** The plate is above the word (its arrow points down). */
  readonly above: boolean;
  /** Whether the arrow is drawn: not when the plate had to sit over the word for lack of room. */
  readonly arrow: boolean;
}

declare global {
  interface HTMLElementEventMap {
    "mc-term-link": CustomEvent<undefined>;
  }
}
