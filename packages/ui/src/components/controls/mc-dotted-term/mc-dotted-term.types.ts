/** The event a mouse over a term, and leaving it, raises. */
export const TERM_HOVER_EVENT = "mc-term-hover";

/** `mc-term-hover`'s detail. */
export interface TermHoverDetail {
  readonly over: boolean;
}

/** The properties of `mc-dotted-term`, besides the press ones (`data-stop`, `action`, `holdAction`). */
export interface McDottedTermProps {
  /** The word as it reads in the sentence. */
  readonly label: string;
}

declare global {
  interface HTMLElementEventMap {
    "mc-term-hover": CustomEvent<TermHoverDetail>;
  }
}
