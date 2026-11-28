/** A run of a sentence: plain words, a term that has a definition, or a line or paragraph break. */
export type McTermRun =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "term"; readonly id: string; readonly label: string }
  | { readonly kind: "break"; readonly paragraph: boolean };

/** What an open term's tip says, already translated. A term with no entry here reads as plain words. */
export interface McTermTipContent {
  readonly heading: string;
  readonly body: string;
  readonly linkLabel: string;
}

/** The properties of `mc-term-text`. */
export interface McTermTextProps {
  readonly runs: readonly McTermRun[];
  /** The tips by term id. */
  readonly tips: Readonly<Record<string, McTermTipContent>>;
  /** The focus stop key of a term is this prefix and its id (`term:threat`). */
  readonly stopPrefix: string;
  /** The focus stop key of the open tip's link. */
  readonly linkStop: string;
}

/** `mc-term-tip-change`'s detail: the term whose tip is open now, or null when none is. */
export interface TermTipChangeDetail {
  readonly id: string | null;
}

/** `mc-term-glossary`'s detail: the term whose tip's glossary link was pressed. */
export interface TermGlossaryDetail {
  readonly id: string;
  /** The tip's heading, the name to look up. */
  readonly heading: string;
}

declare global {
  interface HTMLElementEventMap {
    "mc-term-tip-change": CustomEvent<TermTipChangeDetail>;
    "mc-term-glossary": CustomEvent<TermGlossaryDetail>;
  }
}
